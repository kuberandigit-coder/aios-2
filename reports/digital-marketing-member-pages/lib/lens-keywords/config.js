'use strict';

// lib/lens-keywords/config.js
//
// REQ-DM-2026-08-SAJE01 — Automation Keyword Finder, Phase 1 (Sajeepan).
//
// Single place for identity constants, limits and the two database bindings.
// Everything here was proven against live data during the 2026-08-24 discovery
// pass; see
//   03_DISCOVERY/2026-08-24_dilaikshan_DM-2026-08-SAJE01_google-lens-keyword-discovery.md
//   07_EVIDENCE/2026-08-24_dilaikshan_DM-2026-08-SAJE01_sql-evidence.md
//
// WHY helpers live in lib/ and not api/lib/
//   Vercel turns EVERY file under api/ into its own Serverless Function. This
//   project deploys exactly 12 — the Hobby-plan ceiling. Root-level lib/ is
//   traced into the calling function instead. lib/ must never be added to
//   .vercelignore. See lib/stpm/config.js for the identical precedent.

// ─────────────────────────────────────────────────────────────────────────────
// Driver-level date handling — same fix as lib/stpm/config.js, applied once.
// A Postgres `date` defaults to a JS Date at LOCAL midnight; parsing it as the
// raw string instead removes a whole class of off-by-one-day bug.
// ─────────────────────────────────────────────────────────────────────────────
require('pg').types.setTypeParser(1082, (v) => v);

const REQUIREMENT_ID = 'DM-2026-08-SAJE01';

const RUN_VERSION = 'lens-keywords-phase1-1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Sajeepan identity — proven live 2026-08-24, not assumed.
// google_ads.campaigns.group_name = 'SAJEEPAN' -> 30 campaigns, all in account
// 4503486236 ("LEDSone", GBP, UK, sub_source_id=104).
// ─────────────────────────────────────────────────────────────────────────────
const SAJEEPAN = Object.freeze({
  GROUP_NAME: 'SAJEEPAN',
  ACCOUNT_ID: '4503486236',
  SHOPIFY_SITE: 'UK',
  SHOPIFY_SUB_SOURCE: 104,
  CURRENCY: 'GBP',
});

// ─────────────────────────────────────────────────────────────────────────────
// Automation limits — hard server-side, not just a frontend cap.
// Superseded 2026-08-24: the original 15-product manual-inspection limit is
// replaced by a 50-product fully-automatic weekly workflow. The number itself
// is unchanged in spirit (a hard ceiling protecting SerpAPI quota) — only the
// value and the surrounding workflow (auto-select, no manual gate) changed.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_PRODUCTS_PER_RUN = 50;
const SEARCHES_PER_PRODUCT = 1; // one Lens search per eligible product, no auto-repeat

// ─────────────────────────────────────────────────────────────────────────────
// Search evidence cache (§24-27) — the mechanism that makes a 50-product
// WEEKLY run affordable on two free 250/month SerpAPI accounts. A fresh cache
// hit costs zero external searches.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_DAYS = 28;
const QUOTA_RESERVE = 50; // never let automatic consumption run the account to zero

// ─────────────────────────────────────────────────────────────────────────────
// Bounded concurrency for batch automation — never an uncontrolled 50-way burst.
// ─────────────────────────────────────────────────────────────────────────────
const SERPAPI_CONCURRENCY = 2;
const GENERATION_CONCURRENCY = 2;

// A cron invocation must persist progress and return well before the
// platform's function timeout (members-api.js maxDuration=300s in vercel.json).
const MAX_CRON_WORK_MS = 230000;

// Product completeness score weights (§8) — transparent, not opaque; sum to 100.
const SELECTION_WEIGHTS = Object.freeze({
  SAME_SKU_IDENTITY: 30,
  VALID_IMAGE: 20,
  MEANINGFUL_TITLE: 15,
  VALID_URL: 10,
  ATTRIBUTE_EVIDENCE: 15,
  EXISTING_ADS_EVIDENCE: 10,
});

// Competitor relevance score weights (§15) — normalized to 100%.
const RELEVANCE_WEIGHTS = Object.freeze({
  LENS_RANK: 0.35,
  PRODUCT_TYPE_OVERLAP: 0.30,
  TITLE_TOKEN_OVERLAP: 0.20,
  ATTRIBUTE_COMPATIBILITY: 0.10,
  RESULT_COMPLETENESS: 0.05,
});

// A competitor scoring below this (0-100) is AUTO_EXCLUDED_IRRELEVANT.
// Tunable business value kept visible here, never buried in the scorer.
const RELEVANCE_THRESHOLD = 45;
// Target band per §15: aim for 10-15 accepted competitors per SKU. The cap is
// hard; the lower bound is NOT forced — a product with only 4 genuinely
// relevant matches keeps 4 rather than padding with irrelevant ones.
const MAX_COMPETITORS_PER_PRODUCT = 15;

const AUTO_DECISION = Object.freeze({
  INCLUDED: 'AUTO_INCLUDED',
  EXCLUDED_SELF: 'AUTO_EXCLUDED_SELF',
  EXCLUDED_DUPLICATE: 'AUTO_EXCLUDED_DUPLICATE',
  EXCLUDED_MISSING_DATA: 'AUTO_EXCLUDED_MISSING_DATA',
  EXCLUDED_IRRELEVANT: 'AUTO_EXCLUDED_IRRELEVANT',
  EXCLUDED_ATTRIBUTE_CONFLICT: 'AUTO_EXCLUDED_ATTRIBUTE_CONFLICT',
});

const GENERATION_SOURCE = Object.freeze({
  GEMMA_4_31B: 'GEMMA_4_31B',
  GEMMA_4_26B: 'GEMMA_4_26B',
  SCRIPT_FALLBACK: 'SCRIPT_FALLBACK',
});

// Gemma/Gemini env var NAMES only — precedence per §32. Never assigned to a
// module-level constant value, same discipline as SERPAPI_KEY_SLOTS.
const GEMMA_KEY_ENV = Object.freeze(['GOOGLE_API_KEY_GLSK', 'GEMINI_API_KEY']);

function gemmaKey(envName) {
  return GEMMA_KEY_ENV.includes(envName) ? (process.env[envName] || null) : null;
}

const WEEKLY = Object.freeze({
  CRON_SCHEDULE: '0 1 * * 1',       // Monday 01:00 UTC — Vercel Cron is always UTC
  CONTINUATION_SCHEDULE: '0 4 * * *', // daily — resumes an in-progress weekly run only
  TIMEZONE_NOTE: 'Vercel Cron schedules are evaluated in UTC.',
});

// Default Lens search parameters. Country stays 'ca' (Canada) per the
// requirement's explicit "search using Canada VPN" instruction; SerpAPI's
// `country` parameter sets Google's search context, which is the only proven
// mechanism available here — actual network-egress-country proof is a
// separate, still-unresolved requirement (discovery report §R). Do not claim
// Canada compliance from this parameter alone.
const LENS_DEFAULTS = Object.freeze({
  COUNTRY: 'ca',
  LANGUAGE: 'en',
  TYPE: 'visual_matches',
});

// ─────────────────────────────────────────────────────────────────────────────
// Run / product / review state vocabularies — the ONLY values these fields
// may ever take.
// ─────────────────────────────────────────────────────────────────────────────
const RUN_STATE = Object.freeze({
  CREATED: 'CREATED',
  PREPARING: 'PREPARING',
  SEARCHING_PRODUCTS: 'SEARCHING_PRODUCTS',
  BUILDING_RESULTS: 'BUILDING_RESULTS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  FAILED: 'FAILED',
});
const RUN_TERMINAL = Object.freeze([
  RUN_STATE.COMPLETED, RUN_STATE.COMPLETED_WITH_WARNINGS, RUN_STATE.FAILED,
]);

const PRODUCT_STATE = Object.freeze({
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  NO_VISUAL_MATCHES: 'NO_VISUAL_MATCHES',
  MISSING_IMAGE: 'MISSING_IMAGE',
  FAILED: 'FAILED',
});

const REVIEW_STATUS = Object.freeze({
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  INCLUDED: 'INCLUDED',
  EXCLUDED: 'EXCLUDED',
});
const REVIEW_VALUES = Object.freeze(Object.values(REVIEW_STATUS));

// Provider attempt status vocabulary — matches lib/feed/providers.js
// classifyError() taxonomy plus SerpAPI-specific outcomes.
const ATTEMPT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  NO_VISUAL_MATCHES: 'NO_VISUAL_MATCHES',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  TIMEOUT: 'TIMEOUT',
  INVALID_PARAMS: 'INVALID_PARAMS',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  ERROR: 'ERROR',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
});

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI key slots — NAMES only. Values are read lazily inside quota.js /
// serpapi.js and never assigned to a module-level constant, so a stack trace
// or a debugger snapshot of this file can never carry a key value.
// ─────────────────────────────────────────────────────────────────────────────
const SERPAPI_KEY_SLOTS = Object.freeze(['SERP_API_1', 'SERP_API_2']);

function serpapiKey(slot) {
  if (!SERPAPI_KEY_SLOTS.includes(slot)) return null;
  return process.env[slot] || null;
}

function configuredSlots() {
  return SERPAPI_KEY_SLOTS.filter((slot) => !!process.env[slot]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Database bindings — NO FALLBACK CHAINS, deliberately.
// ARCHITECTURE.md §10 finding 4 records the defect class this avoids: an
// implicit `A || B` chain can silently point writes at a different database.
//
//   Ledsone (READ-ONLY, current business truth)   <- DATABASE_URL
//   Lens Keyword Finder run history / evidence     <- DILAIKSHAN_NEON_DB
//   (READ-WRITE)                                      (same app DB as mahima_stpm_*,
//                                                        different table prefix)
// ─────────────────────────────────────────────────────────────────────────────
const ERRORS = Object.freeze({
  LEDSONE_MISSING: 'LENS_LEDSONE_DATABASE_URL_MISSING',
  APP_MISSING: 'LENS_APP_DATABASE_URL_MISSING',
  MIGRATION_MISSING: 'LENS_MIGRATION_NOT_APPLIED',
  SERPAPI_NOT_CONFIGURED: 'LENS_SERPAPI_NOT_CONFIGURED',
  TOO_MANY_PRODUCTS: 'LENS_TOO_MANY_PRODUCTS',
  NO_PRODUCTS: 'LENS_NO_PRODUCTS_SELECTED',
  INSUFFICIENT_QUOTA: 'LENS_INSUFFICIENT_QUOTA',
  PLANNER_BLOCKED: 'LENS_PLANNER_BLOCKED_CONFIG_REQUIRED',
  ANALYSIS_NOT_READY: 'LENS_ANALYSIS_NOT_READY',
  CRON_UNAUTHORIZED: 'LENS_CRON_UNAUTHORIZED',
  CRON_SECRET_MISSING: 'LENS_CRON_SECRET_MISSING',
  NO_ELIGIBLE_PRODUCTS: 'LENS_NO_ELIGIBLE_PRODUCTS',
});

function cronSecret() {
  return process.env.CRON_SECRET || null;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Analysis-phase pipeline (Stages 4-12) — a SEPARATE state machine from the
// Lens-search RUN_STATE above (see migration 007 header comment for why).
// ─────────────────────────────────────────────────────────────────────────────
const ANALYSIS_STATE = Object.freeze({
  NOT_STARTED: null,
  PREPARING: 'PREPARING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  FAILED: 'FAILED',
});
const ANALYSIS_TERMINAL = Object.freeze([
  ANALYSIS_STATE.COMPLETED, ANALYSIS_STATE.COMPLETED_WITH_WARNINGS, ANALYSIS_STATE.FAILED,
]);

// Fixed per-product analysis stage order. One (product, stage) is claimed per
// advanceAnalysis() call. phase2_* stages spend one SerpAPI search each;
// every other stage is local computation only. keyword_analysis MUST run
// before the phase2_* stages — Stage 6 explicitly builds its searches from
// the Phase 1 primary keyword, not the other way round (governing prompt
// §21: "For each product, determine the Phase 1 primary keyword ... Then
// perform ... Google All/Images/Shopping").
const ANALYSIS_STAGES = Object.freeze([
  'keyword_analysis',       // Stage 4/5: Phase 1 candidates from INCLUDED competitors
  'phase2_google',          // Stage 6: 1 SerpAPI search
  'phase2_images',          // Stage 6: 1 SerpAPI search
  'phase2_shopping',        // Stage 6: 1 SerpAPI search
  'phase2_keyword_analysis', // Stage 6/22: candidates from Phase 2 evidence
  'attribute_validation',   // Stage 8
  'planner',                 // Stage 7: capped to the primary keyword (logged, not hidden)
  'title_alt_build',          // Stage 9/10
  'final_output',              // Stage 11/12
]);
const ANALYSIS_DONE = 'DONE';

const CANDIDATE_CATEGORIES = Object.freeze([
  'Product Type', 'Material / Finish', 'Style / Aesthetic',
  'Size / Dimension', 'Feature / Modifier', 'Brand Naming Pattern',
  'Other Relevant Search Term',
]);

const ATTRIBUTE_STATUS = Object.freeze({
  MATCHED_FACT: 'MATCHED_FACT',
  CONFLICT: 'CONFLICT',
  UNVERIFIED_FACT: 'UNVERIFIED_FACT',
  NON_FACTUAL_SEARCH_TERM: 'NON_FACTUAL_SEARCH_TERM',
  BRAND_EXCLUDED: 'BRAND_EXCLUDED',
});

const PLANNER_STATUS = Object.freeze({
  CACHED: 'CACHED', FETCHED: 'FETCHED',
  BLOCKED_CONFIG_REQUIRED: 'BLOCKED_CONFIG_REQUIRED', ERROR: 'ERROR',
});

const FINAL_TITLE_STATUS = Object.freeze({ SUGGESTED: 'SUGGESTED', NEEDS_REVIEW: 'NEEDS_REVIEW', SAVED: 'SAVED' });

module.exports = {
  REQUIREMENT_ID,
  RUN_VERSION,
  SAJEEPAN,
  MAX_PRODUCTS_PER_RUN,
  SEARCHES_PER_PRODUCT,
  LENS_DEFAULTS,
  RUN_STATE,
  RUN_TERMINAL,
  PRODUCT_STATE,
  REVIEW_STATUS,
  REVIEW_VALUES,
  ATTEMPT_STATUS,
  SERPAPI_KEY_SLOTS,
  serpapiKey,
  configuredSlots,
  ERRORS,
  ledsoneUrl,
  appUrl,
  ANALYSIS_STATE,
  ANALYSIS_TERMINAL,
  ANALYSIS_STAGES,
  ANALYSIS_DONE,
  CANDIDATE_CATEGORIES,
  ATTRIBUTE_STATUS,
  PLANNER_STATUS,
  FINAL_TITLE_STATUS,
  CACHE_TTL_DAYS,
  QUOTA_RESERVE,
  SERPAPI_CONCURRENCY,
  GENERATION_CONCURRENCY,
  MAX_CRON_WORK_MS,
  SELECTION_WEIGHTS,
  RELEVANCE_WEIGHTS,
  RELEVANCE_THRESHOLD,
  MAX_COMPETITORS_PER_PRODUCT,
  AUTO_DECISION,
  GENERATION_SOURCE,
  GEMMA_KEY_ENV,
  gemmaKey,
  WEEKLY,
  cronSecret,
};
