'use strict';

// lib/stpm/repo.js
//
// REQ-DM-2026-08-MAHI01 — persistence against the DILAIKSHAN Neon database.
//
// RULES THIS FILE ENFORCES
//   * DILAIKSHAN_NEON_DB and nothing else. No fallback chain — see config.js.
//   * NO DDL AT REQUEST TIME. Schema comes from
//     db/migrations/2026-08-21_005_mahima_stpm.sql, applied out of band by
//     scripts/stpm-migrate.js. If the migration has not been applied the caller
//     gets a clear 503 rather than a confusing SQL error.
//   * Neon stores the PROCESSED RESULT of a Ledsone-sourced run. It is never
//     read as current Google Ads or Shopify truth.
//   * Result rows are an IMMUTABLE SNAPSHOT. Reopening an old run reads these
//     rows; it never recomputes against today's Ledsone data.
//   * Human review lives in its own append-only table so an automated decision
//     can never be mistaken for, or overwrite, a human approval.

const { Pool } = require('pg');
const { appUrl, ERRORS, REVIEW, REVIEW_VALUES } = require('./config');

let pool = null;
let migrationChecked = false;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: appUrl(),
      ssl: { rejectUnauthorized: false },
      max: 3,
      // Kept deliberately short. A run spends minutes matching products between
      // opening the run row and writing the results, during which any pooled
      // Neon client sits idle. Neon closes idle server-side connections, so a
      // long idle window means the pool can hand back a socket that is already
      // dead. Retiring idle clients quickly is cheaper than discovering that
      // mid-transaction.
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });
    // Errors raised on IDLE clients. Without this, pg re-emits them as an
    // unhandled 'error' event and takes the process down.
    pool.on('error', () => { /* pool self-heals; a dead idle client is discarded */ });
  }
  return pool;
}

/**
 * Check out a client with an error listener already attached.
 *
 * `pool.on('error')` only covers clients sitting IDLE in the pool. A client
 * that is checked out and loses its connection *between* statements — exactly
 * what happens during the batched insert below — emits 'error' with no
 * listener, which crashes the process instead of rejecting the caller's
 * promise. Attaching a listener here turns that into a normal rejection that
 * `runNow` can catch and record as a failed run.
 */
async function connect() {
  const client = await getPool().connect();
  const onError = () => { /* surfaced to the caller via the rejected query */ };
  client.on('error', onError);
  const release = client.release.bind(client);
  client.release = (err) => {
    client.removeListener('error', onError);
    return release(err);
  };
  return client;
}

/**
 * Connection-level failure, as opposed to a SQL error. Means the socket is
 * gone and the statement can safely be tried again on a fresh client.
 */
function isConnectionError(err) {
  const m = String((err && err.message) || '');
  return /Connection terminated|Client has encountered a connection error|socket hang up|ECONNRESET|EPIPE|ETIMEDOUT|server closed the connection/i.test(m);
}

/**
 * Run a statement, retrying ONCE if the pooled connection was already dead.
 *
 * A run opens its header row, then spends a long time matching products in
 * memory before writing results — measured at ~89 s for a one-month window.
 * Neon closes connections idle that long, and `pg` does not validate a pooled
 * client before handing it back, so the first statement after the matching
 * phase can hit a dead socket. Retrying once turns that into a non-event.
 */
async function query(text, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = await connect();
    try {
      return await client.query(text, params);
    } catch (err) {
      client.release(err);
      if (attempt === 0 && isConnectionError(err)) continue;
      throw err;
    } finally {
      try { client.release(); } catch { /* already released */ }
    }
  }
  throw new Error('Query failed after retry.');
}

/**
 * Fail loudly and specifically when the schema is absent.
 * Cached per warm instance so it costs one query per cold start, not per call.
 */
async function assertMigrated() {
  if (migrationChecked) return;
  const r = await query(
    `SELECT count(*)::int AS c
       FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('mahima_stpm_run','mahima_stpm_result','mahima_stpm_review')`
  );
  if (!r.rows[0] || r.rows[0].c < 3) {
    const e = new Error('Run history storage is not initialised.');
    e.code = ERRORS.MIGRATION_MISSING;
    e.status = 503;
    throw e;
  }
  migrationChecked = true;
}

/** Diagnostics that never expose the connection string. */
async function telemetry() {
  const r = await query('SELECT current_database() AS db, current_user AS usr');
  const t = await query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'mahima_stpm%' ORDER BY 1`
  );
  return {
    database: r.rows[0].db,
    user: r.rows[0].usr,
    tables: t.rows.map((x) => x.table_name),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

/** Reuse an existing run for the same idempotency key (double-click safety). */
async function findRunByIdempotencyKey(key) {
  if (!key) return null;
  await assertMigrated();
  const r = await query('SELECT * FROM public.mahima_stpm_run WHERE idempotency_key = $1', [key]);
  return r.rows[0] || null;
}

async function createRun(run) {
  await assertMigrated();
  const r = await query(
    `INSERT INTO public.mahima_stpm_run (
       requirement_id, created_by, started_at, status,
       requested_start, requested_end, requested_preset,
       actual_start, actual_end,
       fallback_used, fallback_days, fallback_reason,
       historical_start, historical_end, historical_preset,
       latest_search_term_source_date, latest_pmax_term_source_date,
       latest_campaign_source_date, shopify_catalogue_cutoff,
       campaign_ids, campaigns_selected,
       rule_version, matching_version, canonical_source_rule, idempotency_key
     ) VALUES (
       $1,$2, now(), 'RUNNING',
       $3,$4,$5,
       $6,$7,
       $8,$9,$10,
       $11,$12,$13,
       $14,$15,
       $16,$17,
       $18,$19,
       $20,$21,$22,$23
     ) RETURNING *`,
    [
      run.requirement_id, run.created_by,
      run.requested_start, run.requested_end, run.requested_preset,
      run.actual_start, run.actual_end,
      run.fallback_used, run.fallback_days, run.fallback_reason,
      run.historical_start, run.historical_end, run.historical_preset,
      run.latest_search_term_source_date, run.latest_pmax_term_source_date,
      run.latest_campaign_source_date, run.shopify_catalogue_cutoff,
      run.campaign_ids, run.campaigns_selected,
      run.rule_version, run.matching_version, run.canonical_source_rule,
      run.idempotency_key || null,
    ]
  );
  return r.rows[0];
}

async function completeRun(runId, patch) {
  await assertMigrated();
  const r = await query(
    `UPDATE public.mahima_stpm_run SET
       status = $2, status_detail = $3, completed_at = now(),
       source_health = $4, source_warnings = $5::jsonb,
       campaigns_with_data = $6, campaigns_stale = $7,
       row_count = $8, negative_candidate_count = $9,
       opportunity_count = $10, product_match_count = $11,
       total_clicks = $12, total_impressions = $13, total_cost = $14,
       total_conversions = $15, total_conversion_value = $16,
       historical_conversions_total = $17, historical_cost_total = $18,
       historical_conversion_value_total = $19
     WHERE run_id = $1 RETURNING *`,
    [
      runId, patch.status, patch.status_detail || null,
      patch.source_health || null, JSON.stringify(patch.source_warnings || []),
      patch.campaigns_with_data || 0, patch.campaigns_stale || 0,
      patch.row_count || 0, patch.negative_candidate_count || 0,
      patch.opportunity_count || 0, patch.product_match_count || 0,
      patch.total_clicks, patch.total_impressions, patch.total_cost,
      patch.total_conversions, patch.total_conversion_value,
      patch.historical_conversions_total, patch.historical_cost_total,
      patch.historical_conversion_value_total,
    ]
  );
  return r.rows[0];
}

async function failRun(runId, code, summary) {
  try {
    await query(
      `UPDATE public.mahima_stpm_run
          SET status='FAILED', completed_at=now(), error_code=$2, error_summary=$3
        WHERE run_id=$1`,
      [runId, code || null, summary || null]
    );
  } catch { /* the original error matters more than this bookkeeping */ }
}

/**
 * Insert result rows in batches.
 * Batched because a run can carry thousands of rows and a single statement with
 * tens of thousands of parameters would exceed the protocol limit.
 */
const RESULT_COLUMNS = [
  'run_id', 'search_term', 'search_term_normalized', 'campaign_id', 'campaign_name',
  'campaign_type', 'source_table', 'source_start', 'source_end',
  'clicks', 'impressions', 'cost', 'conversions', 'conversion_value', 'ctr', 'roas',
  'historical_conversions', 'historical_cost', 'historical_conversion_value', 'historical_clicks',
  'performance_status', 'waste_reasons', 'waste_reason_summary',
  'decision', 'decision_basis', 'negative_keyword_recommended',
  'keyword_opportunity', 'opportunity_candidate', 'opportunity_reason', 'targeting_evidence',
  'intent_label', 'intent_confidence', 'intent_evidence',
  'product_id', 'product_title', 'product_url', 'product_handle',
  'match_type', 'match_score', 'match_source', 'match_evidence', 'runner_up_score',
  'mapping_status', 'mapping_reason', 'data_quality_flags',
];

const JSON_COLUMNS = new Set([
  'waste_reasons', 'decision_basis', 'targeting_evidence', 'intent_evidence',
  'match_evidence', 'data_quality_flags',
]);

async function insertResults(runId, rows) {
  await assertMigrated();
  if (!rows || rows.length === 0) return 0;

  // Retry the WHOLE transaction once on a connection failure. This is safe
  // precisely because it is one transaction: if it does not commit, nothing was
  // written, so a second attempt cannot duplicate rows.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await insertResultsOnce(runId, rows);
    } catch (err) {
      if (attempt === 0 && isConnectionError(err)) continue;
      throw err;
    }
  }
  throw new Error('Insert failed after retry.');
}

async function insertResultsOnce(runId, rows) {
  const BATCH = 200;
  let inserted = 0;

  const client = await connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let p = 1;

      for (const row of chunk) {
        const placeholders = RESULT_COLUMNS.map((col) => {
          const v = col === 'run_id' ? runId : row[col];
          if (JSON_COLUMNS.has(col)) {
            params.push(JSON.stringify(v === undefined ? null : v));
            return `$${p++}::jsonb`;
          }
          params.push(v === undefined ? null : v);
          return `$${p++}`;
        });
        values.push(`(${placeholders.join(',')})`);
      }

      await client.query(
        `INSERT INTO public.mahima_stpm_result (${RESULT_COLUMNS.join(',')}) VALUES ${values.join(',')}`,
        params
      );
      inserted += chunk.length;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release(err);
    throw err;
  } finally {
    try { client.release(); } catch { /* already released */ }
  }

  return inserted;
}

/** Latest N runs for the History view. */
async function listRuns(limit) {
  await assertMigrated();
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const r = await query(
    `SELECT run_id, run_no, created_by, created_at, started_at, completed_at,
            status, status_detail,
            requested_start, requested_end, requested_preset,
            actual_start, actual_end, fallback_used, fallback_days, fallback_reason,
            historical_start, historical_end, historical_preset,
            latest_search_term_source_date, latest_campaign_source_date,
            campaign_ids, campaigns_selected, campaigns_with_data, campaigns_stale,
            source_health, source_warnings,
            row_count, negative_candidate_count, opportunity_count, product_match_count,
            total_clicks, total_cost, total_conversions,
            rule_version, matching_version, error_code, error_summary
       FROM public.mahima_stpm_run
      ORDER BY created_at DESC
      LIMIT $1`,
    [n]
  );
  return r.rows;
}

async function getRun(runId) {
  await assertMigrated();
  const r = await query('SELECT * FROM public.mahima_stpm_run WHERE run_id = $1', [runId]);
  return r.rows[0] || null;
}

/**
 * Result rows for one run, filtered/sorted/paged SERVER-SIDE.
 *
 * Server-side because a run can hold thousands of rows (measured: ~4.4k for a
 * 30-day window, ~27k for a 60-day historical span). Shipping that to the
 * browser would be a multi-MB payload on a function that already has payload
 * pressure.
 *
 * Review status comes from the view, so it always reflects the latest human
 * action without duplicating state onto the immutable result row.
 */
const SORTABLE = {
  search_term: 'r.search_term',
  campaign: 'r.campaign_name',
  clicks: 'r.clicks',
  impressions: 'r.impressions',
  ctr: 'r.ctr',
  cost: 'r.cost',
  conversions: 'r.conversions',
  conversion_value: 'r.conversion_value',
  roas: 'r.roas',
  historical_conversions: 'r.historical_conversions',
  decision: 'r.decision',
  performance_status: 'r.performance_status',
  match_score: 'r.match_score',
  mapping_status: 'r.mapping_status',
  review_status: 'rv.review_status',
};

async function listResults(runId, opts) {
  await assertMigrated();
  const o = opts || {};

  const where = ['r.run_id = $1'];
  const params = [runId];
  let p = 2;

  if (o.campaign_id) { where.push(`r.campaign_id = $${p++}::bigint`); params.push(o.campaign_id); }
  if (o.decision) { where.push(`r.decision = $${p++}`); params.push(o.decision); }
  if (o.performance_status) { where.push(`r.performance_status = $${p++}`); params.push(o.performance_status); }
  if (o.mapping_status) { where.push(`r.mapping_status = $${p++}`); params.push(o.mapping_status); }
  if (o.review_status) { where.push(`COALESCE(rv.review_status,'Pending') = $${p++}`); params.push(o.review_status); }
  if (o.negative_only) { where.push('r.negative_keyword_recommended = true'); }
  if (o.opportunity_only) { where.push('(r.keyword_opportunity = true OR r.opportunity_candidate = true)'); }
  if (o.search) { where.push(`r.search_term ILIKE $${p++}`); params.push('%' + String(o.search).slice(0, 120) + '%'); }
  if (o.product) {
    where.push(`(r.product_title ILIKE $${p} OR r.product_id = $${p + 1})`);
    params.push('%' + String(o.product).slice(0, 120) + '%', String(o.product).slice(0, 40));
    p += 2;
  }

  // Whitelisted sort column — never interpolate caller input into SQL.
  const sortCol = SORTABLE[o.sort] || 'r.cost';
  const dir = String(o.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(Number(o.limit) || 50, 1), 500);
  const offset = Math.max(Number(o.offset) || 0, 0);

  const whereSql = where.join(' AND ');
  const base = `
    FROM public.mahima_stpm_result r
    LEFT JOIN public.mahima_stpm_result_review_v rv ON rv.result_id = r.result_id
    WHERE ${whereSql}`;

  const countRes = await query(`SELECT count(*)::int AS total ${base}`, params);

  const rowsRes = await query(
    `SELECT r.*, COALESCE(rv.review_status,'Pending') AS review_status,
            rv.reviewer, rv.reviewed_at, rv.note AS review_note
     ${base}
     ORDER BY ${sortCol} ${dir} NULLS LAST, r.result_id ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    params.concat([limit, offset])
  );

  return { total: countRes.rows[0].total, rows: rowsRes.rows, limit, offset };
}

/** All rows for a run, for export. Cap keeps a runaway export bounded. */
async function allResultsForExport(runId, opts) {
  await assertMigrated();
  const res = await listResults(runId, Object.assign({}, opts, { limit: 500, offset: 0 }));
  const out = res.rows.slice();
  let offset = out.length;
  while (offset < res.total && offset < 50000) {
    const page = await listResults(runId, Object.assign({}, opts, { limit: 500, offset }));
    if (!page.rows.length) break;
    out.push(...page.rows);
    offset += page.rows.length;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review — append-only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a human review decision.
 * Appends; never mutates the automated decision on the result row.
 */
async function setReviewStatus(a) {
  await assertMigrated();

  if (!REVIEW_VALUES.includes(a.review_status)) {
    const e = new Error('Invalid review status.');
    e.status = 400; e.code = 'STPM_INVALID_REVIEW_STATUS';
    throw e;
  }

  const cur = await query(
    `SELECT r.result_id, r.run_id, COALESCE(rv.review_status,$2) AS review_status
       FROM public.mahima_stpm_result r
       LEFT JOIN public.mahima_stpm_result_review_v rv ON rv.result_id = r.result_id
      WHERE r.result_id = $1`,
    [a.result_id, REVIEW.PENDING]
  );
  if (!cur.rows[0]) {
    const e = new Error('Result not found.');
    e.status = 404; e.code = 'STPM_RESULT_NOT_FOUND';
    throw e;
  }

  const r = await query(
    `INSERT INTO public.mahima_stpm_review
       (result_id, run_id, previous_status, review_status, reviewer, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      cur.rows[0].result_id, cur.rows[0].run_id,
      cur.rows[0].review_status, a.review_status,
      a.reviewer, a.note ? String(a.note).slice(0, 1000) : null,
    ]
  );
  return r.rows[0];
}

async function reviewHistory(resultId) {
  await assertMigrated();
  const r = await query(
    `SELECT review_id, previous_status, review_status, reviewer, reviewed_at, note
       FROM public.mahima_stpm_review WHERE result_id = $1
      ORDER BY reviewed_at DESC, review_id DESC LIMIT 50`,
    [resultId]
  );
  return r.rows;
}

module.exports = {
  getPool,
  query,
  assertMigrated,
  telemetry,
  findRunByIdempotencyKey,
  createRun,
  completeRun,
  failRun,
  insertResults,
  listRuns,
  getRun,
  listResults,
  allResultsForExport,
  setReviewStatus,
  reviewHistory,
  RESULT_COLUMNS,
  SORTABLE,
};
