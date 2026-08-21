'use strict';

// lib/stpm/source.js
//
// REQ-DM-2026-08-MAHI01 — date-window resolution, the approved 7 -> 14 day
// fallback, and the source-health model.
//
// THE APPROVED DATE RULE
//   1. Default is Last 7 Days.
//   2. If that yields zero usable rows, retry Last 14 Days ONCE.
//   3. If the 14-day window has rows, use it — and label it honestly. The
//      requested range and the actual range are stored and displayed
//      separately, so 14-day data is never presented as 7-day data.
//   4. Never extend beyond 14 days automatically.
//   5. A user-selected CUSTOM range is never altered. No fallback is attempted.
//
// THE SOURCE-HEALTH MODEL EXISTS BECAUSE OF A REAL, PROVEN CONDITION
//   The full-LEDSONE audit found Mahima campaigns spending €514.58 across 1,546
//   clicks in the exact 7-day window that returns ZERO search-term rows, while
//   campaign_performance was current to the same day. In other words: the
//   campaigns are live, and only search-term ingestion lags.
//
//   A dashboard that just showed an empty table would read as "no activity",
//   which is the opposite of the truth and would send an operator to the wrong
//   conclusion. So health is computed by COMPARING two freshness signals —
//   campaign-level vs search-term-level — and the UI says which one is stale.
//
//   Repairing the upstream ingestion is explicitly out of scope for this app.

const { DATE_RULE, SOURCE_HEALTH } = require('./config');

/** YYYY-MM-DD for a Date, in UTC. */
function iso(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10);
}

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  if (iso(d) !== s) return null; // rejects 2026-02-31 style input
  return d;
}

function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Trailing window of `days` ending TODAY inclusive.
 * `days = 7` on 2026-08-21 gives 2026-08-15 .. 2026-08-21 — seven calendar days.
 */
function trailingWindow(today, days) {
  const end = today;
  const start = addDays(end, -(days - 1));
  return { start: iso(start), end: iso(end) };
}

/**
 * Historical window that ends the day BEFORE the current window starts, so the
 * two never overlap. Overlap would double-count a conversion as both current
 * and historical and could flip a term's Performance Status.
 */
function historicalWindow(currentStart, days) {
  const cs = parseDate(currentStart);
  if (!cs) return { start: null, end: null };
  const end = addDays(cs, -1);
  const start = addDays(end, -(days - 1));
  return { start: iso(start), end: iso(end) };
}

/** Validate and normalize the caller's requested current period. */
function resolveRequestedWindow(input, today) {
  const preset = (input && input.preset) || 'last7';

  if (preset === 'custom') {
    const s = parseDate(input && input.start);
    const e = parseDate(input && input.end);
    if (!s || !e) {
      const err = new Error('Custom date range requires valid start and end dates (YYYY-MM-DD).');
      err.status = 400; err.code = 'STPM_INVALID_DATE_RANGE';
      throw err;
    }
    if (s > e) {
      const err = new Error('Start date must not be after end date.');
      err.status = 400; err.code = 'STPM_INVALID_DATE_RANGE';
      throw err;
    }
    // Guard rail: an unbounded range would pull the entire history into memory.
    const spanDays = Math.round((e - s) / 86400000) + 1;
    if (spanDays > 400) {
      const err = new Error('Custom date range is limited to 400 days.');
      err.status = 400; err.code = 'STPM_DATE_RANGE_TOO_LARGE';
      throw err;
    }
    return { preset: 'custom', start: iso(s), end: iso(e), allowFallback: false };
  }

  const w = trailingWindow(today, DATE_RULE.DEFAULT_DAYS);
  return { preset: 'last7', start: w.start, end: w.end, allowFallback: true };
}

/** Validate and normalize the requested historical period. */
function resolveHistoricalWindow(input, currentStart) {
  const preset = (input && input.preset) || 'prev30';

  if (preset === 'custom') {
    const s = parseDate(input && input.start);
    const e = parseDate(input && input.end);
    if (!s || !e) {
      const err = new Error('Custom historical range requires valid start and end dates (YYYY-MM-DD).');
      err.status = 400; err.code = 'STPM_INVALID_HISTORICAL_RANGE';
      throw err;
    }
    if (s > e) {
      const err = new Error('Historical start date must not be after end date.');
      err.status = 400; err.code = 'STPM_INVALID_HISTORICAL_RANGE';
      throw err;
    }
    const cs = parseDate(currentStart);
    if (cs && e >= cs) {
      // Non-overlap is a correctness requirement, not a preference.
      const err = new Error('Historical range must end before the current period starts.');
      err.status = 400; err.code = 'STPM_HISTORICAL_OVERLAP';
      throw err;
    }
    return { preset: 'custom', start: iso(s), end: iso(e) };
  }

  const days = preset === 'prev60' ? DATE_RULE.HISTORICAL_PREV60 : DATE_RULE.HISTORICAL_PREV30;
  const w = historicalWindow(currentStart, days);
  return { preset: preset === 'prev60' ? 'prev60' : 'prev30', start: w.start, end: w.end };
}

/**
 * Apply the fallback rule.
 *
 * `probe(start, end)` must return the row count for a window. It is injected so
 * this stays pure and unit-testable without a database.
 *
 * Returns { start, end, fallback_used, fallback_days, fallback_reason, rows }.
 */
async function applyDateFallback(requested, today, probe) {
  const primaryRows = await probe(requested.start, requested.end);

  if (primaryRows > 0 || !requested.allowFallback) {
    return {
      start: requested.start,
      end: requested.end,
      fallback_used: false,
      fallback_days: null,
      fallback_reason: null,
      rows: primaryRows,
    };
  }

  // Zero usable rows on the default window — try 14 days, once.
  const wide = trailingWindow(today, DATE_RULE.FALLBACK_DAYS);
  const wideRows = await probe(wide.start, wide.end);

  if (wideRows > 0) {
    return {
      start: wide.start,
      end: wide.end,
      fallback_used: true,
      fallback_days: DATE_RULE.FALLBACK_DAYS,
      fallback_reason:
        `No search-term rows were available for the requested ${requested.start} to ${requested.end}. ` +
        `Automatically widened to the last ${DATE_RULE.FALLBACK_DAYS} days.`,
      rows: wideRows,
    };
  }

  // Both empty. Keep the REQUESTED window so the UI reports what was asked for,
  // and never pretend a wider window was used.
  return {
    start: requested.start,
    end: requested.end,
    fallback_used: false,
    fallback_days: null,
    fallback_reason:
      `No search-term rows were available for the requested period or the ${DATE_RULE.FALLBACK_DAYS}-day fallback.`,
    rows: 0,
  };
}

/**
 * Build the source-health model shown in the banner.
 *
 * @param {object} a
 *   freshness  — { search_term, pmax_term, campaign_perf, latest_search_term }
 *   window     — resolved actual window
 *   requested  — requested window
 *   fallback   — result of applyDateFallback
 *   coverage[] — per-campaign rows_in_window / max_date
 *   rowCount   — result rows produced
 */
function buildSourceHealth(a) {
  const freshness = a.freshness || {};
  const coverage = a.coverage || [];
  const warnings = [];

  const withData = coverage.filter((c) => c.rows_in_window > 0);
  const stale = coverage.filter((c) => c.rows_in_window === 0 && c.rows_total > 0);
  const never = coverage.filter((c) => c.rows_total === 0);

  let health = SOURCE_HEALTH.HEALTHY;

  if (a.rowCount === 0) health = SOURCE_HEALTH.NO_DATA;
  else if (a.fallback && a.fallback.fallback_used) health = SOURCE_HEALTH.FALLBACK;

  // The important comparison: campaign activity current, search terms behind.
  const campaignFresh = freshness.campaign_perf || null;
  const termFresh = freshness.latest_search_term || null;
  let ingestionLagDays = null;
  if (campaignFresh && termFresh) {
    const cf = parseDate(campaignFresh);
    const tf = parseDate(termFresh);
    if (cf && tf) ingestionLagDays = Math.round((cf - tf) / 86400000);
  }

  if (ingestionLagDays !== null && ingestionLagDays >= 2) {
    if (health === SOURCE_HEALTH.HEALTHY) health = SOURCE_HEALTH.STALE;
    warnings.push({
      code: 'search_term_ingestion_stale',
      severity: 'warning',
      title: 'Search-term source data is stale or incomplete',
      message:
        `Campaign totals are up to date (${campaignFresh}), but search-term detail has only been ` +
        `received up to ${termFresh} — ${ingestionLagDays} day${ingestionLagDays === 1 ? '' : 's'} behind. ` +
        `Recent activity may not appear in this table yet.`,
      detail: { campaign_source_date: campaignFresh, search_term_source_date: termFresh, lag_days: ingestionLagDays },
    });
  }

  if (a.fallback && a.fallback.fallback_used) {
    warnings.push({
      code: 'date_fallback_used',
      severity: 'warning',
      title: 'Last 7 days data is unavailable. Showing available data from the last 14 days.',
      message:
        `You asked for ${a.requested.start} to ${a.requested.end}. ` +
        `Showing ${a.window.start} to ${a.window.end} instead.`,
      detail: {
        requested_start: a.requested.start, requested_end: a.requested.end,
        actual_start: a.window.start, actual_end: a.window.end,
      },
    });
  }

  if (a.rowCount === 0) {
    warnings.push({
      code: 'no_search_term_data',
      severity: 'error',
      title: 'No search-term data is available for the selected period',
      message: termFresh
        ? `The most recent search-term data on record is ${termFresh}. Try a custom date range that includes it.`
        : 'No search-term data is on record for the selected campaigns.',
      detail: { latest_search_term_source_date: termFresh },
    });
  }

  if (stale.length > 0) {
    warnings.push({
      code: 'campaigns_stale',
      severity: 'info',
      title: `${stale.length} campaign${stale.length === 1 ? '' : 's'} have no data in this period`,
      message: 'These campaigns have search-term history, but nothing within the dates shown.',
      detail: {
        campaigns: stale.map((c) => ({
          campaign_id: c.campaign_id, campaign_name: c.campaign_name, latest_date: c.max_date,
        })),
      },
    });
  }

  if (never.length > 0) {
    warnings.push({
      code: 'campaigns_never_ingested',
      severity: 'info',
      title: `${never.length} campaign${never.length === 1 ? '' : 's'} have no search-term data on record`,
      message: 'No search-term rows have ever been received for these campaigns.',
      detail: {
        campaigns: never.map((c) => ({
          campaign_id: c.campaign_id, campaign_name: c.campaign_name, campaign_type: c.campaign_type,
        })),
      },
    });
  }

  return {
    health,
    warnings,
    campaigns_selected: coverage.length,
    campaigns_with_data: withData.length,
    campaigns_stale: stale.length + never.length,
    ingestion_lag_days: ingestionLagDays,
    latest_search_term_source_date: freshness.search_term || null,
    latest_pmax_term_source_date: freshness.pmax_term || null,
    latest_campaign_source_date: campaignFresh,
  };
}

module.exports = {
  iso,
  parseDate,
  addDays,
  trailingWindow,
  historicalWindow,
  resolveRequestedWindow,
  resolveHistoricalWindow,
  applyDateFallback,
  buildSourceHealth,
};
