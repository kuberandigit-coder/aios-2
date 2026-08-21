'use strict';

// lib/stpm/router.js
//
// REQ-DM-2026-08-MAHI01 — endpoint routing for the STPM feature.
//
// NO NEW VERCEL FUNCTION. Everything reaches this module through the existing
// api/requirement.js dispatcher (?fn=mahima-stpm-*). The project deploys exactly
// 12 functions — the Hobby-plan ceiling, verified live — so an api/stpm.js would
// fail the build.
//
// SECURITY POSTURE
//   ARCHITECTURE.md §10 finding 1 records that most routes in this dashboard do
//   not enforce the session, and that several set Access-Control-Allow-Origin: *.
//   This module deliberately does NOT inherit that: every endpoint requires a
//   valid dm_session, writes require POST, and no wildcard CORS header is ever
//   set. Identity always comes from the verified session, never from the body.

const session = require('../feed/session');
const service = require('./service');
const repo = require('./repo');
const exporter = require('./export');
const cfg = require('./config');

// Reuses the proven HMAC session verifier, but with this feature's own
// allow-list — lib/feed/session.js is scoped to Thivajini.
const ALLOWED_STAFF = new Set(['mahima', 'dilaikshan']);

function requireStpmSession(req, res) {
  const s = session.verifySession(req);
  if (!s) {
    json(res, 401, { ok: false, error: 'Unauthorised — sign in required.' });
    return null;
  }
  if (s.role !== 'admin' && !ALLOWED_STAFF.has(s.staff_key)) {
    json(res, 403, { ok: false, error: 'Forbidden — not permitted for this dashboard.' });
    return null;
  }
  return s;
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/** Body parsing that tolerates both parsed and raw payloads. */
function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function requirePost(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'This action requires POST.' });
    return false;
  }
  return true;
}

/**
 * Turn an internal error into something safe for a staff screen.
 * Technical detail is logged server-side; the user gets plain language.
 */
function fail(res, err, context) {
  const status = err && err.status ? err.status : 500;
  const code = err && err.code ? err.code : 'STPM_ERROR';

  console.error(`[stpm/${context}] ${code}: ${service.safeMessage(err)}`);

  const MESSAGES = {
    [cfg.ERRORS.LEDSONE_MISSING]:
      'Search-term data could not be loaded. Please try again or contact the technical team.',
    [cfg.ERRORS.APP_MISSING]:
      'Run history storage is not configured. Please contact the technical team.',
    [cfg.ERRORS.MIGRATION_MISSING]:
      'Run history storage is not initialised yet. Please contact the technical team.',
    STPM_RUN_NOT_FOUND: 'That run could not be found.',
    STPM_RESULT_NOT_FOUND: 'That result row could not be found.',
  };

  // 4xx messages are authored to be shown; 5xx never echo internals.
  const message = MESSAGES[code] ||
    (status >= 400 && status < 500 && err && err.message
      ? err.message
      : 'Something went wrong loading this view. Please try again or contact the technical team.');

  json(res, status, { ok: false, error: message, code });
}

async function handle(req, res, fn) {
  // Reads are as protected as writes: this view exposes spend, margin-adjacent
  // performance and staff review notes.
  const s = requireStpmSession(req, res);
  if (!s) return;

  try {
    switch (fn) {
      case 'mahima-stpm-metadata': {
        const meta = await service.getMetadata();
        return json(res, 200, { ok: true, ...meta });
      }

      case 'mahima-stpm-run': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const out = await service.runNow({
          campaign_ids: body.campaign_ids,
          current: body.current,
          historical: body.historical,
          idempotency_key: body.idempotency_key,
        }, s);
        return json(res, 200, { ok: true, run: out.run, reused: out.reused });
      }

      case 'mahima-stpm-runs': {
        const runs = await service.listRuns(Number(req.query.limit) || 10);
        return json(res, 200, { ok: true, runs });
      }

      case 'mahima-stpm-run-detail': {
        const runId = String(req.query.run_id || '').trim();
        if (!isUuid(runId)) {
          return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        }
        const detail = await service.getRunDetail(runId, filtersFromQuery(req.query));
        return json(res, 200, { ok: true, run: detail.run, ...detail.results });
      }

      case 'mahima-stpm-review': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const resultId = Number(body.result_id);
        if (!Number.isInteger(resultId) || resultId <= 0) {
          return json(res, 400, { ok: false, error: 'A valid result id is required.' });
        }
        if (!cfg.REVIEW_VALUES.includes(body.review_status)) {
          return json(res, 400, {
            ok: false,
            error: `Review status must be one of: ${cfg.REVIEW_VALUES.join(', ')}.`,
          });
        }
        // Reviewer identity comes from the session, never from the request body.
        const row = await service.setReview({
          result_id: resultId,
          review_status: body.review_status,
          reviewer: String(s.username || s.staff_key),
          note: body.note,
        });
        return json(res, 200, { ok: true, review: row });
      }

      case 'mahima-stpm-export': {
        const runId = String(req.query.run_id || '').trim();
        const type = String(req.query.type || 'full');
        if (!isUuid(runId)) {
          return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        }
        if (!['full', 'negative', 'opportunity'].includes(type)) {
          return json(res, 400, { ok: false, error: 'Unknown export type.' });
        }
        const run = await repo.getRun(runId);
        if (!run) return json(res, 404, { ok: false, error: 'That run could not be found.' });

        const rows = await repo.allResultsForExport(runId, filtersFromQuery(req.query));
        const file = exporter.build(type, rows, run);

        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(file.body);
      }

      case 'mahima-stpm-telemetry': {
        // Proves at runtime which database was actually reached, without ever
        // revealing how to reach it.
        const t = await repo.telemetry();
        return json(res, 200, { ok: true, ...t, requirement_id: cfg.REQUIREMENT_ID });
      }

      default:
        return json(res, 404, { ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return fail(res, err, fn);
  }
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Whitelisted, bounded filter/sort/page inputs. */
function filtersFromQuery(q) {
  const pick = (v, max) => (v === undefined || v === null ? null : String(v).slice(0, max || 60));
  return {
    campaign_id: /^\d{1,19}$/.test(String(q.campaign_id || '')) ? String(q.campaign_id) : null,
    decision: cfg.DECISION_VALUES.includes(q.decision) ? q.decision : null,
    performance_status: pick(q.performance_status, 40),
    mapping_status: pick(q.mapping_status, 40),
    review_status: cfg.REVIEW_VALUES.includes(q.review_status) ? q.review_status : null,
    negative_only: q.negative_only === '1' || q.negative_only === 'true',
    opportunity_only: q.opportunity_only === '1' || q.opportunity_only === 'true',
    search: pick(q.search, 120),
    product: pick(q.product, 120),
    sort: pick(q.sort, 40),
    dir: q.dir === 'asc' ? 'asc' : 'desc',
    limit: Number(q.limit) || 50,
    offset: Number(q.offset) || 0,
  };
}

module.exports = { handle, requireStpmSession, ALLOWED_STAFF, filtersFromQuery };
