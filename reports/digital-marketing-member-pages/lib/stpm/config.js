'use strict';

// lib/stpm/config.js
//
// REQ-DM-2026-08-MAHI01 — Mahima "Search Term -> Product Mapping" (STPM).
//
// Single place for the identity constants, versioned thresholds and the two
// database bindings. Everything here was proven against live data during the
// two discovery passes; see
//   03_DISCOVERY/2026-08-21_dilaikshan_DM-2026-08-MAHI01_search-term-product-mapping-discovery.md
//   07_EVIDENCE/2026-08-21_dilaikshan_DM-2026-08-MAHI01_sql-evidence.md
//
// WHY helpers live in lib/ and not api/lib/
//   Vercel turns EVERY file under api/ into its own Serverless Function. The
//   project deploys exactly 12 — the Hobby-plan ceiling, verified live in the
//   deployment's lambdaRuntimeStats. Adding modules under api/ would request
//   more functions and fail the build. Root-level lib/ is traced into the
//   calling function instead. lib/ must never be added to .vercelignore.

// ─────────────────────────────────────────────────────────────────────────────
// Driver-level date handling — applied once, for every STPM pool
// ─────────────────────────────────────────────────────────────────────────────
// A Postgres `date` has no time zone. By default `pg` turns it into a JS Date
// at LOCAL midnight, so any later `toISOString()` shifts it backwards in any
// timezone east of UTC — this machine is UTC+05:30, and a run for
// 2026-06-01..2026-06-30 was being reported and filenamed as
// 2026-05-31..2026-06-29.
//
// Parsing DATE (oid 1082) as the raw 'YYYY-MM-DD' string Postgres already sent
// removes the whole class of bug: the value stays a plain date all the way to
// JSON and to the browser. TIMESTAMPTZ is deliberately left alone — those are
// real instants and should keep their Date semantics.
require('pg').types.setTypeParser(1082, (v) => v);

const REQUIREMENT_ID = 'DM-2026-08-MAHI01';

// Versioned so two runs that disagree can be told apart: a rule change looks
// different from a data change.
const RULE_VERSION = 'stpm-rules-1.0.0';
const MATCHING_VERSION = 'stpm-match-1.0.0';
const INTENT_VERSION = 'stpm-intent-1.0.0';

// The canonical source rule, recorded on every run so stored numbers stay
// explainable. Proven in the full-LEDSONE audit: the 'Performance Max' rows
// inside campaign_search_term_data are PMax *insight/category* rows (100% carry
// insight_id, 0% carry ad_group_id, cost is NULL by design). Unioning them with
// the real metric rows inflated the dataset ~14.9x.
const CANONICAL_SOURCE_RULE =
  "campaign_search_term_data WHERE insight_id IS NULL UNION ALL pmax_campaign_search_term_data";

// ─────────────────────────────────────────────────────────────────────────────
// Mahima identity — proven, not assumed
// ─────────────────────────────────────────────────────────────────────────────
// campaigns.group_name = 'Mahima' -> 16 campaigns, all in account 9031058245
// (ledsone.de, EUR, DE), whose accounts.sub_source_id = 108 is the same
// sub_source that identifies the German Shopify catalogue.
const MAHIMA = Object.freeze({
  GROUP_NAME: 'Mahima',
  ACCOUNT_ID: '9031058245',
  SHOPIFY_SUB_SOURCE: 108,
  SHOPIFY_DOMAIN: 'https://ledsone.de',
  CURRENCY: 'EUR',
  CURRENCY_SYMBOL: '€',
});

// ─────────────────────────────────────────────────────────────────────────────
// Business thresholds — reproduced EXACTLY as written in the requirement (§5/§6)
// ─────────────────────────────────────────────────────────────────────────────
// BLOS governance: these are declared here rather than inlined in the evaluator
// so they are visible, reviewable and replaceable. Comparison operators are
// strict (>, <) exactly as the requirement states them. Do NOT relax > to >=.
const THRESHOLDS = Object.freeze({
  HIGH_CLICKS: 15,       // Rule 1: Clicks > 15  AND Conversions = 0
  HIGH_COST: 10,         // Rule 2: Cost   > E10 AND Conversions = 0
  LOW_CTR_IMPRESSIONS: 500, // Rule 3: Impressions > 500 AND ...
  LOW_CTR_PCT: 0.5,      // Rule 3: ... CTR < 0.5%
  POOR_ROAS: 1,          // Rule 4: Conversions > 0 AND ROAS < 1
});

// The ONLY values the Decision field may ever take.
const DECISION = Object.freeze({
  NEGATIVE: 'Negative Keyword',
  KEEP: 'Keep',
  OPPORTUNITY: 'Keyword Opportunity',
});
const DECISION_VALUES = Object.freeze(Object.values(DECISION));

// Human review — never set by the automated pipeline.
const REVIEW = Object.freeze({ PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' });
const REVIEW_VALUES = Object.freeze(Object.values(REVIEW));

const PERFORMANCE_STATUS = Object.freeze({
  WORKING: 'Working',
  DROPPED: 'Dropped',
  NO_CONVERSIONS: 'No Conversions',
});

const MATCH_TYPE = Object.freeze({ EXACT: 'Exact', PHRASE: 'Phrase', NONE: 'No Match' });
const MAPPING_STATUS = Object.freeze({
  AUTO: 'Auto Matched',
  MANUAL: 'Manual Review',
  NONE: 'No Match',
});

// Shopify evidence fields, in the requirement's exact priority order (§3).
// `weight` only orders candidates within the deterministic ranking; it is NOT a
// business-approved confidence and must never be presented as a probability.
const MATCH_SOURCES = Object.freeze([
  { key: 'title', label: 'Product Title', weight: 100 },
  { key: 'tag', label: 'Tags', weight: 80 },
  { key: 'meta_title', label: 'Meta Title', weight: 60 },
  { key: 'meta_description', label: 'Meta Description', weight: 40 },
  { key: 'description', label: 'Product Description', weight: 20 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// Date rule (approved)
// ─────────────────────────────────────────────────────────────────────────────
// Default is Last 7 Days. If that yields zero usable rows, retry Last 14 Days
// once and label the result honestly. Never extend further automatically; a
// user-selected custom range is never silently altered.
const DATE_RULE = Object.freeze({
  DEFAULT_DAYS: 7,
  FALLBACK_DAYS: 14,
  HISTORICAL_PREV30: 30,
  HISTORICAL_PREV60: 60,
});

const SOURCE_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  FALLBACK: 'fallback',
  STALE: 'stale_ingestion',
  NO_DATA: 'no_data',
});

// ─────────────────────────────────────────────────────────────────────────────
// Database bindings — NO FALLBACK CHAINS, deliberately
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE.md §10 finding 4 records the defect class this avoids: an
// implicit `A || B` chain can silently point writes at a different database.
// Thivajini Req5 was corrected for exactly this on 2026-08-20. Missing config
// must fail loudly instead.
//
//   Ledsone (READ-ONLY, current business truth)  <- DATABASE_URL
//   STPM run history / review (READ-WRITE)       <- DILAIKSHAN_NEON_DB
const ERRORS = Object.freeze({
  LEDSONE_MISSING: 'STPM_LEDSONE_DATABASE_URL_MISSING',
  APP_MISSING: 'STPM_APP_DATABASE_URL_MISSING',
  APP_IS_LEDSONE: 'STPM_APP_TARGET_IS_LEDSONE',
  MIGRATION_MISSING: 'STPM_MIGRATION_NOT_APPLIED',
});

function ledsoneUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const e = new Error('Ledsone database is not configured.');
    e.code = ERRORS.LEDSONE_MISSING;
    e.status = 503;
    throw e;
  }
  return url;
}

function appUrl() {
  // DILAIKSHAN_NEON_DB and nothing else. Never AUTH_DATABASE_URL,
  // NEON_DATABASE_URL, FEED_TRACKER_DB_URL or DATABASE_URL.
  const url = process.env.DILAIKSHAN_NEON_DB;
  if (!url) {
    const e = new Error('Run history database is not configured.');
    e.code = ERRORS.APP_MISSING;
    e.status = 503;
    throw e;
  }
  return url;
}

module.exports = {
  REQUIREMENT_ID,
  RULE_VERSION,
  MATCHING_VERSION,
  INTENT_VERSION,
  CANONICAL_SOURCE_RULE,
  MAHIMA,
  THRESHOLDS,
  DECISION,
  DECISION_VALUES,
  REVIEW,
  REVIEW_VALUES,
  PERFORMANCE_STATUS,
  MATCH_TYPE,
  MAPPING_STATUS,
  MATCH_SOURCES,
  DATE_RULE,
  SOURCE_HEALTH,
  ERRORS,
  ledsoneUrl,
  appUrl,
};
