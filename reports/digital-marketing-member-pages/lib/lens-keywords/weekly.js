'use strict';

// lib/lens-keywords/weekly.js
//
// REQ-DM-2026-08-SAJE01 — weekly automation (prompt §49-58).
//
// WHAT THIS GUARANTEES
//   * EXACTLY ONE business run per ISO week. The key is
//     SAJEEPAN-WEEKLY-YYYY-WW and it is enforced by a UNIQUE constraint in the
//     database, not by an in-process check — so a cron retry, a double
//     delivery, or a manual trigger racing the cron all converge on the SAME
//     run instead of creating a second one.
//   * The continuation cron RESUMES only. It can never start a new weekly
//     business run; with nothing pending it returns NO_PENDING_WEEKLY_RUN and
//     spends zero provider calls.
//   * CRON_SECRET bearer auth, FAIL CLOSED. A normal staff dm_session cookie
//     is NOT accepted here and is never treated as a substitute — the two auth
//     paths are separate on purpose (a browser session must not be able to
//     trigger the scheduled batch, and the scheduler has no session).
//
// TIMEZONE: Vercel Cron schedules are evaluated in UTC, always. '0 1 * * 1' is
// Monday 01:00 UTC. Hobby-plan crons fire with up to ~59 minutes of
// imprecision, which is why every step here is idempotent rather than
// time-sensitive.

const { cronSecret, ERRORS, WEEKLY, MAX_CRON_WORK_MS } = require('./config');

const WEEKLY_KEY_PREFIX = 'SAJEEPAN-WEEKLY';

/**
 * ISO-8601 week number. Thursday-based, per the standard — the week
 * containing the year's first Thursday is week 01. Never derived from
 * "day-of-year / 7", which drifts.
 */
function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;           // Monday=1 .. Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);   // move to this week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** The one idempotency key for a given instant's ISO week. */
function weeklyKey(date) {
  const { year, week } = isoWeekOf(date || new Date());
  return `${WEEKLY_KEY_PREFIX}-${year}-${String(week).padStart(2, '0')}`;
}

/** Next Monday 01:00 UTC after `from` — matches WEEKLY.CRON_SCHEDULE. */
function nextScheduledRun(from) {
  const d = new Date(from || Date.now());
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 1, 0, 0));
  const daysUntilMonday = (8 - (d.getUTCDay() || 7)) % 7;
  if (daysUntilMonday === 0 && next > d) return next.toISOString();
  next.setUTCDate(next.getUTCDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
  return next.toISOString();
}

/**
 * Bearer-token auth for the cron routes. FAIL CLOSED:
 *   * CRON_SECRET not set at runtime      -> 503, the route does nothing
 *   * header missing / wrong / a session   -> 401
 * A dm_session cookie is deliberately not consulted; presenting one is not a
 * substitute for the secret and never grants access to this route.
 */
function assertCronAuthorized(req) {
  const secret = cronSecret();
  if (!secret) {
    const e = new Error('Scheduled automation is not configured.');
    e.status = 503; e.code = ERRORS.CRON_SECRET_MISSING;
    throw e;
  }
  const header = (req && req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const presented = String(header).startsWith('Bearer ') ? String(header).slice(7).trim() : null;
  if (!presented || !timingSafeEqual(presented, secret)) {
    const e = new Error('Not authorised.');
    e.status = 401; e.code = ERRORS.CRON_UNAUTHORIZED;
    throw e;
  }
  return true;
}

function timingSafeEqual(a, b) {
  const crypto = require('crypto');
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** A work-time budget that keeps a cron invocation inside the function timeout. */
function makeBudget(startedAt, limitMs) {
  const start = startedAt || Date.now();
  const limit = Number.isFinite(limitMs) ? limitMs : MAX_CRON_WORK_MS;
  return {
    startedAt: start,
    elapsed: () => Date.now() - start,
    exhausted: () => (Date.now() - start) >= limit,
  };
}

/**
 * Start (or return) THIS ISO week's run. Never creates a second one.
 * `startRun` is injected: it does the actual product selection + run creation
 * and returns { run }. It is only called when this week's row was genuinely
 * created by THIS call.
 */
async function startWeeklyRun(deps, { now, triggeredBy }) {
  const key = weeklyKey(now || new Date());
  const existing = await deps.repo.getWeeklyRun(key);
  if (existing) {
    return { iso_week: key, weekly: existing, created: false, reason: 'ALREADY_RAN_THIS_WEEK' };
  }

  const { weekly, created } = await deps.repo.createWeeklyRun({ isoWeek: key, triggeredBy: triggeredBy || 'cron' });
  if (!created) {
    // Lost the insert race against a concurrent delivery — that run is THE run.
    return { iso_week: key, weekly, created: false, reason: 'ALREADY_RAN_THIS_WEEK' };
  }

  try {
    const started = await deps.startRun({ isoWeek: key, triggeredBy: triggeredBy || 'cron' });
    await deps.repo.setWeeklyFields(key, {
      run_id: started.run.run_id,
      products_eligible: started.eligible_count ?? null,
      products_selected: started.selected_count ?? null,
      products_excluded: started.excluded_count ?? null,
    });
    return { iso_week: key, weekly: await deps.repo.getWeeklyRun(key), created: true, run: started.run, selection: started };
  } catch (e) {
    await deps.repo.setWeeklyFields(key, {
      status: 'FAILED',
      completed_at: new Date(),
      error_message: e.code || 'WEEKLY_START_FAILED',
    });
    throw e;
  }
}

/**
 * The continuation cron. Resumes an in-progress weekly run and NOTHING ELSE.
 * With no active run it returns NO_PENDING_WEEKLY_RUN having made zero
 * provider calls and zero writes.
 */
async function continueWeeklyRun(deps, { now } = {}) {
  const active = await deps.repo.findActiveWeeklyRun();
  if (!active) {
    return { resumed: false, reason: 'NO_PENDING_WEEKLY_RUN', iso_week: null };
  }
  if (!active.run_id) {
    return { resumed: false, reason: 'NO_PENDING_WEEKLY_RUN', iso_week: active.iso_week };
  }
  const progress = await deps.resumeRun({ isoWeek: active.iso_week, runId: active.run_id, now });
  return { resumed: true, reason: 'RESUMED', iso_week: active.iso_week, run_id: active.run_id, progress };
}

/** Read-only schedule status for the UI header (§42). Makes no provider call. */
async function scheduleStatus(deps, { now } = {}) {
  const runs = await deps.repo.listWeeklyRuns(1);
  const last = runs[0] || null;
  return {
    enabled: true,
    schedule: WEEKLY.CRON_SCHEDULE,
    schedule_human: 'Every Monday at 01:00 UTC',
    timezone_note: WEEKLY.TIMEZONE_NOTE,
    continuation_schedule: WEEKLY.CONTINUATION_SCHEDULE,
    current_iso_week: weeklyKey(now || new Date()),
    next_scheduled_run: nextScheduledRun(now || new Date()),
    last_run: last && {
      iso_week: last.iso_week,
      started_at: last.started_at,
      completed_at: last.completed_at,
      status: last.status,
      products_selected: last.products_selected,
      fresh_searches_used: last.fresh_searches_used,
      cached_searches_used: last.cached_searches_used,
      gemma_generations: last.gemma_generations,
      script_fallback_generations: last.script_fallback_generations,
    },
  };
}

module.exports = {
  WEEKLY_KEY_PREFIX,
  isoWeekOf,
  weeklyKey,
  nextScheduledRun,
  assertCronAuthorized,
  makeBudget,
  startWeeklyRun,
  continueWeeklyRun,
  scheduleStatus,
};
