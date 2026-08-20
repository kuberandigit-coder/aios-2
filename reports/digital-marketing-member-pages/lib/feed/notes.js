// lib/feed/notes.js
//
// The shared, dependency-free vocabulary of what this feature does NOT know.
//
// Every string here corresponds to a verified finding from the discovery and
// the exhaustive Ledsone DB audit. They are surfaced in the API responses AND
// rendered in the UI, so a reviewer can never see a generated variant without
// also seeing the limits of the evidence behind it.
//
// This module deliberately requires nothing — no `pg`, no network — so the
// rules can be unit-tested and reused anywhere.

'use strict';

const KNOWN_GAPS = {
  feed_eligible:
    'UNKNOWN / NOT VERIFIED — Ledsone DB has no France Merchant eligibility source. Never treated as Y.',
  paid_terms_freshness:
    'FR paid converting search terms are STALE (PMax to 2026-06-30, conventional to 2026-07-06). Not "latest 30-day" terms.',
  exact_attribution:
    'Exact search-term → product attribution is NOT AVAILABLE. Terms map at campaign or search-category level only.',
  keyword_planner:
    'NOT AVAILABLE in Ledsone DB. No volume data is shown or generated.',
  intent_type:
    'NOT STORED in Ledsone DB. Any future classification will be labelled DERIVED with method/version.',
  attribution_adjusted_verdict:
    'NOT IMPLEMENTED / AWAITING APPROVAL — the documented x2.9 adjustment is not applied.',
  technical_specs:
    'Only Component SOT values are used. ~4.5% of FR ad-active SKUs have any verified spec. Nothing is inferred from title, description or image.',
  days_live:
    'Displayed as a NUMBER of days (documented workbook display defect corrected here).',
};

const CONFLICT_NOTE =
  'The two FR search-term tables OVERLAP AND DISAGREE (4,873 common keys, 100 with different metrics, ' +
  'conversions 8.00 vs 3.00 for the same June period). Rows are deduped on (campaign_id, date, search_term) ' +
  'preferring campaign_search_term_data ONLY because it alone carries insight_id for the search category. ' +
  'That is a traceability choice, not a ruling on which table is correct. Precedence remains a business decision.';

const VERDICT_NOTE =
  'Verdict uses the workbook formula as currently built: raw Google Ads conversion rates with a 14-day minimum. ' +
  'Attribution-adjusted verdict (GAds x2.9 floored by Shopify actuals) is NOT IMPLEMENTED / AWAITING APPROVAL.';

const QUOTA_NOTE =
  'Gemini RPM/TPM/RPD are recorded as UNKNOWN unless the provider returned them in a 429 payload or a human ' +
  'supplied them. Quota is commonly PROJECT-level, so GEMINI_API_KEY_1 and GEMINI_API_KEY_2 must NOT be assumed ' +
  'to have independent allowances. Generation runs sequentially until real limits are confirmed.';

const ATTRIBUTION_NOTE =
  'Exact search-term → product attribution does NOT exist in Ledsone DB. Terms are attributed at CAMPAIGN level, ' +
  'or at SEARCH-CATEGORY level where campaign_search_term_insights supplies a category_label.';

const ORGANIC_NOTE =
  'ORGANIC Google Search Console evidence. No conversion metric exists. Never a paid converting term.';

const PUSH_BLOCKED_UNVERIFIED =
  'Feed eligibility not verified for France (no Merchant status source in Ledsone DB) — production push blocked.';

const PUSH_BLOCKED_NO_TARGET =
  'Production push target/approval not configured.';

/**
 * Freshness verdict for the FR paid search-term evidence.
 * Pure function — no I/O — so it is directly unit-testable.
 *
 * @param {{pmax_terms?:string, conv_terms?:string}} cutoffs MAX(date) per source
 * @param {string} todayIso e.g. '2026-08-20'
 */
function termsFreshness(cutoffs, todayIso) {
  const c = cutoffs || {};
  const latest = [c.pmax_terms, c.conv_terms].filter(Boolean).sort().pop() || null;
  if (!latest) {
    return {
      latest: null, days_behind: null, status: 'UNKNOWN',
      pmax_latest: c.pmax_terms || null,
      conventional_latest: c.conv_terms || null,
      note: 'No FR paid search-term rows found at all.',
    };
  }
  const days = Math.round(
    (Date.parse(todayIso + 'T00:00:00Z') - Date.parse(String(latest).slice(0, 10) + 'T00:00:00Z')) / 86400000);
  return {
    latest: String(latest).slice(0, 10),
    days_behind: days,
    status: days > 35 ? 'STALE' : 'CURRENT',
    pmax_latest: c.pmax_terms ? String(c.pmax_terms).slice(0, 10) : null,
    conventional_latest: c.conv_terms ? String(c.conv_terms).slice(0, 10) : null,
    note: days > 35
      ? `Latest FR paid search-term data is ${String(latest).slice(0, 10)} (${days} days old). ` +
        'These are NOT "latest 30-day converting terms".'
      : `Latest FR paid search-term data is ${String(latest).slice(0, 10)}.`,
  };
}

module.exports = {
  KNOWN_GAPS,
  CONFLICT_NOTE,
  VERDICT_NOTE,
  QUOTA_NOTE,
  ATTRIBUTION_NOTE,
  ORGANIC_NOTE,
  PUSH_BLOCKED_UNVERIFIED,
  PUSH_BLOCKED_NO_TARGET,
  termsFreshness,
};
