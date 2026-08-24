'use strict';

// lib/lens-keywords/keyword-planner.js
//
// Stage 7 — Google Ads Keyword Planner.
//
// PROVEN STATE (2026-08-24 discovery, re-verified today before writing this
// file): no Google Ads API credential exists anywhere in this repository or
// in .env.local variable names (exhaustive grep for GOOGLE_ADS_*, developer-
// token, googleads.googleapis, login_customer — zero hits). A service
// account structurally cannot authenticate to this API (it requires a USER
// OAuth refresh token, not a JWT-bearer service-account flow) — a prior
// project's own proven finding, corroborated here.
//
// THIS MODULE THEREFORE:
//   * Checks for the required credential set by NAME only, never invents or
//     requests a value, and never prints one.
//   * Returns BLOCKED_CONFIG_REQUIRED honestly when absent — never a
//     fabricated suggestion, never silently empty (which would read as "no
//     suggestions" rather than "the integration is not configured").
//   * Implements the real call path (KeywordPlanIdeaService.generateKeyword
//     Ideas, REST v25 — verified against current Google Ads API docs
//     2026-08-24, not an old/invented endpoint) so that the day a credential
//     is provisioned, this module works without further design.
//   * Caches every result in google_lens_keyword_planner_suggestion so the
//     same seed/country/language is never re-queried needlessly (governing
//     prompt §27) — the cache logic is exercised and tested today even
//     though the live call path cannot be.
//
// google_ads.keywords / keyword_performance (existing campaign data) are
// NEVER used as a substitute here — see google-ads.js for that evidence,
// kept under a different provenance label (governing prompt §24).

const ENV = {
  CLIENT_ID: 'GOOGLE_ADS_CLIENT_ID',
  CLIENT_SECRET: 'GOOGLE_ADS_CLIENT_SECRET',
  REFRESH_TOKEN: 'GOOGLE_ADS_REFRESH_TOKEN',
  DEVELOPER_TOKEN: 'GOOGLE_ADS_DEVELOPER_TOKEN',
  CUSTOMER_ID: 'GOOGLE_ADS_CUSTOMER_ID',
  LOGIN_CUSTOMER_ID: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', // conditional (manager account)
};

const REQUIRED = [ENV.CLIENT_ID, ENV.CLIENT_SECRET, ENV.REFRESH_TOKEN, ENV.DEVELOPER_TOKEN, ENV.CUSTOMER_ID];

const API_BASE = 'https://googleads.googleapis.com/v25';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 20000;

function isConfigured() {
  return REQUIRED.every((name) => !!process.env[name]);
}

function missingVars() {
  return REQUIRED.filter((name) => !process.env[name]);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: ac.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/** OAuth2 user-credential refresh — never logs client_secret/refresh_token. */
async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env[ENV.CLIENT_ID],
    client_secret: process.env[ENV.CLIENT_SECRET],
    refresh_token: process.env[ENV.REFRESH_TOKEN],
    grant_type: 'refresh_token',
  });
  const r = await fetchWithTimeout(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, TIMEOUT_MS);
  if (!r.ok) {
    const e = new Error('Google OAuth token refresh failed.');
    e.code = 'LENS_PLANNER_OAUTH_FAILED';
    throw e;
  }
  const j = await r.json();
  return j.access_token; // never returned to the caller of generateIdeas — used once, in-process
}

/**
 * Live call — KeywordPlanIdeaService.generateKeywordIdeas, REST v25.
 * Only reached when isConfigured() is true. geoTargetConstants/2124 = Canada,
 * languageConstants/1000 = English (both verified Google Ads reference IDs,
 * not guessed).
 */
async function generateIdeasLive(seedKeywords) {
  const accessToken = await getAccessToken();
  const customerId = process.env[ENV.CUSTOMER_ID];
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': process.env[ENV.DEVELOPER_TOKEN],
    'Content-Type': 'application/json',
  };
  if (process.env[ENV.LOGIN_CUSTOMER_ID]) headers['login-customer-id'] = process.env[ENV.LOGIN_CUSTOMER_ID];

  const body = {
    keywordSeed: { keywords: seedKeywords.slice(0, 20) },
    geoTargetConstants: ['geoTargetConstants/2124'], // Canada
    language: 'languageConstants/1000',              // English
    keywordPlanNetwork: 'GOOGLE_SEARCH',
  };

  const r = await fetchWithTimeout(
    `${API_BASE}/customers/${customerId}:generateKeywordIdeas`,
    { method: 'POST', headers, body: JSON.stringify(body) },
    TIMEOUT_MS
  );
  if (!r.ok) {
    const e = new Error(`Google Ads API returned HTTP ${r.status}.`);
    e.code = 'LENS_PLANNER_API_ERROR';
    e.status = r.status;
    throw e;
  }
  const j = await r.json();
  const results = Array.isArray(j.results) ? j.results : [];
  return results.map((res) => {
    const m = res.keywordIdeaMetrics || {};
    return {
      text: res.text,
      avg_monthly_searches: m.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null,
      competition: m.competition || null,
      competition_index: m.competitionIndex != null ? Number(m.competitionIndex) : null,
      low_top_of_page_bid: m.lowTopOfPageBidMicros != null ? Number(m.lowTopOfPageBidMicros) / 1e6 : null,
      high_top_of_page_bid: m.highTopOfPageBidMicros != null ? Number(m.highTopOfPageBidMicros) / 1e6 : null,
    };
  });
}

/**
 * Fetch (or reuse a fresh cached) set of suggestions for one seed keyword.
 * `deps.repo` supplies the cache read/write; `freshnessDays` is the
 * configurable reuse window (governing prompt §27) — defaults to 7, declared
 * here rather than hidden inline.
 */
const DEFAULT_FRESHNESS_DAYS = 7;

async function getSuggestions(deps, { seedKeyword, country, language, runId, runProductId, freshnessDays }) {
  const normalized = String(seedKeyword || '').trim().toLowerCase();
  if (!normalized) {
    return { status: 'ERROR', suggestions: [], error_detail_safe: 'No seed keyword was supplied.' };
  }

  const cached = await deps.repo.findFreshPlannerSuggestions({
    normalizedSeed: normalized, country: country || 'ca', language: language || 'en',
    freshnessDays: freshnessDays || DEFAULT_FRESHNESS_DAYS,
  });
  if (cached && cached.length) {
    return { status: 'CACHED', suggestions: cached };
  }

  if (!isConfigured()) {
    const rows = [{
      run_id: runId || null, run_product_id: runProductId || null,
      seed_keyword: seedKeyword, normalized_seed: normalized,
      country: country || 'ca', language: language || 'en',
      status: 'BLOCKED_CONFIG_REQUIRED',
      matched_keyword: null, new_suggestion: null,
      avg_monthly_searches: null, competition: null, competition_index: null,
      low_top_of_page_bid: null, high_top_of_page_bid: null,
      safe_raw: { missing_config: missingVars() },
    }];
    await deps.repo.savePlannerSuggestions(rows);
    return {
      status: 'BLOCKED_CONFIG_REQUIRED',
      suggestions: [],
      error_detail_safe: 'Google Ads Keyword Planner requires a Google Ads API credential that is not currently configured.',
      missing_config: missingVars(),
    };
  }

  let ideas;
  try {
    ideas = await deps.keywordPlannerApi.generateIdeasLive([seedKeyword]);
  } catch (e) {
    const rows = [{
      run_id: runId || null, run_product_id: runProductId || null,
      seed_keyword: seedKeyword, normalized_seed: normalized,
      country: country || 'ca', language: language || 'en',
      status: 'ERROR', matched_keyword: null, new_suggestion: null,
      avg_monthly_searches: null, competition: null, competition_index: null,
      low_top_of_page_bid: null, high_top_of_page_bid: null,
      safe_raw: { error_code: e.code || 'LENS_PLANNER_ERROR' },
    }];
    await deps.repo.savePlannerSuggestions(rows);
    return { status: 'ERROR', suggestions: [], error_detail_safe: 'Google Ads Keyword Planner could not be reached.' };
  }

  const rows = ideas.map((idea) => ({
    run_id: runId || null, run_product_id: runProductId || null,
    seed_keyword: seedKeyword, normalized_seed: normalized,
    country: country || 'ca', language: language || 'en',
    status: 'FETCHED',
    matched_keyword: idea.text && idea.text.toLowerCase() === normalized ? idea.text : null,
    new_suggestion: idea.text && idea.text.toLowerCase() !== normalized ? idea.text : null,
    avg_monthly_searches: idea.avg_monthly_searches,
    competition: idea.competition,
    competition_index: idea.competition_index,
    low_top_of_page_bid: idea.low_top_of_page_bid,
    high_top_of_page_bid: idea.high_top_of_page_bid,
    safe_raw: null,
  }));
  await deps.repo.savePlannerSuggestions(rows);
  return { status: 'FETCHED', suggestions: rows };
}

module.exports = {
  ENV, REQUIRED, DEFAULT_FRESHNESS_DAYS,
  isConfigured, missingVars, getAccessToken, generateIdeasLive, getSuggestions,
};
