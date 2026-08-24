'use strict';

// lib/lens-keywords/serpapi.js
//
// SerpAPI provider — the ACTIVE search provider for this feature (Stages 2
// and 6: Lens + Phase 2 All/Images/Shopping).
//
// PROVIDER ABSTRACTION BOUNDARY: this is the ONLY module that knows SerpAPI's
// request/response shape. Callers (phase1.js, phase2.js) get back a
// provider-agnostic attempt object; a future company VM Playwright provider
// would implement the same searchLens()/searchGoogle()/searchGoogleImages()/
// searchGoogleShopping() contracts as a sibling module without touching
// orchestration, router.js or any UI.
//
// PARAMETERS — verified against live SerpAPI documentation 2026-08-24, not
// guessed:
//   google_lens     : engine=google_lens, url=<image>, type=visual_matches,
//                     hl=<lang>, country=<country>
//   google          : engine=google,          q=<query>, gl=<country>, hl=<lang>
//   google_images   : engine=google_images,    q=<query>, gl=<country>, hl=<lang>
//   google_shopping : engine=google_shopping,  q=<query>, gl=<country>, hl=<lang>
// NOTE the parameter name difference: Lens uses `country`; the other three
// use `gl`. This is not a typo — it is what each engine's own documentation
// specifies, and using the wrong name for either family would silently apply
// no geo targeting.
//
// `no_cache` is deliberately NOT set anywhere — normal SerpAPI caching is
// allowed (governing prompt §14); this application's own run/idempotency-key
// and per-(product,stage) claim guards are what stop a double click or a
// refresh from re-searching, not a cache-busting flag.
//
// RESPONSE MAPPING never fabricates a field an engine did not document/return
// (governing prompt §16/§14) — see normalize.js and phase2.js.

const { LENS_DEFAULTS, serpapiKey, ATTEMPT_STATUS } = require('./config');

const SEARCH_URL = 'https://serpapi.com/search.json';
const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classify(err, httpStatus, bodyJson) {
  if (httpStatus === 429) return ATTEMPT_STATUS.RATE_LIMITED;
  if (httpStatus === 400) return ATTEMPT_STATUS.INVALID_PARAMS;
  if (bodyJson && typeof bodyJson.error === 'string' && /credit|quota|limit/i.test(bodyJson.error)) {
    return ATTEMPT_STATUS.QUOTA_EXHAUSTED;
  }
  if (httpStatus && httpStatus >= 500) return ATTEMPT_STATUS.CONNECTION_FAILED;
  const m = String((err && err.message) || '').toLowerCase();
  if (m.includes('abort') || m.includes('timeout')) return ATTEMPT_STATUS.TIMEOUT;
  if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed') || m.includes('network')) {
    return ATTEMPT_STATUS.CONNECTION_FAILED;
  }
  return ATTEMPT_STATUS.ERROR;
}

function baseAttempt(engine, keySlot) {
  return {
    provider: 'SERPAPI', key_slot: keySlot || null, engine,
    search_id: null, status: ATTEMPT_STATUS.ERROR, http_status: null, latency_ms: null,
    error_code: null, error_detail_safe: null, results: [],
  };
}

/**
 * Shared request/response core for every SerpAPI engine used by this
 * feature. `resultsKey` names the array the caller expects back
 * (visual_matches | organic_results | images_results | shopping_results).
 */
async function runSearch(engine, params, { keySlot, resultsKey }) {
  const started = Date.now();
  const attempt = baseAttempt(engine, keySlot);

  const key = serpapiKey(keySlot);
  if (!key) {
    attempt.status = ATTEMPT_STATUS.NOT_CONFIGURED;
    attempt.error_code = 'LENS_SERPAPI_NOT_CONFIGURED';
    attempt.error_detail_safe = `${keySlot} is not configured.`;
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  const qs = new URLSearchParams(Object.assign({}, params, { api_key: key }));

  let r;
  let httpStatus = null;
  try {
    r = await fetchWithTimeout(`${SEARCH_URL}?${qs.toString()}`, TIMEOUT_MS);
    httpStatus = r.status;
    attempt.http_status = httpStatus;
  } catch (e) {
    attempt.status = classify(e, null, null);
    attempt.error_detail_safe = 'Could not reach the search provider.';
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  let j = null;
  try {
    j = await r.json();
  } catch {
    attempt.status = ATTEMPT_STATUS.ERROR;
    attempt.error_detail_safe = 'The search provider returned an unreadable response.';
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  attempt.search_id = (j && j.search_metadata && j.search_metadata.id) || null;

  if (!r.ok || (j && j.search_metadata && j.search_metadata.status === 'Error')) {
    attempt.status = classify(null, httpStatus, j);
    attempt.error_detail_safe = (j && typeof j.error === 'string' ? j.error : `Search provider error (HTTP ${httpStatus}).`).slice(0, 300);
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  const results = Array.isArray(j[resultsKey]) ? j[resultsKey] : [];
  if (!results.length) {
    attempt.status = ATTEMPT_STATUS.NO_VISUAL_MATCHES; // reused as the generic "no results" outcome across engines
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  attempt.status = ATTEMPT_STATUS.SUCCESS;
  attempt.results = results;
  attempt.latency_ms = Date.now() - started;
  return attempt;
}

/** Stage 2 — Google Lens visual search. */
async function searchLens({ imageUrl, keySlot, country, language }) {
  if (!imageUrl) {
    const attempt = baseAttempt('google_lens', keySlot);
    attempt.status = ATTEMPT_STATUS.INVALID_PARAMS;
    attempt.error_code = 'LENS_MISSING_IMAGE_URL';
    attempt.error_detail_safe = 'No product image URL was supplied.';
    return attempt;
  }
  const attempt = await runSearch('google_lens', {
    engine: 'google_lens', url: imageUrl, type: LENS_DEFAULTS.TYPE,
    hl: language || LENS_DEFAULTS.LANGUAGE, country: country || LENS_DEFAULTS.COUNTRY,
  }, { keySlot, resultsKey: 'visual_matches' });
  attempt.visual_matches = attempt.results; // back-compat field name used by phase1.js/normalize.js
  return attempt;
}

/** Stage 6 — Google All (organic web results) for the Phase 1 keyword. */
async function searchGoogle({ query, keySlot, country, language }) {
  if (!query) return invalidQuery('google', keySlot);
  return runSearch('google', {
    engine: 'google', q: query, gl: country || LENS_DEFAULTS.COUNTRY, hl: language || LENS_DEFAULTS.LANGUAGE,
  }, { keySlot, resultsKey: 'organic_results' });
}

/** Stage 6 — Google Images for the Phase 1 keyword. */
async function searchGoogleImages({ query, keySlot, country, language }) {
  if (!query) return invalidQuery('google_images', keySlot);
  return runSearch('google_images', {
    engine: 'google_images', q: query, gl: country || LENS_DEFAULTS.COUNTRY, hl: language || LENS_DEFAULTS.LANGUAGE,
  }, { keySlot, resultsKey: 'images_results' });
}

/** Stage 6 — Google Shopping for the Phase 1 keyword. */
async function searchGoogleShopping({ query, keySlot, country, language }) {
  if (!query) return invalidQuery('google_shopping', keySlot);
  return runSearch('google_shopping', {
    engine: 'google_shopping', q: query, gl: country || LENS_DEFAULTS.COUNTRY, hl: language || LENS_DEFAULTS.LANGUAGE,
  }, { keySlot, resultsKey: 'shopping_results' });
}

function invalidQuery(engine, keySlot) {
  const attempt = baseAttempt(engine, keySlot);
  attempt.status = ATTEMPT_STATUS.INVALID_PARAMS;
  attempt.error_code = 'LENS_MISSING_QUERY';
  attempt.error_detail_safe = 'No search phrase was supplied.';
  return attempt;
}

module.exports = {
  searchLens, searchGoogle, searchGoogleImages, searchGoogleShopping,
  runSearch, SEARCH_URL,
};
