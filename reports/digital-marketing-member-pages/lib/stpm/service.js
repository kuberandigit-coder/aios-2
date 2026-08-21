'use strict';

// lib/stpm/service.js
//
// REQ-DM-2026-08-MAHI01 — run orchestration.
//
// THE PIPELINE
//   authenticate (router) -> validate input -> Ledsone read -> 7->14 fallback
//   -> metrics + status + rules -> Shopify catalogue -> product match
//   -> opportunity evidence -> write immutable snapshot to DILAIKSHAN_NEON_DB
//   -> return summary
//
// PERSISTENCE IS PART OF SUCCESS, NOT A SIDE EFFECT.
//   If processing works but the Neon write fails, the run is reported as
//   FAILED. History and audit are requirements here, so a run that cannot be
//   stored has not actually happened as far as the operator is concerned —
//   pretending otherwise would leave them looking at numbers they can never
//   reopen or review.
//
// COST CONTROL
//   The Shopify catalogue is fetched and normalized ONCE per run, then reused
//   for every term. Matching a term is an indexed lookup, not a sweep over
//   2,585 products x five text fields.

const cfg = require('./config');
const sql = require('./sql');
const repo = require('./repo');
const src = require('./source');
const metrics = require('./metrics');
const rules = require('./rules');
const matching = require('./matching');
const targeting = require('./targeting');
const { normalizeSearchTerm } = require('./normalize');

/** Campaign list + freshness + supported controls, for the run panel. */
async function getMetadata() {
  const [campaigns, freshness, catalogue] = await Promise.all([
    sql.fetchMahimaCampaigns(),
    sql.fetchSourceFreshness(),
    sql.fetchCatalogueCutoff(),
  ]);

  return {
    requirement_id: cfg.REQUIREMENT_ID,
    group_name: cfg.MAHIMA.GROUP_NAME,
    account_id: cfg.MAHIMA.ACCOUNT_ID,
    currency: cfg.MAHIMA.CURRENCY,
    campaigns,
    freshness,
    catalogue: { products: catalogue.products, cutoff: catalogue.cutoff },
    date_controls: {
      current: [
        { key: 'last7', label: `Last ${cfg.DATE_RULE.DEFAULT_DAYS} Days`, default: true },
        { key: 'custom', label: 'Custom' },
      ],
      historical: [
        { key: 'prev30', label: `Previous ${cfg.DATE_RULE.HISTORICAL_PREV30} Days`, default: true },
        { key: 'prev60', label: `Previous ${cfg.DATE_RULE.HISTORICAL_PREV60} Days` },
        { key: 'custom', label: 'Custom' },
      ],
      fallback_days: cfg.DATE_RULE.FALLBACK_DAYS,
    },
    versions: {
      rule: cfg.RULE_VERSION,
      matching: cfg.MATCHING_VERSION,
      intent: cfg.INTENT_VERSION,
      canonical_source_rule: cfg.CANONICAL_SOURCE_RULE,
    },
  };
}

/**
 * Execute a full run.
 * @param {object} input { campaign_ids[], current:{preset,start,end}, historical:{...}, idempotency_key }
 * @param {object} session verified session; identity comes from here, never the body
 */
async function runNow(input, session) {
  const actor = String(session.username || session.staff_key || 'unknown').slice(0, 120);
  const today = new Date();

  // ── 1. Validate ─────────────────────────────────────────────────────────
  const requested = src.resolveRequestedWindow(input.current, today);
  const historical = src.resolveHistoricalWindow(input.historical, requested.start);

  // Campaign scope: only Mahima campaigns, verified against Ledsone. A caller
  // cannot analyse another team's campaigns by passing their ids.
  let campaignIds = null;
  const allCampaigns = await sql.fetchMahimaCampaigns();
  const allIds = allCampaigns.map((c) => c.campaign_id);

  if (Array.isArray(input.campaign_ids) && input.campaign_ids.length > 0) {
    const asked = input.campaign_ids
      .map((x) => String(x).trim())
      .filter((x) => /^\d{1,19}$/.test(x));
    if (asked.length === 0) {
      const e = new Error('No valid campaign IDs were provided.');
      e.status = 400; e.code = 'STPM_INVALID_CAMPAIGNS';
      throw e;
    }
    const allowed = await sql.assertCampaignsBelongToMahima(asked);
    if (allowed.length === 0) {
      const e = new Error('None of the selected campaigns belong to the Mahima group.');
      e.status = 403; e.code = 'STPM_CAMPAIGNS_NOT_PERMITTED';
      throw e;
    }
    campaignIds = allowed;
  } else {
    campaignIds = allIds;
  }

  // ── 2. Idempotency ──────────────────────────────────────────────────────
  if (input.idempotency_key) {
    const existing = await repo.findRunByIdempotencyKey(String(input.idempotency_key).slice(0, 200));
    if (existing) return { run: existing, reused: true };
  }

  // ── 3. Fallback probe against Ledsone ───────────────────────────────────
  const freshness = await sql.fetchSourceFreshness();

  const probe = async (start, end) => {
    const rows = await sql.fetchSearchTerms(start, end, campaignIds);
    probe.lastRows = rows;
    return rows.length;
  };

  const applied = await src.applyDateFallback(requested, today, probe);
  const sourceRows = probe.lastRows || [];

  // ── 4. Open the run row ─────────────────────────────────────────────────
  const catalogueMeta = await sql.fetchCatalogueCutoff();

  const run = await repo.createRun({
    requirement_id: cfg.REQUIREMENT_ID,
    created_by: actor,
    requested_start: requested.start,
    requested_end: requested.end,
    requested_preset: requested.preset,
    actual_start: applied.start,
    actual_end: applied.end,
    fallback_used: applied.fallback_used,
    fallback_days: applied.fallback_days,
    fallback_reason: applied.fallback_reason,
    historical_start: historical.start,
    historical_end: historical.end,
    historical_preset: historical.preset,
    latest_search_term_source_date: freshness.search_term,
    latest_pmax_term_source_date: freshness.pmax_term,
    latest_campaign_source_date: freshness.campaign_perf,
    shopify_catalogue_cutoff: catalogueMeta.cutoff,
    campaign_ids: campaignIds,
    campaigns_selected: campaignIds.length,
    rule_version: cfg.RULE_VERSION,
    matching_version: cfg.MATCHING_VERSION,
    canonical_source_rule: cfg.CANONICAL_SOURCE_RULE,
    idempotency_key: input.idempotency_key ? String(input.idempotency_key).slice(0, 200) : null,
  });

  try {
    // ── 5. Aggregate current period ───────────────────────────────────────
    const current = metrics.aggregateByTermCampaign(sourceRows, { normalize: normalizeSearchTerm });

    // ── 6. Historical lookup ──────────────────────────────────────────────
    // Keyed on (normalized term + campaign) — the maximum grain available
    // across both canonical sources, and the key that stops an unrelated
    // campaign's history contaminating this one.
    const histRows = historical.start && historical.end
      ? await sql.fetchHistoricalTerms(historical.start, historical.end, campaignIds)
      : [];
    const histIndex = new Map();
    for (const h of histRows) {
      const key = normalizeSearchTerm(h.search_term) + ' ' + String(h.campaign_id);
      const prev = histIndex.get(key);
      const rec = {
        conversions: Number(h.conversions) || 0,
        clicks: Number(h.clicks) || 0,
        cost: h.cost === null ? null : Number(h.cost),
        conversion_value: h.conversion_value === null ? null : Number(h.conversion_value),
      };
      if (prev) {
        prev.conversions += rec.conversions;
        prev.clicks += rec.clicks;
        if (rec.cost !== null) prev.cost = (prev.cost || 0) + rec.cost;
        if (rec.conversion_value !== null) prev.conversion_value = (prev.conversion_value || 0) + rec.conversion_value;
      } else {
        histIndex.set(key, rec);
      }
    }

    // ── 7. Catalogue + targeting, once per run ────────────────────────────
    const [catalogue, targetingRows, servedProducts] = await Promise.all([
      sql.fetchShopifyCatalogue(),
      sql.fetchTargetingEvidence(campaignIds),
      sql.fetchServedProducts(applied.start, applied.end, campaignIds),
    ]);
    const productIndex = matching.buildProductIndex(catalogue);
    const targetIndex = targeting.buildTargetingIndex(targetingRows, servedProducts);

    // ── 8. Per-term evaluation ────────────────────────────────────────────
    const results = [];
    for (const row of current) {
      const key = row.search_term_normalized + ' ' + (row.campaign_id || '');
      const hist = histIndex.get(key) || { conversions: 0, clicks: 0, cost: null, conversion_value: null };

      const performance_status = rules.performanceStatus(row.conversions, hist.conversions);
      const { fired, intent } = rules.evaluateWasteRules(row);

      // Product matching runs for every term so the mapping columns are
      // populated across the table, not only for converting terms — the
      // dashboard's product filter would be useless otherwise.
      const match = matching.matchTerm(row.search_term_normalized, productIndex);

      const opportunity = targeting.evaluateOpportunity({
        row,
        normalizedTerm: row.search_term_normalized,
        index: targetIndex,
        match,
        intentLabel: intent.label,
      });

      const decided = rules.decide({ fired, performance_status, opportunity });

      const flags = (match.data_quality_flags || []).slice();
      if (row.cost === null) flags.push({ code: 'cost_missing', field: 'Cost' });
      if (intent.confidence === 'limited') {
        flags.push({ code: 'intent_coverage_limited', field: 'Intent', note: intent.coverage_note });
      }

      results.push({
        search_term: row.search_term,
        search_term_normalized: row.search_term_normalized,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        campaign_type: row.campaign_type,
        source_table: row.source_table,
        source_start: row.source_start,
        source_end: row.source_end,
        clicks: row.clicks,
        impressions: row.impressions,
        cost: row.cost,
        conversions: row.conversions,
        conversion_value: row.conversion_value,
        ctr: row.ctr,
        roas: row.roas,
        historical_conversions: hist.conversions,
        historical_cost: hist.cost,
        historical_conversion_value: hist.conversion_value,
        historical_clicks: hist.clicks,
        performance_status,
        waste_reasons: fired,
        waste_reason_summary: rules.wasteReasonSummary(fired),
        decision: decided.decision,
        decision_basis: decided.decision_basis,
        negative_keyword_recommended: decided.negative_keyword_recommended,
        keyword_opportunity: opportunity.keyword_opportunity,
        opportunity_candidate: opportunity.opportunity_candidate,
        opportunity_reason: opportunity.opportunity_reason,
        targeting_evidence: opportunity.targeting_evidence,
        intent_label: intent.label,
        intent_confidence: intent.confidence,
        intent_evidence: { matches: intent.matches, note: intent.coverage_note, version: intent.version },
        product_id: match.product_id,
        product_title: match.product_title,
        product_url: match.product_url,
        product_handle: match.product_handle,
        match_type: match.match_type,
        match_score: match.match_score,
        match_source: match.match_source,
        match_evidence: match.match_evidence,
        runner_up_score: match.runner_up_score,
        mapping_status: match.mapping_status,
        mapping_reason: match.mapping_reason,
        data_quality_flags: flags,
      });
    }

    // ── 9. Health + totals ────────────────────────────────────────────────
    const coverage = await sql.fetchCampaignCoverage(applied.start, applied.end, campaignIds);
    const health = src.buildSourceHealth({
      freshness, window: applied, requested, fallback: applied, coverage, rowCount: results.length,
    });

    const totals = metrics.summarize(results);
    const histTotals = results.reduce((t, r) => {
      t.conversions += Number(r.historical_conversions) || 0;
      if (r.historical_cost !== null && r.historical_cost !== undefined) t.cost = (t.cost || 0) + Number(r.historical_cost);
      if (r.historical_conversion_value !== null && r.historical_conversion_value !== undefined) {
        t.value = (t.value || 0) + Number(r.historical_conversion_value);
      }
      return t;
    }, { conversions: 0, cost: null, value: null });

    // ── 10. Persist the immutable snapshot ────────────────────────────────
    await repo.insertResults(run.run_id, results);

    const completed = await repo.completeRun(run.run_id, {
      status: health.health === cfg.SOURCE_HEALTH.HEALTHY ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
      status_detail: applied.fallback_reason || null,
      source_health: health.health,
      source_warnings: health.warnings,
      campaigns_with_data: health.campaigns_with_data,
      campaigns_stale: health.campaigns_stale,
      row_count: results.length,
      negative_candidate_count: results.filter((r) => r.negative_keyword_recommended).length,
      opportunity_count: results.filter((r) => r.keyword_opportunity || r.opportunity_candidate).length,
      product_match_count: results.filter((r) => r.product_id).length,
      total_clicks: totals.clicks,
      total_impressions: totals.impressions,
      total_cost: totals.cost,
      total_conversions: totals.conversions,
      total_conversion_value: totals.conversion_value,
      historical_conversions_total: metrics.round(histTotals.conversions, 2),
      historical_cost_total: metrics.round(histTotals.cost, 2),
      historical_conversion_value_total: metrics.round(histTotals.value, 2),
    });

    return { run: completed, reused: false, health, catalogue_products: productIndex.productCount };
  } catch (err) {
    await repo.failRun(run.run_id, err.code || 'STPM_RUN_FAILED', safeMessage(err));
    throw err;
  }
}

/** Never leak SQL text or a connection string into stored/returned text. */
function safeMessage(err) {
  const raw = String(err && err.message ? err.message : err);
  return raw.replace(/postgres(ql)?:\/\/[^\s'"]+/gi, '[redacted]').slice(0, 500);
}

async function listRuns(limit) {
  return repo.listRuns(limit || 10);
}

/** Run detail = the STORED snapshot. Never recomputed from today's Ledsone. */
async function getRunDetail(runId, opts) {
  const run = await repo.getRun(runId);
  if (!run) {
    const e = new Error('Run not found.');
    e.status = 404; e.code = 'STPM_RUN_NOT_FOUND';
    throw e;
  }
  const results = await repo.listResults(runId, opts || {});
  return { run, results };
}

async function setReview(a) {
  return repo.setReviewStatus(a);
}

module.exports = { getMetadata, runNow, listRuns, getRunDetail, setReview, safeMessage };
