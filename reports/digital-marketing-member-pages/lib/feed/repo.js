// lib/feed/repo.js
//
// Neon (application-owned) persistence for Feed Optimization.
//
// SCOPE RULE
//   Neon stores WORKFLOW state and immutable EVIDENCE SNAPSHOTS only. It is
//   never a second source of operational product truth — every snapshot is
//   frozen, timestamped and read back as history, never queried as "the
//   current title".
//
// NO RUNTIME DDL. Schema comes from
//   db/migrations/2026-08-20_001_thivajini_feed_optimization.sql
// If a table is missing, we surface a clear, actionable error rather than
// silently creating it (ARCHITECTURE.md §10 finding 6).

'use strict';

let pool;

/**
 * REQ5 DATABASE BOUNDARY — Neon side.
 *
 * Req5 uses NEON_DATABASE_URL and NOTHING ELSE. The historical
 * `FEED_TRACKER_DB_URL || AUTH_DATABASE_URL` chain is deliberately NOT used
 * here: an implicit fallback can silently point workflow writes at a different
 * database, which is exactly the class of defect ARCHITECTURE.md §10 finding 4
 * records. Older dashboard modules keep their own variables — this correction
 * is scoped to Req5 only.
 *
 * If NEON_DATABASE_URL is absent we fail loudly rather than connecting to
 * whatever else happens to be configured.
 */
function connectionString() {
  return process.env.NEON_DATABASE_URL || null;
}

function getPool() {
  if (!pool) {
    const cs = connectionString();
    if (!cs) {
      const err = new Error(
        'REQ5_NEON_DATABASE_URL_MISSING — Req5 workflow/history requires NEON_DATABASE_URL. ' +
        'It will NOT fall back to FEED_TRACKER_DB_URL, AUTH_DATABASE_URL or DATABASE_URL.');
      err.code = 'REQ5_NEON_DATABASE_URL_MISSING';
      throw err;
    }
    const { Pool } = require('pg'); // lazy: see lib/feed/req5.js
    pool = new Pool({ connectionString: cs, max: 3, connectionTimeoutMillis: 8000 });
  }
  return pool;
}

/** Translate "relation does not exist" into an actionable migration message. */
function wrapDbError(e) {
  if (e && e.code === '42P01') {
    const err = new Error(
      'Feed Optimization tables are missing. Apply db/migrations/2026-08-20_001_thivajini_feed_optimization.sql ' +
      'to the application Neon database before using Req5.');
    err.code = 'MIGRATION_NOT_APPLIED';
    return err;
  }
  return e;
}

async function q(text, params) {
  try {
    return await getPool().query(text, params);
  } catch (e) {
    throw wrapDbError(e);
  }
}

/**
 * Confirm the migration is present without attempting any DDL, AND prove which
 * database we actually reached.
 *
 * This self-verification exists because NEON_DATABASE_URL is a Vercel
 * "Sensitive" variable and cannot be read back by the CLI — so the only place
 * its true target can be established is at runtime.
 */
async function migrationStatus() {
  const id = await q('SELECT current_database() AS db, current_user AS usr');

  // Refuse to treat the Ledsone operational DB as the workflow DB.
  const guard = await q(`
    SELECT to_regclass('google_ads.product_performance') IS NOT NULL AS has_google_ads,
           to_regclass('listings.shopify_listings')      IS NOT NULL AS has_listings`);
  if (guard.rows[0].has_google_ads || guard.rows[0].has_listings) {
    const err = new Error(
      'REQ5_NEON_TARGET_IS_LEDSONE — NEON_DATABASE_URL points at the Ledsone operational database. ' +
      'Req5 refuses to store workflow history there.');
    err.code = 'REQ5_NEON_TARGET_IS_LEDSONE';
    throw err;
  }

  const { rows } = await q(`
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename LIKE 'thivajini_feed%'
     ORDER BY tablename`);
  const present = rows.map((r) => r.tablename);
  const expected = [
    'thivajini_feed_batch',
    'thivajini_feed_generation',
    'thivajini_feed_llm_attempt',
    'thivajini_feed_perf_snapshot',
    'thivajini_feed_provider_model',
    'thivajini_feed_selection',
    'thivajini_feed_term_selection',
    'thivajini_feed_variant',
  ];
  const missing = expected.filter((t) => !present.includes(t));

  // Neighbouring tables tell the operator WHICH Neon database this is.
  const neighbours = await q(`
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename NOT LIKE 'thivajini_feed%'
     ORDER BY tablename LIMIT 25`);

  return {
    applied: missing.length === 0,
    present, missing, expected,
    target: {
      variable: 'NEON_DATABASE_URL',
      current_database: id.rows[0].db,
      current_user: id.rows[0].usr,
      other_public_tables: neighbours.rows.map((r) => r.tablename),
      note: 'Identity is reported so the correct Neon target can be confirmed at runtime — NEON_DATABASE_URL is Sensitive and cannot be read back by the CLI.',
    },
  };
}

// ─── A. batch ───────────────────────────────────────────────────────────────
async function createBatch({ createdBy, notes, cutoffs }) {
  const c = cutoffs || {};
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_batch
      (created_by, notes, ads_perf_cutoff, pmax_terms_cutoff, conventional_terms_cutoff,
       shopify_orders_cutoff, gsc_cutoff, source_cutoffs)
    VALUES ($1,$2,$3::date,$4::date,$5::date,$6::date,$7::date,$8::jsonb)
    RETURNING *`,
    [createdBy, notes || null, c.ads_perf || null, c.pmax_terms || null,
     c.conv_terms || null, c.shopify_orders || null, c.gsc || null,
     JSON.stringify(c)]);
  return rows[0];
}

async function listBatches({ limit = 50 } = {}) {
  const { rows } = await q(
    `SELECT * FROM public.thivajini_feed_batch ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}

async function getBatch(batchId) {
  const { rows } = await q(`SELECT * FROM public.thivajini_feed_batch WHERE batch_id = $1`, [batchId]);
  return rows[0] || null;
}

// ─── B. term selection ──────────────────────────────────────────────────────
async function saveTermSelections({ batchId, itemId, terms, selectedBy }) {
  if (!Array.isArray(terms) || !terms.length) return [];
  const out = [];
  for (const t of terms) {
    const { rows } = await q(`
      INSERT INTO public.thivajini_feed_term_selection
        (batch_id, item_id, search_term, category_label, campaign_id, source_table,
         source_min_date, source_max_date, freshness_status, mapping_level,
         mapping_confidence, metrics_snapshot, is_selected, selected_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::date,$9,$10,$11,$12::jsonb,$13,$14)
      ON CONFLICT (batch_id, COALESCE(item_id,''), search_term, source_table)
      DO UPDATE SET is_selected = EXCLUDED.is_selected,
                    metrics_snapshot = EXCLUDED.metrics_snapshot,
                    freshness_status = EXCLUDED.freshness_status,
                    mapping_level = EXCLUDED.mapping_level,
                    mapping_confidence = EXCLUDED.mapping_confidence,
                    selected_by = EXCLUDED.selected_by,
                    selected_at = now()
      RETURNING *`,
      [batchId, itemId || null, t.search_term, t.category_label || null,
       t.campaign_ids || t.campaign_id || null, t.source_table || 'unknown',
       t.source_min_date || null, t.source_max_date || null,
       t.freshness_status || 'STALE', t.mapping_level || 'CAMPAIGN',
       t.mapping_confidence || 'LOW', JSON.stringify(t.metrics_snapshot || t),
       t.is_selected !== false, selectedBy]);
    out.push(rows[0]);
  }
  return out;
}

async function getTermSelections({ batchId, itemId }) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_term_selection
     WHERE batch_id = $1
       AND ($2::text IS NULL OR item_id = $2::text OR item_id IS NULL)
       AND is_selected = true
     ORDER BY (metrics_snapshot->>'conversions')::numeric DESC NULLS LAST, search_term`,
    [batchId, itemId || null]);
  return rows;
}

// ─── C. generation ──────────────────────────────────────────────────────────
async function nextIteration(itemId) {
  const { rows } = await q(
    `SELECT COALESCE(MAX(iteration_no),0) + 1 AS n
       FROM public.thivajini_feed_generation WHERE item_id = $1`, [itemId]);
  return Number(rows[0].n);
}

async function createGeneration(g) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_generation
      (batch_id, item_id, shopify_product_id, shopify_variant_id, sku, iteration_no,
       input_snapshot, missing_evidence, selected_terms_snapshot, organic_support_snapshot,
       feed_eligible_status, feed_eligible_source, prompt_version, prompt_hash,
       template_version, generation_status, evidence_confidence,
       evidence_confidence_reasons, is_draft_only, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
            $11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20)
    RETURNING *`,
    [g.batchId, g.itemId, g.shopifyProductId || null, g.shopifyVariantId || null,
     g.sku || null, g.iterationNo,
     JSON.stringify(g.inputSnapshot || {}), JSON.stringify(g.missingEvidence || []),
     JSON.stringify(g.selectedTermsSnapshot || []),
     g.organicSupportSnapshot ? JSON.stringify(g.organicSupportSnapshot) : null,
     g.feedEligibleStatus || 'UNKNOWN',
     g.feedEligibleSource || 'NOT_AVAILABLE_IN_LEDSONE_DB',
     g.promptVersion, g.promptHash, g.templateVersion,
     g.generationStatus || 'RUNNING',
     g.evidenceConfidence || null,
     JSON.stringify(g.evidenceConfidenceReasons || []),
     g.isDraftOnly !== false, g.createdBy]);
  return rows[0];
}

async function finishGeneration({ generationId, status, selectedAttemptId }) {
  const { rows } = await q(`
    UPDATE public.thivajini_feed_generation
       SET generation_status = $2,
           selected_attempt_id = COALESCE($3, selected_attempt_id),
           completed_at = now()
     WHERE generation_id = $1
    RETURNING *`, [generationId, status, selectedAttemptId || null]);
  return rows[0];
}

async function listGenerations({ batchId, itemId, limit = 100 }) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_generation
     WHERE ($1::uuid IS NULL OR batch_id = $1::uuid)
       AND ($2::text IS NULL OR item_id = $2::text)
     ORDER BY created_at DESC LIMIT $3`, [batchId || null, itemId || null, limit]);
  return rows;
}

// ─── D. LLM attempt ─────────────────────────────────────────────────────────
/**
 * Persist ONE provider attempt — success or failure. Never deleted.
 * Anything that could carry a secret is dropped before it reaches SQL.
 */
async function recordAttempt(generationId, seq, a) {
  const safeRaw = a.raw_response ? JSON.stringify(a.raw_response) : null;
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_llm_attempt
      (generation_id, attempt_seq, provider, provider_alias, model, model_version,
       started_at, ended_at, latency_ms, status, fallback_reason, http_status,
       http_status_class, provider_request_id, input_tokens, output_tokens,
       total_tokens, cached_tokens, thinking_tokens, token_count_method,
       context_input_limit, output_token_limit, context_utilization_pct,
       context_limit_source, omitted_context, configured_rpm, configured_tpm,
       configured_rpd, quota_limit_source, observed_requests_minute,
       observed_input_tokens_minute, observed_requests_day, retry_after_seconds,
       quota_error_type, raw_response, parsed_response, validation_result,
       response_evidence_confidence, safety_block_reason, vision_used, vision_skip_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33,$34,
            $35::jsonb,$36::jsonb,$37::jsonb,$38,$39,$40,$41)
    RETURNING *`,
    [generationId, seq, a.provider, a.provider_alias, a.model || null,
     a.model_version || null, a.started_at || new Date().toISOString(),
     a.ended_at || null, a.latency_ms || null, a.status, a.fallback_reason || null,
     a.http_status || null, a.http_status_class || null, a.provider_request_id || null,
     a.input_tokens ?? null, a.output_tokens ?? null, a.total_tokens ?? null,
     a.cached_tokens ?? null, a.thinking_tokens ?? null, a.token_count_method || null,
     a.context_input_limit ?? null, a.output_token_limit ?? null,
     a.context_utilization_pct ?? null, a.context_limit_source || null,
     JSON.stringify(a.omitted_context || []),
     a.configured_rpm ?? null, a.configured_tpm ?? null, a.configured_rpd ?? null,
     a.quota_limit_source || 'UNKNOWN',
     a.observed_requests_minute ?? null, a.observed_input_tokens_minute ?? null,
     a.observed_requests_day ?? null, a.retry_after_seconds ?? null,
     a.quota_error_type || null, safeRaw,
     a.parsed_response ? JSON.stringify(a.parsed_response) : null,
     a.validation_result ? JSON.stringify(a.validation_result) : null,
     a.response_evidence_confidence || null, a.safety_block_reason || null,
     a.vision_used === true, a.vision_skip_reason || null]);
  return rows[0];
}

async function listAttempts(generationId) {
  const { rows } = await q(`
    SELECT attempt_id, attempt_seq, provider, provider_alias, model, status,
           fallback_reason, http_status, latency_ms, input_tokens, output_tokens,
           total_tokens, token_count_method, context_input_limit,
           context_utilization_pct, context_limit_source, configured_rpm,
           configured_tpm, configured_rpd, quota_limit_source,
           observed_requests_minute, observed_requests_day, retry_after_seconds,
           quota_error_type, response_evidence_confidence, safety_block_reason,
           vision_used, vision_skip_reason, validation_result, started_at, ended_at
      FROM public.thivajini_feed_llm_attempt
     WHERE generation_id = $1 ORDER BY attempt_seq`, [generationId]);
  return rows;
}

// ─── E. variants ────────────────────────────────────────────────────────────
async function saveVariant(v) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_variant
      (generation_id, attempt_id, variant_label, title_fr, title_char_count,
       description_fr, suggested_gpc, converting_terms_used, uncertain_claims,
       validation_status, validation_details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb)
    RETURNING *`,
    [v.generationId, v.attemptId || null, v.label, v.title, v.titleCharCount,
     v.description, v.suggestedGpc || null,
     JSON.stringify(v.convertingTermsUsed || []),
     JSON.stringify(v.uncertainClaims || []),
     v.validationStatus, JSON.stringify(v.validationDetails || {})]);
  return rows[0];
}

async function listVariants(generationId) {
  const { rows } = await q(
    `SELECT * FROM public.thivajini_feed_variant
      WHERE generation_id = $1 ORDER BY variant_label`, [generationId]);
  return rows;
}

// ─── F. selection / iteration history (append-only) ─────────────────────────
async function addSelection(s) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_selection
      (generation_id, item_id, iteration_no, selected_variant_id, selected_variant_label,
       change_made, reason, result_summary, reviewer, review_status, next_action,
       push_state, push_blocked_reason, test_start_date, selected_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15)
    RETURNING *`,
    [s.generationId, s.itemId, s.iterationNo, s.selectedVariantId || null,
     s.selectedVariantLabel || null, s.changeMade || null, s.reason || null,
     s.resultSummary || null, s.reviewer || null, s.reviewStatus || 'PENDING',
     s.nextAction || null, s.pushState || 'NOT_READY',
     s.pushBlockedReason || null, s.testStartDate || null, s.selectedBy]);
  return rows[0];
}

async function listSelections({ itemId, limit = 200 }) {
  const { rows } = await q(`
    SELECT s.*, v.variant_label, v.title_fr, v.title_char_count
      FROM public.thivajini_feed_selection s
      LEFT JOIN public.thivajini_feed_variant v ON v.variant_id = s.selected_variant_id
     WHERE ($1::text IS NULL OR s.item_id = $1::text)
     ORDER BY s.selected_at DESC LIMIT $2`, [itemId || null, limit]);
  return rows;
}

// ─── G. performance snapshots ───────────────────────────────────────────────
async function savePerfSnapshot(p) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_perf_snapshot
      (generation_id, selection_id, item_id, iteration_no, snapshot_type,
       period_start, period_end, impressions, clicks, ctr, gads_conversions,
       conversion_value, conversion_rate, shopify_conv_orders, shopify_conv_lines,
       shopify_conv_units, shopify_conv_grain_note, source_max_date, source_refs)
    VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::date,$19::jsonb)
    RETURNING *`,
    [p.generationId || null, p.selectionId || null, p.itemId, p.iterationNo || null,
     p.snapshotType, p.periodStart, p.periodEnd, p.impressions ?? null,
     p.clicks ?? null, p.ctr ?? null, p.gadsConversions ?? null,
     p.conversionValue ?? null, p.conversionRate ?? null,
     p.shopifyOrders ?? null, p.shopifyLines ?? null, p.shopifyUnits ?? null,
     p.shopifyGrainNote || null, p.sourceMaxDate || null,
     JSON.stringify(p.sourceRefs || {})]);
  return rows[0];
}

async function listPerfSnapshots({ itemId, limit = 100 }) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_perf_snapshot
     WHERE ($1::text IS NULL OR item_id = $1::text)
     ORDER BY item_id, snapshot_type, period_start DESC LIMIT $2`, [itemId || null, limit]);
  return rows;
}

// ─── H. provider/model capability snapshot ──────────────────────────────────
async function saveProviderModel(m) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_provider_model
      (provider, provider_alias, model, display_name, model_version, supports_text,
       supports_vision, supports_structured_json, input_context_limit,
       output_token_limit, known_rpm, known_tpm, known_rpd, quota_basis,
       limit_source, raw_metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
    RETURNING *`,
    [m.provider, m.provider_alias || null, m.model, m.display_name || null,
     m.model_version || null, m.supports_text ?? null, m.supports_vision ?? null,
     m.supports_structured_json ?? null, m.input_context_limit ?? null,
     m.output_token_limit ?? null, m.known_rpm ?? null, m.known_tpm ?? null,
     m.known_rpd ?? null, m.quota_basis || 'UNKNOWN', m.limit_source || 'UNKNOWN',
     m.raw_metadata ? JSON.stringify(m.raw_metadata) : null]);
  return rows[0];
}

async function latestProviderModels(limit = 20) {
  const { rows } = await q(`
    SELECT DISTINCT ON (provider, COALESCE(provider_alias,''))
           * FROM public.thivajini_feed_provider_model
     ORDER BY provider, COALESCE(provider_alias,''), discovered_at DESC
     LIMIT $1`, [limit]);
  return rows;
}

/** Aggregate telemetry for the admin panel. Application-observed only. */
async function providerTelemetry({ sinceHours = 168 } = {}) {
  const { rows } = await q(`
    SELECT provider_alias, provider, model,
           COUNT(*)::int                                            AS attempts,
           COUNT(*) FILTER (WHERE status = 'SUCCESS')::int           AS successes,
           COUNT(*) FILTER (WHERE status = 'RATE_LIMITED')::int      AS rate_limited,
           COUNT(*) FILTER (WHERE status = 'QUOTA_EXHAUSTED')::int   AS quota_exhausted,
           COUNT(*) FILTER (WHERE status NOT IN ('SUCCESS'))::int    AS failures,
           COALESCE(SUM(input_tokens),0)::bigint                     AS input_tokens,
           COALESCE(SUM(output_tokens),0)::bigint                    AS output_tokens,
           MAX(started_at)                                           AS last_attempt_at,
           MAX(configured_rpm)                                       AS configured_rpm,
           MAX(configured_tpm)                                       AS configured_tpm,
           MAX(configured_rpd)                                       AS configured_rpd
      FROM public.thivajini_feed_llm_attempt
     WHERE started_at > now() - ($1 || ' hours')::interval
     GROUP BY provider_alias, provider, model
     ORDER BY attempts DESC`, [String(sinceHours)]);
  return rows;
}

module.exports = {
  connectionString, getPool, migrationStatus,
  createBatch, listBatches, getBatch,
  saveTermSelections, getTermSelections,
  nextIteration, createGeneration, finishGeneration, listGenerations,
  recordAttempt, listAttempts,
  saveVariant, listVariants,
  addSelection, listSelections,
  savePerfSnapshot, listPerfSnapshots,
  saveProviderModel, latestProviderModels, providerTelemetry,
};

// ═══════════════════════════════════════════════════════════════════════════
// Migration 002 — export events, monitoring plans, push audit
// ═══════════════════════════════════════════════════════════════════════════

// ─── I. export events ───────────────────────────────────────────────────────
async function createExport(e) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_export
      (batch_id, generation_ids, item_ids, variant_ids, selected_columns,
       export_format, row_count, content_sha256, monitoring_start_date,
       monitoring_start_mode, change_method, change_status,
       baseline_snapshot_ids, notes, generated_by)
    VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7,$8,$9::date,$10,$11,$12,$13::jsonb,$14,$15)
    RETURNING *`,
    [e.batchId || null,
     JSON.stringify(e.generationIds || []),
     JSON.stringify(e.itemIds || []),
     JSON.stringify(e.variantIds || []),
     JSON.stringify(e.selectedColumns || []),
     e.exportFormat || 'CSV',
     e.rowCount || 0,
     e.contentSha256 || null,
     e.monitoringStartDate || null,
     e.monitoringStartMode || 'TODAY',
     e.changeMethod || 'CSV_DOWNLOAD',
     e.changeStatus || 'AWAITING_MANUAL_GO_LIVE',
     JSON.stringify(e.baselineSnapshotIds || []),
     e.notes || null,
     e.generatedBy]);
  return rows[0];
}

async function listExports({ batchId, limit = 100 } = {}) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_export
     WHERE ($1::uuid IS NULL OR batch_id = $1::uuid)
     ORDER BY generated_at DESC LIMIT $2`, [batchId || null, limit]);
  return rows;
}

// ─── II. monitoring plans ───────────────────────────────────────────────────
async function createMonitoring(m) {
  const { rows } = await q(`
    INSERT INTO public.thivajini_feed_monitoring
      (export_id, generation_id, selection_id, item_id, selected_variant_id,
       selected_variant_label, change_method, intended_go_live_date,
       monitoring_start_date, baseline_period_start, baseline_period_end,
       minimum_test_days, status, baseline_snapshot_id, monitoring_start_reason, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10::date,$11::date,$12,$13,$14,$15,$16)
    RETURNING *`,
    [m.exportId || null, m.generationId || null, m.selectionId || null, m.itemId,
     m.selectedVariantId || null, m.selectedVariantLabel || null,
     m.changeMethod || 'CSV_DOWNLOAD', m.intendedGoLiveDate || null,
     m.monitoringStartDate, m.baselinePeriodStart || null, m.baselinePeriodEnd || null,
     m.minimumTestDays || 14, m.status || 'AWAITING_MANUAL_GO_LIVE',
     m.baselineSnapshotId || null, m.monitoringStartReason || null, m.createdBy]);
  return rows[0];
}

async function listMonitoring({ itemId, status, limit = 200 } = {}) {
  const { rows } = await q(`
    SELECT m.*, v.title_fr, v.title_char_count,
           g.feed_eligible_status, g.is_draft_only, g.iteration_no
      FROM public.thivajini_feed_monitoring m
      LEFT JOIN public.thivajini_feed_variant    v ON v.variant_id    = m.selected_variant_id
      LEFT JOIN public.thivajini_feed_generation g ON g.generation_id = m.generation_id
     WHERE ($1::text IS NULL OR m.item_id = $1::text)
       AND ($2::text IS NULL OR m.status  = $2::text)
     ORDER BY m.monitoring_start_date DESC, m.created_at DESC
     LIMIT $3`, [itemId || null, status || null, limit]);
  return rows;
}

/**
 * Record a HUMAN confirmation that the change actually went live.
 * A download timestamp is never silently treated as a go-live timestamp,
 * which is why this is a separate, explicit action.
 */
async function confirmMonitoringLive({ monitoringId, actualGoLiveDate, confirmedBy }) {
  const { rows } = await q(`
    UPDATE public.thivajini_feed_monitoring
       SET actual_go_live_date = $2::date,
           confirmed_live_by   = $3,
           status              = 'LIVE_TESTING',
           updated_at          = now()
     WHERE monitoring_id = $1
    RETURNING *`, [monitoringId, actualGoLiveDate, confirmedBy]);
  return rows[0];
}

async function updateMonitoring({ monitoringId, status, baselineSnapshotId, latestPostChangeSnapshotId }) {
  const { rows } = await q(`
    UPDATE public.thivajini_feed_monitoring
       SET status = COALESCE($2, status),
           baseline_snapshot_id = COALESCE($3, baseline_snapshot_id),
           latest_post_change_snapshot_id = COALESCE($4, latest_post_change_snapshot_id),
           updated_at = now()
     WHERE monitoring_id = $1
    RETURNING *`, [monitoringId, status || null, baselineSnapshotId || null, latestPostChangeSnapshotId || null]);
  return rows[0];
}

/** Plans whose monitoring window has opened but which still have no baseline. */
async function dueMonitoring(todayIso) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_monitoring
     WHERE status = 'SCHEDULED'
       AND monitoring_start_date <= $1::date
     ORDER BY monitoring_start_date
     LIMIT 50`, [todayIso]);
  return rows;
}

// ─── III. push audit (reserved — no code path writes here yet) ──────────────
async function listPushes({ itemId, limit = 100 } = {}) {
  const { rows } = await q(`
    SELECT * FROM public.thivajini_feed_push
     WHERE ($1::text IS NULL OR item_id = $1::text)
     ORDER BY created_at DESC LIMIT $2`, [itemId || null, limit]);
  return rows;
}

module.exports.createExport = createExport;
module.exports.listExports = listExports;
module.exports.createMonitoring = createMonitoring;
module.exports.listMonitoring = listMonitoring;
module.exports.confirmMonitoringLive = confirmMonitoringLive;
module.exports.updateMonitoring = updateMonitoring;
module.exports.dueMonitoring = dueMonitoring;
module.exports.listPushes = listPushes;
