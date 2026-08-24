'use strict';

// lib/lens-keywords/quota.js
//
// SerpAPI Account API — safe quota checking and key-slot selection.
//
// RULES THIS FILE ENFORCES
//   * The Account API is free and does not consume a search credit (SerpAPI
//     documentation, verified 2026-08-24). Call it before every run.
//   * Only a fixed allowlist of fields is ever read out of the response.
//     api_key, account_email, account_id, plan_id, plan_monthly_price,
//     plan_renewal_date, this_hour_searches, last_hour_searches and
//     account_status are NEVER stored, logged, or returned to the browser.
//   * No key value ever reaches a log line, an error message, or the
//     database. `checkAccount` accepts a SLOT NAME (SERP_API_1/2), reads the
//     value once, and never assigns it to anything the caller can see.

const { SERPAPI_KEY_SLOTS, serpapiKey } = require('./config');

const ACCOUNT_URL = 'https://serpapi.com/account.json';
const TIMEOUT_MS = 10000;

const SAFE_FIELDS = [
  'plan_name',
  'searches_per_month',
  'plan_searches_left',
  'total_searches_left',
  'this_month_usage',
  'account_rate_limit_per_hour',
];

async function fetchWithTimeout(url, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check one key slot's account status. Never throws — a bad/unreachable key
 * is a normal, reportable outcome, not an exception.
 */
async function checkAccount(slot) {
  const out = {
    key_slot: slot,
    configured: false,
    reachable: false,
    plan_name: null,
    searches_per_month: null,
    plan_searches_left: null,
    total_searches_left: null,
    this_month_usage: null,
    rate_limit_per_hour: null,
    error_safe: null,
  };

  if (!SERPAPI_KEY_SLOTS.includes(slot)) {
    out.error_safe = 'Unknown key slot.';
    return out;
  }

  const key = serpapiKey(slot);
  if (!key) {
    out.error_safe = `${slot} is not configured.`;
    return out;
  }
  out.configured = true;

  let r;
  try {
    // The key is interpolated directly into the request URL and never
    // assigned to a local that survives past this call, and never logged.
    r = await fetchWithTimeout(`${ACCOUNT_URL}?api_key=${encodeURIComponent(key)}`, TIMEOUT_MS);
  } catch (e) {
    out.error_safe = /abort/i.test(String(e && e.message)) ? 'Timed out contacting SerpAPI.' : 'Could not reach SerpAPI.';
    return out;
  }

  if (!r.ok) {
    // Never echo response body — it can carry the submitted key back.
    out.error_safe = `SerpAPI account check failed (HTTP ${r.status}).`;
    return out;
  }

  let j;
  try {
    j = await r.json();
  } catch {
    out.error_safe = 'SerpAPI account response could not be parsed.';
    return out;
  }

  out.reachable = true;
  for (const f of SAFE_FIELDS) {
    if (j && j[f] !== undefined) out[f === 'account_rate_limit_per_hour' ? 'rate_limit_per_hour' : f] = j[f];
  }
  return out;
}

/** Check every configured slot. Safe to call with zero slots configured. */
async function checkAllAccounts() {
  return Promise.all(SERPAPI_KEY_SLOTS.map((slot) => checkAccount(slot)));
}

/**
 * Choose which key slot a run should start with.
 *
 * Rule (per the governing implementation prompt §13): prefer the slot with
 * the strongest available balance; continue onto the other slot only when
 * the first becomes quota-exhausted DURING the run (handled by the caller's
 * retry policy, not here). This function only picks the STARTING slot.
 */
function selectStartingSlot(accountStatuses) {
  const usable = accountStatuses.filter((a) => a.configured && a.reachable && !a.error_safe);
  if (!usable.length) return null;
  usable.sort((a, b) => {
    const av = a.total_searches_left == null ? -1 : a.total_searches_left;
    const bv = b.total_searches_left == null ? -1 : b.total_searches_left;
    return bv - av;
  });
  return usable[0].key_slot;
}

/** The other configured slot, for a mid-run fallback. */
function otherSlot(currentSlot) {
  return SERPAPI_KEY_SLOTS.find((s) => s !== currentSlot) || null;
}

/** Aggregate usable credit across all reachable, configured slots. */
function totalUsableCredits(accountStatuses) {
  return accountStatuses
    .filter((a) => a.configured && a.reachable && !a.error_safe && a.total_searches_left != null)
    .reduce((sum, a) => sum + Number(a.total_searches_left || 0), 0);
}

module.exports = {
  SAFE_FIELDS,
  checkAccount,
  checkAllAccounts,
  selectStartingSlot,
  otherSlot,
  totalUsableCredits,
};
