'use strict';

// lib/lens-keywords/repo.js
//
// REQ-DM-2026-08-SAJE01 — persistence against the DILAIKSHAN Neon database.
// Connection pooling / retry pattern copied verbatim from lib/stpm/repo.js
// (the proven precedent for this exact database).
//
// RULES THIS FILE ENFORCES
//   * DILAIKSHAN_NEON_DB and nothing else. No fallback chain — see config.js.
//   * NO DDL AT REQUEST TIME. Schema comes from
//     db/migrations/2026-08-24_006_sajeepan_lens_keywords.sql, applied out of
//     band. If the migration has not been applied the caller gets a clear 503.
//   * Neon stores this run's IMMUTABLE evidence snapshot. It is never read as
//     current Ledsone product truth.
//   * Review lives in its own append-only table so an automated Lens match
//     can never be mistaken for, or overwrite, a human decision.
//   * No SerpAPI key value is ever written by any function in this file.

const { appUrl, ERRORS } = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: appUrl(),
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });
    pool.on('error', () => { /* pool self-heals; a dead idle client is discarded */ });
  }
  return pool;
}

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

function isConnectionError(err) {
  const m = String((err && err.message) || '');
  return /Connection terminated|Client has encountered a connection error|socket hang up|ECONNRESET|EPIPE|ETIMEDOUT|server closed the connection/i.test(m);
}

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

let migrationChecked = false;
const REQUIRED_TABLES = [
  'google_lens_keyword_run',
  'google_lens_keyword_run_product',
  'google_lens_keyword_competitor_result',
  'google_lens_keyword_provider_attempt',
  'google_lens_keyword_quota_snapshot',
  'google_lens_keyword_competitor_review',
  'google_lens_keyword_phase2_result',
  'google_lens_keyword_candidate',
  'google_lens_keyword_planner_suggestion',
  'google_lens_keyword_attribute_validation',
  'google_lens_keyword_final_title',
  'google_lens_keyword_final_alt_text',
  'google_lens_keyword_final_ads_keyword',
  // migration 008 — weekly automation
  'google_lens_keyword_search_cache',
  'google_lens_keyword_weekly_run',
  'google_lens_keyword_generation',
];

async function assertMigrated() {
  if (migrationChecked) return;
  const r = await query(
    `SELECT count(*)::int AS c
       FROM information_schema.tables
      WHERE table_schema='public' AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );
  if (!r.rows[0] || r.rows[0].c < REQUIRED_TABLES.length) {
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
      WHERE table_schema='public' AND table_name LIKE 'google_lens_keyword%' ORDER BY 1`
  );
  return { database: r.rows[0].db, user: r.rows[0].usr, tables: t.rows.map((x) => x.table_name) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

async function findRunByIdempotencyKey(key) {
  if (!key) return null;
  await assertMigrated();
  const r = await query('SELECT * FROM public.google_lens_keyword_run WHERE idempotency_key = $1', [key]);
  return r.rows[0] || null;
}

async function createRun({ createdBy, country, language, requestedProductCount, idempotencyKey }) {
  await assertMigrated();
  const r = await query(
    `INSERT INTO public.google_lens_keyword_run
       (created_by, started_at, status, country, language,
        requested_product_count, searches_estimated, idempotency_key)
     VALUES ($1, now(), 'PREPARING', $2, $3, $4, $4, $5)
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [createdBy, country, language, requestedProductCount, idempotencyKey || null]
  );
  if (rowsEmpty(r) && idempotencyKey) {
    const again = await query('SELECT * FROM public.google_lens_keyword_run WHERE idempotency_key = $1', [idempotencyKey]);
    return { run: again.rows[0], reused: true };
  }
  return { run: r.rows[0], reused: false };
}
function rowsEmpty(r) { return !r.rows[0]; }

async function addRunProducts(runId, snapshots) {
  await assertMigrated();
  const rows = [];
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const r = await query(
      `INSERT INTO public.google_lens_keyword_run_product
         (run_id, seq, sku, mapped_sku, product_item_id, product_title_snapshot,
          product_url_snapshot, image_url_snapshot, product_type_snapshot, attribute_snapshot,
          source_identity, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'WAITING')
       ON CONFLICT (run_id, sku) DO NOTHING
       RETURNING *`,
      [runId, i + 1, s.sku, s.mapped_sku || null, s.product_item_id || null,
        s.product_title_snapshot || null, s.product_url_snapshot || null,
        s.image_url_snapshot || null, s.product_type_snapshot || null,
        JSON.stringify(s.attribute_snapshot || []),
        JSON.stringify(s.source_identity || {})]
    );
    if (r.rows[0]) rows.push(r.rows[0]);
  }
  await query('UPDATE public.google_lens_keyword_run SET products_total = $2 WHERE run_id = $1', [runId, rows.length]);
  return rows;
}

async function getRun(runId) {
  await assertMigrated();
  const r = await query('SELECT * FROM public.google_lens_keyword_run WHERE run_id = $1', [runId]);
  return r.rows[0] || null;
}

async function listRuns(limit) {
  await assertMigrated();
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const r = await query(
    `SELECT run_id, run_no, created_by, created_at, started_at, completed_at,
            status, status_detail, provider, country, language,
            requested_product_count, products_total, products_done,
            products_success, products_no_match, products_failed,
            products_skipped_missing_image, competitor_result_count,
            searches_estimated, searches_used, error_message
       FROM public.google_lens_keyword_run
      ORDER BY created_at DESC LIMIT $1`,
    [n]
  );
  return r.rows;
}

async function setRunFields(runId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE public.google_lens_keyword_run SET ${sets} WHERE run_id = $1`, [runId, ...keys.map((k) => fields[k])]);
}

async function getRunProducts(runId) {
  await assertMigrated();
  const r = await query('SELECT * FROM public.google_lens_keyword_run_product WHERE run_id = $1 ORDER BY seq', [runId]);
  return r.rows;
}

async function getRunProductBySku(runId, sku) {
  const r = await query('SELECT * FROM public.google_lens_keyword_run_product WHERE run_id = $1 AND sku = $2', [runId, sku]);
  return r.rows[0] || null;
}

async function recount(runId) {
  const { rows } = await query(
    `SELECT
       count(*)                                                      AS total,
       count(*) FILTER (WHERE state = 'SUCCESS')                     AS success,
       count(*) FILTER (WHERE state = 'NO_VISUAL_MATCHES')           AS no_match,
       count(*) FILTER (WHERE state = 'FAILED')                      AS failed,
       count(*) FILTER (WHERE state = 'MISSING_IMAGE')                AS missing_image,
       count(*) FILTER (WHERE state IN ('WAITING','RUNNING'))        AS pending
     FROM public.google_lens_keyword_run_product WHERE run_id = $1`,
    [runId]
  );
  const r = rows[0];
  const total = Number(r.total);
  const pending = Number(r.pending);
  const done = total - pending;
  await setRunFields(runId, {
    products_done: done,
    products_success: Number(r.success),
    products_no_match: Number(r.no_match),
    products_failed: Number(r.failed),
    products_skipped_missing_image: Number(r.missing_image),
  });
  return {
    total, pending, done,
    success: Number(r.success), no_match: Number(r.no_match),
    failed: Number(r.failed), missing_image: Number(r.missing_image),
  };
}

/** Atomically claim the next WAITING product. FOR UPDATE SKIP LOCKED — safe
 *  under concurrent advance() calls, same pattern as lib/feed/cycle.js. */
async function claimNextProduct(runId) {
  const r = await query(
    `UPDATE public.google_lens_keyword_run_product SET state = 'RUNNING', started_at = now()
      WHERE run_product_id = (
        SELECT run_product_id FROM public.google_lens_keyword_run_product
         WHERE run_id = $1 AND state = 'WAITING'
         ORDER BY seq FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`,
    [runId]
  );
  return r.rows[0] || null;
}

async function completeProduct(runProductId, patch) {
  await query(
    `UPDATE public.google_lens_keyword_run_product SET
       state=$2, provider=$3, provider_search_id=$4, result_count=$5,
       error_code=$6, error_detail_safe=$7, completed_at=now()
     WHERE run_product_id=$1`,
    [runProductId, patch.state, patch.provider || null, patch.provider_search_id || null,
      patch.result_count || 0, patch.error_code || null, patch.error_detail_safe || null]
  );
}

async function insertCompetitorResults(runId, runProductId, results) {
  if (!results || !results.length) return 0;
  const client = await connect();
  try {
    await client.query('BEGIN');
    for (const r of results) {
      const ins = await client.query(
        `INSERT INTO public.google_lens_keyword_competitor_result
           (run_product_id, run_id, rank, provider, result_type,
            image_src, image_alt, url, h3_heading, cite, emphasized_text,
            aria_label, displayed_domain, title, source_name,
            is_self_result, is_duplicate, safe_provider_payload,
            auto_decision, auto_score, decision_reasons)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21::jsonb)
         RETURNING competitor_result_id`,
        [runProductId, runId, r.rank, r.provider, r.result_type,
          r.image_src, r.image_alt, r.url, r.h3_heading, r.cite, r.emphasized_text,
          r.aria_label, r.displayed_domain, r.title, r.source_name,
          !!r.is_self_result, !!r.is_duplicate, JSON.stringify(r.safe_provider_payload || {}),
          r.auto_decision || null, r.auto_score ?? null, JSON.stringify(r.decision_reasons || [])]
      );

      // The automatic decision is ALSO written as a review row so the existing
      // "Stage 4 uses only INCLUDED results" query needs no change, and so a
      // human override later is an ordinary append on the same audit trail
      // rather than a special case. reviewed_by is SYSTEM_AUTO — an automated
      // decision is never presented as a person's decision.
      if (r.auto_decision) {
        await client.query(
          `INSERT INTO public.google_lens_keyword_competitor_review
             (competitor_result_id, run_id, previous_status, review_status, review_reason, reviewed_by)
           VALUES ($1,$2,'NEEDS_REVIEW',$3,$4,'SYSTEM_AUTO')`,
          [ins.rows[0].competitor_result_id, runId,
            r.auto_decision === 'AUTO_INCLUDED' ? 'INCLUDED' : 'EXCLUDED',
            (r.decision_reasons || []).join(' ').slice(0, 500) || null]
        );
      }
    }
    await client.query(
      'UPDATE public.google_lens_keyword_run SET competitor_result_count = competitor_result_count + $2 WHERE run_id = $1',
      [runId, results.length]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release(e);
    throw e;
  } finally {
    try { client.release(); } catch { /* already released */ }
  }
  return results.length;
}

async function insertProviderAttempt(runId, runProductId, attempt) {
  await query(
    `INSERT INTO public.google_lens_keyword_provider_attempt
       (run_product_id, run_id, provider, key_slot, engine, search_id,
        status, http_status, latency_ms, remaining_credits_before,
        remaining_credits_after, error_code, error_detail_safe, ended_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())`,
    [runProductId, runId, attempt.provider || 'SERPAPI', attempt.key_slot || null,
      attempt.engine || 'google_lens', attempt.search_id || null, attempt.status,
      attempt.http_status || null, attempt.latency_ms || null,
      attempt.remaining_credits_before ?? null, attempt.remaining_credits_after ?? null,
      attempt.error_code || null, attempt.error_detail_safe || null]
  );
  if (Number.isFinite(attempt.remaining_credits_after) || attempt.status === 'SUCCESS' || attempt.status === 'NO_VISUAL_MATCHES') {
    await query('UPDATE public.google_lens_keyword_run SET searches_used = searches_used + 1 WHERE run_id = $1', [runId]);
  }
}

/** Most recent provider attempt for this run, across any product — used to
 *  decide which key slot the next search should use (see phase1.js). */
async function getLastAttemptForRun(runId) {
  const r = await query(
    `SELECT * FROM public.google_lens_keyword_provider_attempt
      WHERE run_id = $1 ORDER BY started_at DESC, attempt_id DESC LIMIT 1`,
    [runId]
  );
  return r.rows[0] || null;
}

async function saveQuotaSnapshot(runId, statuses, capturedWhen) {
  for (const s of statuses) {
    await query(
      `INSERT INTO public.google_lens_keyword_quota_snapshot
         (run_id, key_slot, captured_when, plan_name, searches_per_month,
          plan_searches_left, total_searches_left, this_month_usage,
          rate_limit_per_hour, configured, reachable, error_safe)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [runId || null, s.key_slot, capturedWhen || 'BEFORE_RUN', s.plan_name,
        s.searches_per_month, s.plan_searches_left, s.total_searches_left,
        s.this_month_usage, s.rate_limit_per_hour, !!s.configured, !!s.reachable,
        s.error_safe || null]
    );
  }
}

async function latestQuotaSnapshots() {
  const r = await query(
    `SELECT DISTINCT ON (key_slot) key_slot, captured_at, plan_name,
            searches_per_month, plan_searches_left, total_searches_left,
            this_month_usage, rate_limit_per_hour, configured, reachable, error_safe
       FROM public.google_lens_keyword_quota_snapshot
      ORDER BY key_slot, captured_at DESC`
  );
  return r.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Results / filters / review
// ─────────────────────────────────────────────────────────────────────────────

const SORTABLE = {
  rank: 'cr.rank', title: 'cr.title', source: 'cr.source_name',
  observed_at: 'cr.observed_at',
};

async function listResults(runId, opts) {
  await assertMigrated();
  const o = opts || {};
  const where = ['cr.run_id = $1'];
  const params = [runId];
  let p = 2;

  if (o.sku) { where.push(`rp.sku = $${p++}`); params.push(o.sku); }
  if (o.review_status) { where.push(`COALESCE(rv.review_status,'NEEDS_REVIEW') = $${p++}`); params.push(o.review_status); }
  if (o.domain) { where.push(`cr.displayed_domain ILIKE $${p++}`); params.push(`%${String(o.domain).slice(0, 120)}%`); }
  if (o.has_image) { where.push('cr.image_src IS NOT NULL'); }
  if (o.has_title) { where.push('cr.title IS NOT NULL'); }
  if (o.exclude_self !== false) { where.push('cr.is_self_result = false'); }
  if (o.exclude_duplicates !== false) { where.push('cr.is_duplicate = false'); }

  const sortCol = SORTABLE[o.sort] || 'cr.rank';
  const dir = String(o.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(Math.max(Number(o.limit) || 100, 1), 500);
  const offset = Math.max(Number(o.offset) || 0, 0);
  const whereSql = where.join(' AND ');

  const base = `
    FROM public.google_lens_keyword_competitor_result cr
    JOIN public.google_lens_keyword_run_product rp ON rp.run_product_id = cr.run_product_id
    LEFT JOIN public.google_lens_keyword_competitor_review_v rv ON rv.competitor_result_id = cr.competitor_result_id
    WHERE ${whereSql}`;

  const countRes = await query(`SELECT count(*)::int AS total ${base}`, params);
  const rowsRes = await query(
    `SELECT cr.*, rp.sku, rp.product_title_snapshot, rp.product_url_snapshot, rp.image_url_snapshot,
            COALESCE(rv.review_status,'NEEDS_REVIEW') AS review_status,
            rv.reviewed_by, rv.reviewed_at, rv.review_reason
     ${base}
     ORDER BY ${sortCol} ${dir} NULLS LAST, cr.competitor_result_id ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    params.concat([limit, offset])
  );
  return { total: countRes.rows[0].total, rows: rowsRes.rows, limit, offset };
}

async function allResultsForExport(runId, opts) {
  const res = await listResults(runId, Object.assign({}, opts, { limit: 500, offset: 0 }));
  const out = res.rows.slice();
  let offset = out.length;
  while (offset < res.total && offset < 20000) {
    const page = await listResults(runId, Object.assign({}, opts, { limit: 500, offset }));
    if (!page.rows.length) break;
    out.push(...page.rows);
    offset += page.rows.length;
  }
  return out;
}

async function setReviewStatus({ competitor_result_id, review_status, review_reason, reviewed_by }) {
  await assertMigrated();
  const cur = await query(
    `SELECT cr.competitor_result_id, cr.run_id, COALESCE(rv.review_status,'NEEDS_REVIEW') AS review_status
       FROM public.google_lens_keyword_competitor_result cr
       LEFT JOIN public.google_lens_keyword_competitor_review_v rv ON rv.competitor_result_id = cr.competitor_result_id
      WHERE cr.competitor_result_id = $1`,
    [competitor_result_id]
  );
  if (!cur.rows[0]) {
    const e = new Error('Result not found.'); e.status = 404; e.code = 'LENS_RESULT_NOT_FOUND'; throw e;
  }
  const r = await query(
    `INSERT INTO public.google_lens_keyword_competitor_review
       (competitor_result_id, run_id, previous_status, review_status, review_reason, reviewed_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [cur.rows[0].competitor_result_id, cur.rows[0].run_id, cur.rows[0].review_status,
      review_status, review_reason ? String(review_reason).slice(0, 500) : null, reviewed_by]
  );
  return r.rows[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS PHASE (Stages 4-12) — separate from the Lens-search phase above.
// Same claim/idempotency discipline: FOR UPDATE SKIP LOCKED, one (product,
// stage) per call, append-only where a human decision is recorded.
// ═══════════════════════════════════════════════════════════════════════════

/** INCLUDED competitor results for a product — Stage 4 must use only these. */
async function getIncludedCompetitorResults(runProductId) {
  const r = await query(
    `SELECT cr.* FROM public.google_lens_keyword_competitor_result cr
       JOIN public.google_lens_keyword_competitor_review_v rv ON rv.competitor_result_id = cr.competitor_result_id
      WHERE cr.run_product_id = $1 AND rv.review_status = 'INCLUDED'`,
    [runProductId]
  );
  return r.rows;
}

/** One-time initialization: move every product from the migration's default
 *  'PENDING' marker onto the pipeline's actual first stage. Idempotent —
 *  only touches rows still at 'PENDING'. */
async function initAnalysisStages(runId, firstStage) {
  await query(
    `UPDATE public.google_lens_keyword_run_product
        SET analysis_stage = $2
      WHERE run_id = $1 AND analysis_stage = 'PENDING'`,
    [runId, firstStage]
  );
}

/**
 * Atomically claim the next (product, stage) pair for the analysis pipeline.
 *
 * `analysis_stage_detail` doubles as a claim marker: a row whose detail
 * starts with 'CLAIMED:' is currently being worked by some advanceAnalysis()
 * call and is skipped by every other concurrent call, so two overlapping
 * requests can never process the same stage twice (same FOR UPDATE SKIP
 * LOCKED discipline as claimNextProduct(), adapted for a multi-stage-per-row
 * pipeline instead of a single WAITING/RUNNING flag).
 */
async function claimNextAnalysisStage(runId) {
  const r = await query(
    `UPDATE public.google_lens_keyword_run_product
        SET analysis_stage_detail = 'CLAIMED:' || analysis_stage
      WHERE run_product_id = (
        SELECT run_product_id FROM public.google_lens_keyword_run_product
         WHERE run_id = $1 AND analysis_stage <> 'DONE'
           AND (analysis_stage_detail IS NULL OR analysis_stage_detail NOT LIKE 'CLAIMED:%')
         ORDER BY seq
         FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`,
    [runId]
  );
  return r.rows[0] || null;
}

/** Move a claimed row to its next stage and release the claim marker. */
async function advanceProductAnalysisStage(runProductId, toStage, detail) {
  await query(
    `UPDATE public.google_lens_keyword_run_product
        SET analysis_stage = $2, analysis_stage_detail = $3,
            analysis_completed_at = CASE WHEN $2 = 'DONE' THEN now() ELSE analysis_completed_at END
      WHERE run_product_id = $1`,
    [runProductId, toStage, detail || null]
  );
}

/** Release a claim WITHOUT advancing — used when a stage fails and must be
 *  retried rather than silently skipped. */
async function releaseAnalysisClaim(runProductId, detail) {
  await query(
    `UPDATE public.google_lens_keyword_run_product SET analysis_stage_detail = $2 WHERE run_product_id = $1`,
    [runProductId, detail || null]
  );
}

async function setProductPrimaryKeyword(runProductId, keyword) {
  await query('UPDATE public.google_lens_keyword_run_product SET phase1_primary_keyword = $2 WHERE run_product_id = $1', [runProductId, keyword]);
}

async function recountAnalysis(runId) {
  const { rows } = await query(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE analysis_stage = 'DONE') AS done
       FROM public.google_lens_keyword_run_product WHERE run_id = $1`,
    [runId]
  );
  const total = Number(rows[0].total), done = Number(rows[0].done);
  return { total, done, pending: total - done };
}

async function setAnalysisFields(runId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE public.google_lens_keyword_run SET ${sets} WHERE run_id = $1`, [runId, ...keys.map((k) => fields[k])]);
}

async function incrementRunCounter(runId, column, by) {
  await query(`UPDATE public.google_lens_keyword_run SET ${column} = ${column} + $2 WHERE run_id = $1`, [runId, by || 1]);
}

// ── Phase 2 results ─────────────────────────────────────────────────────────
async function savePhase2Results(runId, runProductId, rows) {
  if (!rows || !rows.length) return 0;
  for (const r of rows) {
    await query(
      `INSERT INTO public.google_lens_keyword_phase2_result
         (run_product_id, run_id, engine, seed_keyword, rank, title, url,
          displayed_domain, snippet, image_src, price, rating, reviews, safe_provider_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [runProductId, runId, r.engine, r.seed_keyword || null, r.rank, r.title, r.url,
        r.displayed_domain, r.snippet, r.image_src, r.price, r.rating, r.reviews,
        JSON.stringify(r.safe_provider_payload || {})]
    );
  }
  return rows.length;
}
async function getPhase2Results(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_phase2_result WHERE run_product_id = $1 ORDER BY engine, rank', [runProductId]);
  return r.rows;
}

// ── Keyword candidates (Phase 1 + Phase 2, Stages 4-5) ──────────────────────
async function saveCandidates(runId, runProductId, phase, candidates) {
  if (!candidates || !candidates.length) return 0;
  for (const c of candidates) {
    await query(
      `INSERT INTO public.google_lens_keyword_candidate
         (run_product_id, run_id, phase, term, normalized_term, category,
          title_frequency, title_frequency_pct, in_current_title, is_brand, rank, example_sources)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [runProductId, runId, phase, c.term, c.normalized_term, c.category,
        c.title_frequency, c.title_frequency_pct, !!c.in_current_title, !!c.is_brand,
        c.rank || null, JSON.stringify(c.example_sources || [])]
    );
  }
  return candidates.length;
}
async function getCandidates(runProductId, phase) {
  const r = await query(
    'SELECT * FROM public.google_lens_keyword_candidate WHERE run_product_id = $1 AND phase = $2 ORDER BY title_frequency DESC',
    [runProductId, phase]
  );
  return r.rows;
}

// ── Keyword Planner cache ────────────────────────────────────────────────────
async function findFreshPlannerSuggestions({ normalizedSeed, country, language, freshnessDays }) {
  const r = await query(
    `SELECT * FROM public.google_lens_keyword_planner_suggestion
      WHERE normalized_seed = $1 AND country = $2 AND language = $3
        AND status = 'FETCHED' AND queried_at > now() - ($4 || ' days')::interval
      ORDER BY queried_at DESC`,
    [normalizedSeed, country, language, String(freshnessDays)]
  );
  return r.rows;
}
async function savePlannerSuggestions(rows) {
  for (const s of rows) {
    await query(
      `INSERT INTO public.google_lens_keyword_planner_suggestion
         (run_id, run_product_id, seed_keyword, normalized_seed, country, language,
          status, matched_keyword, new_suggestion, avg_monthly_searches, competition,
          competition_index, low_top_of_page_bid, high_top_of_page_bid, safe_raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
      [s.run_id, s.run_product_id, s.seed_keyword, s.normalized_seed, s.country, s.language,
        s.status, s.matched_keyword, s.new_suggestion, s.avg_monthly_searches, s.competition,
        s.competition_index, s.low_top_of_page_bid, s.high_top_of_page_bid,
        JSON.stringify(s.safe_raw || null)]
    );
  }
}
async function getPlannerSuggestionsForRunProduct(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_planner_suggestion WHERE run_product_id = $1 ORDER BY queried_at DESC', [runProductId]);
  return r.rows;
}

// ── Attribute validation ─────────────────────────────────────────────────────
async function saveAttributeValidations(runId, runProductId, rows) {
  for (const v of rows) {
    await query(
      `INSERT INTO public.google_lens_keyword_attribute_validation
         (run_product_id, run_id, keyword_id, term, attribute_type, status, actual_value, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [runProductId, runId, v.keyword_id || null, v.term, v.category || null, v.status, v.actual_value, v.reason]
    );
  }
}
async function getAttributeValidations(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_attribute_validation WHERE run_product_id = $1', [runProductId]);
  return r.rows;
}

// ── Final title / alt text ───────────────────────────────────────────────────
async function upsertFinalTitle(runId, runProductId, data) {
  const r = await query(
    `INSERT INTO public.google_lens_keyword_final_title
       (run_product_id, run_id, current_title, suggested_title, char_count, keywords_used, status)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
     ON CONFLICT (run_product_id) DO UPDATE SET
       current_title=EXCLUDED.current_title, suggested_title=EXCLUDED.suggested_title,
       char_count=EXCLUDED.char_count, keywords_used=EXCLUDED.keywords_used, status=EXCLUDED.status
     RETURNING *`,
    [runProductId, runId, data.current_title, data.suggested_title, data.char_count,
      JSON.stringify(data.keywords_used || []), data.status]
  );
  return r.rows[0];
}
async function saveFinalTitleChoice(runProductId, finalTitle, savedBy) {
  const r = await query(
    `UPDATE public.google_lens_keyword_final_title
        SET final_title = $2, status = 'SAVED', saved_by = $3, saved_at = now()
      WHERE run_product_id = $1 RETURNING *`,
    [runProductId, finalTitle, savedBy]
  );
  return r.rows[0] || null;
}
async function getFinalTitle(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_final_title WHERE run_product_id = $1', [runProductId]);
  return r.rows[0] || null;
}

async function upsertFinalAltText(runId, runProductId, data) {
  const r = await query(
    `INSERT INTO public.google_lens_keyword_final_alt_text
       (run_product_id, run_id, current_alt_text, suggested_alt_text, keywords_used, status)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     ON CONFLICT (run_product_id) DO UPDATE SET
       current_alt_text=EXCLUDED.current_alt_text, suggested_alt_text=EXCLUDED.suggested_alt_text,
       keywords_used=EXCLUDED.keywords_used, status=EXCLUDED.status
     RETURNING *`,
    [runProductId, runId, data.current_alt_text, data.suggested_alt_text,
      JSON.stringify(data.keywords_used || []), data.status]
  );
  return r.rows[0];
}
async function saveFinalAltTextChoice(runProductId, finalAltText, savedBy) {
  const r = await query(
    `UPDATE public.google_lens_keyword_final_alt_text
        SET final_alt_text = $2, status = 'SAVED', saved_by = $3, saved_at = now()
      WHERE run_product_id = $1 RETURNING *`,
    [runProductId, finalAltText, savedBy]
  );
  return r.rows[0] || null;
}
async function getFinalAltText(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_final_alt_text WHERE run_product_id = $1', [runProductId]);
  return r.rows[0] || null;
}

// ── Final Ads keyword output ─────────────────────────────────────────────────
async function saveFinalAdsKeywords(runId, runProductId, rows) {
  for (const k of rows) {
    await query(
      `INSERT INTO public.google_lens_keyword_final_ads_keyword
         (run_product_id, run_id, keyword, normalized_keyword, source, phase1_frequency,
          phase2_source, planner_metrics, existing_ads_evidence, attribute_status,
          final_status, exclusion_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12)
       ON CONFLICT (run_product_id, normalized_keyword) DO UPDATE SET
         source=EXCLUDED.source, phase1_frequency=EXCLUDED.phase1_frequency,
         phase2_source=EXCLUDED.phase2_source, planner_metrics=EXCLUDED.planner_metrics,
         existing_ads_evidence=EXCLUDED.existing_ads_evidence, attribute_status=EXCLUDED.attribute_status,
         final_status=EXCLUDED.final_status, exclusion_reason=EXCLUDED.exclusion_reason`,
      [runProductId, runId, k.keyword, k.normalized_keyword, k.source, k.phase1_frequency,
        k.phase2_source, JSON.stringify(k.planner_metrics || null), JSON.stringify(k.existing_ads_evidence || null),
        k.attribute_status, k.final_status, k.exclusion_reason]
    );
  }
}
async function getFinalAdsKeywords(runProductId) {
  const r = await query('SELECT * FROM public.google_lens_keyword_final_ads_keyword WHERE run_product_id = $1 ORDER BY phase1_frequency DESC NULLS LAST', [runProductId]);
  return r.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY AUTOMATION (migration 008) — search cache, weekly runs, generation
// evidence, and the automatic decision columns.
// ═══════════════════════════════════════════════════════════════════════════

// ── 28-day search evidence cache ─────────────────────────────────────────────
async function getSearchCache(fingerprint) {
  await assertMigrated();
  const r = await query('SELECT * FROM public.google_lens_keyword_search_cache WHERE fingerprint = $1', [fingerprint]);
  return r.rows[0] || null;
}

async function touchSearchCache(fingerprint) {
  await query(
    `UPDATE public.google_lens_keyword_search_cache
        SET hit_count = hit_count + 1, last_hit_at = now()
      WHERE fingerprint = $1`,
    [fingerprint]
  );
}

/** Upsert — a re-search of the same fingerprint refreshes the TTL clock. */
async function putSearchCache({ fingerprint, engine, keySlot, results }) {
  const r = await query(
    `INSERT INTO public.google_lens_keyword_search_cache
       (fingerprint, engine, key_slot, results, fetched_at)
     VALUES ($1,$2,$3,$4::jsonb, now())
     ON CONFLICT (fingerprint) DO UPDATE SET
       engine = EXCLUDED.engine, key_slot = EXCLUDED.key_slot,
       results = EXCLUDED.results, fetched_at = now()
     RETURNING *`,
    [fingerprint, engine, keySlot || null, JSON.stringify(results || [])]
  );
  return r.rows[0];
}

async function searchCacheStats(ttlDays) {
  const r = await query(
    `SELECT count(*)::int AS entries,
            count(*) FILTER (WHERE fetched_at > now() - ($1 || ' days')::interval)::int AS fresh_entries,
            COALESCE(SUM(hit_count),0)::int AS total_hits
       FROM public.google_lens_keyword_search_cache`,
    [String(ttlDays)]
  );
  return r.rows[0];
}

// ── Weekly runs ──────────────────────────────────────────────────────────────

/** The ONE weekly run for an ISO week, or null. */
async function getWeeklyRun(isoWeek) {
  await assertMigrated();
  const r = await query('SELECT * FROM public.google_lens_keyword_weekly_run WHERE iso_week = $1', [isoWeek]);
  return r.rows[0] || null;
}

/**
 * Create the weekly row IF AND ONLY IF this ISO week has none. The unique
 * constraint on iso_week is what actually enforces one-run-per-week — a cron
 * retry racing itself loses the insert and gets the existing row back.
 */
async function createWeeklyRun({ isoWeek, triggeredBy }) {
  await assertMigrated();
  const r = await query(
    `INSERT INTO public.google_lens_keyword_weekly_run (iso_week, triggered_by, status, started_at)
     VALUES ($1,$2,'RUNNING', now())
     ON CONFLICT (iso_week) DO NOTHING
     RETURNING *`,
    [isoWeek, triggeredBy]
  );
  if (r.rows[0]) return { weekly: r.rows[0], created: true };
  return { weekly: await getWeeklyRun(isoWeek), created: false };
}

async function setWeeklyFields(isoWeek, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE public.google_lens_keyword_weekly_run SET ${sets} WHERE iso_week = $1`, [isoWeek, ...keys.map((k) => fields[k])]);
}

async function incrementWeeklyCounter(isoWeek, column, by) {
  await query(
    `UPDATE public.google_lens_keyword_weekly_run SET ${column} = ${column} + $2 WHERE iso_week = $1`,
    [isoWeek, by || 1]
  );
}

/** The still-unfinished weekly run, if any — the continuation cron's only job. */
async function findActiveWeeklyRun() {
  await assertMigrated();
  const r = await query(
    `SELECT * FROM public.google_lens_keyword_weekly_run
      WHERE status = 'RUNNING' ORDER BY started_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

async function listWeeklyRuns(limit) {
  await assertMigrated();
  const n = Math.min(Math.max(Number(limit) || 12, 1), 52);
  const r = await query(
    `SELECT w.*, r.products_total, r.searches_used, r.status AS run_status, r.analysis_status
       FROM public.google_lens_keyword_weekly_run w
       LEFT JOIN public.google_lens_keyword_run r ON r.run_id = w.run_id
      ORDER BY w.iso_week DESC LIMIT $1`,
    [n]
  );
  return r.rows;
}

// ── Automatic selection / competitor decisions ───────────────────────────────
async function setProductSelection(runProductId, { selection_score, selection_reason, auto_selected }) {
  await query(
    `UPDATE public.google_lens_keyword_run_product
        SET selection_score = $2, selection_reason = $3, auto_selected = $4
      WHERE run_product_id = $1`,
    [runProductId, selection_score ?? null, selection_reason || null, !!auto_selected]
  );
}

async function setCompetitorAutoDecision(competitorResultId, { auto_decision, auto_score, decision_reasons }) {
  await query(
    `UPDATE public.google_lens_keyword_competitor_result
        SET auto_decision = $2, auto_score = $3, decision_reasons = $4::jsonb
      WHERE competitor_result_id = $1`,
    [competitorResultId, auto_decision, auto_score ?? null, JSON.stringify(decision_reasons || [])]
  );
}

// ── Generation evidence (Gemma / script fallback) ────────────────────────────
async function saveGeneration(runId, runProductId, g) {
  await query(
    `INSERT INTO public.google_lens_keyword_generation
       (run_product_id, run_id, generation_source, model_name, prompt_version,
        input_hash, validation_status, validation_failures, title, alt_text,
        character_count, rationale, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12, now())`,
    [runProductId, runId, g.generation_source, g.model_name || null, g.prompt_version || null,
      g.input_hash || null, g.validation_status || null,
      JSON.stringify(g.validation_failures || []), g.title || null, g.alt_text || null,
      g.character_count || 0, g.rationale || null]
  );
}

async function getGeneration(runProductId) {
  const r = await query(
    'SELECT * FROM public.google_lens_keyword_generation WHERE run_product_id = $1 ORDER BY generated_at DESC LIMIT 1',
    [runProductId]
  );
  return r.rows[0] || null;
}

module.exports = {
  getPool, query, assertMigrated, telemetry,
  // weekly automation
  getSearchCache, touchSearchCache, putSearchCache, searchCacheStats,
  getWeeklyRun, createWeeklyRun, setWeeklyFields, incrementWeeklyCounter,
  findActiveWeeklyRun, listWeeklyRuns,
  setProductSelection, setCompetitorAutoDecision,
  saveGeneration, getGeneration,
  findRunByIdempotencyKey, createRun, addRunProducts, getRun, listRuns, setRunFields,
  getRunProducts, getRunProductBySku, recount, claimNextProduct, completeProduct,
  insertCompetitorResults, insertProviderAttempt, getLastAttemptForRun,
  saveQuotaSnapshot, latestQuotaSnapshots,
  listResults, allResultsForExport, setReviewStatus,
  SORTABLE,
  // analysis phase
  getIncludedCompetitorResults, initAnalysisStages, claimNextAnalysisStage, advanceProductAnalysisStage, releaseAnalysisClaim,
  setProductPrimaryKeyword, recountAnalysis, setAnalysisFields, incrementRunCounter,
  savePhase2Results, getPhase2Results,
  saveCandidates, getCandidates,
  findFreshPlannerSuggestions, savePlannerSuggestions, getPlannerSuggestionsForRunProduct,
  saveAttributeValidations, getAttributeValidations,
  upsertFinalTitle, saveFinalTitleChoice, getFinalTitle,
  upsertFinalAltText, saveFinalAltTextChoice, getFinalAltText,
  saveFinalAdsKeywords, getFinalAdsKeywords,
};
