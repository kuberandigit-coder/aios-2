'use strict';

// lib/lens-keywords/router.js
//
// REQ-DM-2026-08-SAJE01 — endpoint routing for the Automation Keyword Finder
// (Phase 1: Same SKU -> Google Lens -> Competitor Result Capture -> Review).
//
// NO NEW VERCEL FUNCTION. Everything reaches this module through the existing
// api/members-api.js dispatcher (?member=sajeepan&type=lens-keyword-*). The
// project deploys exactly 12 functions — the Hobby-plan ceiling — so an
// api/lens-keywords.js would fail the build. Same pattern as lib/stpm/router.js
// (?fn=mahima-stpm-*, routed through api/requirement.js).
//
// SECURITY POSTURE (mirrors lib/stpm/router.js exactly)
//   Every endpoint — read AND write — requires a valid dm_session. Writes
//   require POST. No wildcard CORS is set by this module (members-api.js sets
//   Access-Control-Allow-Origin: * globally for the whole file today — that is
//   a pre-existing gap this module does not widen, and does not attempt to fix
//   for other members' routes; see ARCHITECTURE.md §10 finding 1).

const session = require('../feed/session');
const phase1 = require('./phase1');
const analysis = require('./analysis');
const automation = require('./automation');
const weekly = require('./weekly');
const repo = require('./repo');
const review = require('./review');
const exporter = require('./export');
const quota = require('./quota');
const sql = require('./sql');
const cfg = require('./config');
const errors = require('./errors');

// Production dependency wiring, built once per warm instance and reused
// across requests — see phase1.js's DEPENDENCY INJECTION note. analysis.js's
// deps is a superset of phase1's (same ledsoneClient/repo/quota/serpapi plus
// the Stage 4-12 modules), so one object serves every endpoint below.
const deps = automation.realDeps();

// Routes driven by Vercel Cron, NOT by a browser. They authenticate with a
// CRON_SECRET bearer token and FAIL CLOSED. A staff dm_session is deliberately
// not accepted here and is never a substitute for the secret — see weekly.js.
const CRON_TYPES = new Set(['lens-keyword-weekly-run', 'lens-keyword-weekly-continue']);

// Own allow-list — lib/feed/session.js's isAllowed() is scoped to Thivajini.
const ALLOWED_STAFF = new Set(['sajeepan', 'dilaikshan']);

function requireLensSession(req, res) {
  const s = session.verifySession(req);
  if (!s) { json(res, 401, { ok: false, error: 'Unauthorised — sign in required.' }); return null; }
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

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function requirePost(req, res) {
  if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'This action requires POST.' }); return false; }
  return true;
}

function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

async function ledsoneQuery(fn) {
  const client = deps.ledsoneClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handle(req, res, type) {
  if (CRON_TYPES.has(type)) return handleCron(req, res, type);

  const s = requireLensSession(req, res);
  if (!s) return;
  const actor = session.actorOf(s);

  try {
    switch (type) {
      case 'lens-keyword-products': {
        const q = req.query.q ? String(req.query.q) : null;
        const limit = Number(req.query.limit) || 60;
        const offset = Number(req.query.offset) || 0;
        const rows = await ledsoneQuery(async (client) => {
          const cutoffRaw = await sql.getScopeCutoff(client);
          const to = cutoffRaw || sql.isoDate(new Date());
          const from = sql.addDays(to, -29);
          return sql.searchScopedProducts(client, { from, to, q, limit, offset });
        });
        const products = rows.map((r) => {
          const dq = sql.classifyDataQuality(r);
          return {
            sku: r.sku, mapped_sku: r.mapped_sku, item_id: r.item_id,
            title: r.title, image_url: r.main_image_url, product_url: r.listing_url,
            product_type: r.product_type, is_parent: !!r.is_parent,
            data_quality: dq.quality, selectable: dq.selectable, reason: dq.reason,
          };
        });
        return json(res, 200, { ok: true, products, max_products_per_run: cfg.MAX_PRODUCTS_PER_RUN });
      }

      case 'lens-keyword-quota': {
        const statuses = await quota.checkAllAccounts();
        await repo.saveQuotaSnapshot(null, statuses, 'MANUAL_CHECK');
        return json(res, 200, {
          ok: true,
          accounts: statuses.map((a) => phase1.publicQuota(a)),
          total_searches_left: quota.totalUsableCredits(statuses),
        });
      }

      case 'lens-keyword-run-create': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const skus = Array.isArray(body.skus) ? body.skus : [];
        try {
          const out = await phase1.createRun(deps, {
            createdBy: actor, skus,
            country: body.country, language: body.language,
            idempotencyKey: body.idempotency_key,
          });
          return json(res, 200, { ok: true, run: out.run, reused: out.reused });
        } catch (e) {
          if (e.code === cfg.ERRORS.INSUFFICIENT_QUOTA) {
            return json(res, 400, { ok: false, error: e.message, code: e.code, detail: e.detail });
          }
          throw e;
        }
      }

      case 'lens-keyword-run-advance': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const out = await phase1.advanceRun(deps, runId);
        return json(res, 200, { ok: true, ...out });
      }

      case 'lens-keyword-run-status': {
        const runId = String(req.query.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const run = await repo.getRun(runId);
        if (!run) return json(res, 404, { ok: false, error: 'That run could not be found.' });
        const products = await repo.getRunProducts(runId);
        return json(res, 200, {
          ok: true, run,
          done: cfg.RUN_TERMINAL.includes(run.status),
          products: products.map((p) => ({
            sku: p.sku, seq: p.seq, state: p.state, result_count: p.result_count,
            title: p.product_title_snapshot, image_url: p.image_url_snapshot,
            error_detail_safe: p.error_detail_safe,
          })),
        });
      }

      case 'lens-keyword-run-results': {
        const runId = String(req.query.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const run = await repo.getRun(runId);
        if (!run) return json(res, 404, { ok: false, error: 'That run could not be found.' });
        const opts = filtersFromQuery(req.query);
        const results = await repo.listResults(runId, opts);
        return json(res, 200, { ok: true, run, ...results });
      }

      case 'lens-keyword-run-history': {
        const runs = await repo.listRuns(Number(req.query.limit) || 10);
        return json(res, 200, { ok: true, runs });
      }

      case 'lens-keyword-competitor-review': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const row = await review.setReview({
          competitor_result_id: Number(body.competitor_result_id),
          review_status: body.review_status,
          review_reason: body.review_reason,
          reviewed_by: actor,
        });
        return json(res, 200, { ok: true, review: row });
      }

      case 'lens-keyword-export': {
        const runId = String(req.query.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const run = await repo.getRun(runId);
        if (!run) return json(res, 404, { ok: false, error: 'That run could not be found.' });
        const rows = await repo.allResultsForExport(runId, filtersFromQuery(req.query));
        const file = exporter.build(runId, rows);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(file.body);
      }

      case 'lens-keyword-telemetry': {
        const t = await repo.telemetry();
        return json(res, 200, { ok: true, ...t, requirement_id: cfg.REQUIREMENT_ID });
      }

      // ── Stages 4-12: analysis pipeline ──────────────────────────────────
      case 'lens-keyword-analysis-start': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const out = await analysis.startAnalysis(deps, runId);
        return json(res, 200, { ok: true, run: out.run, already_started: out.already_started });
      }

      case 'lens-keyword-analysis-advance': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const out = await analysis.advanceAnalysis(deps, runId);
        return json(res, 200, { ok: true, ...out });
      }

      case 'lens-keyword-analysis-status': {
        const runId = String(req.query.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const run = await repo.getRun(runId);
        if (!run) return json(res, 404, { ok: false, error: 'That run could not be found.' });
        const products = await repo.getRunProducts(runId);
        return json(res, 200, {
          ok: true,
          analysis_status: run.analysis_status,
          done: cfg.ANALYSIS_TERMINAL.includes(run.analysis_status),
          counts: await repo.recountAnalysis(runId),
          products: products.map((p) => ({
            sku: p.sku, analysis_stage: p.analysis_stage,
            phase1_primary_keyword: p.phase1_primary_keyword,
          })),
        });
      }

      case 'lens-keyword-product-report': {
        const runId = String(req.query.run_id || '').trim();
        const sku = String(req.query.sku || '').trim();
        if (!isUuid(runId) || !sku) return json(res, 400, { ok: false, error: 'A valid run id and SKU are required.' });
        const rp = await repo.getRunProductBySku(runId, sku);
        if (!rp) return json(res, 404, { ok: false, error: 'That product could not be found in this run.' });

        const [competitors, phase1Keywords, phase2Results, phase2Keywords, plannerSuggestions, attributeValidations, finalTitle, finalAltText, finalAdsKeywords] = await Promise.all([
          repo.listResults(runId, { sku, limit: 500 }).then((r) => r.rows),
          repo.getCandidates(rp.run_product_id, 'PHASE1'),
          repo.getPhase2Results(rp.run_product_id),
          repo.getCandidates(rp.run_product_id, 'PHASE2'),
          repo.getPlannerSuggestionsForRunProduct(rp.run_product_id),
          repo.getAttributeValidations(rp.run_product_id),
          repo.getFinalTitle(rp.run_product_id),
          repo.getFinalAltText(rp.run_product_id),
          repo.getFinalAdsKeywords(rp.run_product_id),
        ]);

        return json(res, 200, {
          ok: true,
          product: rp,
          competitor_evidence: competitors,
          phase1_keywords: phase1Keywords,
          phase2_results: phase2Results,
          phase2_keywords: phase2Keywords,
          planner_suggestions: plannerSuggestions,
          attribute_validation: attributeValidations,
          final_title: finalTitle,
          final_alt_text: finalAltText,
          final_ads_keywords: finalAdsKeywords,
        });
      }

      case 'lens-keyword-title-save': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        const sku = String(body.sku || '').trim();
        const finalTitleText = String(body.final_title || '').trim();
        if (!isUuid(runId) || !sku || !finalTitleText) {
          return json(res, 400, { ok: false, error: 'A valid run id, SKU and final title are required.' });
        }
        const rp = await repo.getRunProductBySku(runId, sku);
        if (!rp) return json(res, 404, { ok: false, error: 'That product could not be found in this run.' });
        const row = await repo.saveFinalTitleChoice(rp.run_product_id, finalTitleText, actor);
        return json(res, 200, { ok: true, final_title: row });
      }

      case 'lens-keyword-alt-save': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        const sku = String(body.sku || '').trim();
        const finalAltTextValue = String(body.final_alt_text || '').trim();
        if (!isUuid(runId) || !sku || !finalAltTextValue) {
          return json(res, 400, { ok: false, error: 'A valid run id, SKU and final alt text are required.' });
        }
        const rp = await repo.getRunProductBySku(runId, sku);
        if (!rp) return json(res, 404, { ok: false, error: 'That product could not be found in this run.' });
        const row = await repo.saveFinalAltTextChoice(rp.run_product_id, finalAltTextValue, actor);
        return json(res, 200, { ok: true, final_alt_text: row });
      }

      // ── Weekly automation (read-only views + the one manual trigger) ─────
      case 'lens-keyword-all-products': {
        // The SKU-wise All Products table. Read-only: zero provider calls, so
        // filtering and sorting in the UI can never cost a search.
        const selection = await automation.listAllProducts(deps);
        return json(res, 200, {
          ok: true,
          max_products_per_run: cfg.MAX_PRODUCTS_PER_RUN,
          scope_from: selection.scope_from,
          scope_to: selection.scope_to,
          counts: {
            total: selection.total_candidates,
            eligible: selection.eligible_count,
            selected: selection.selected_count,
            excluded_ineligible: selection.excluded_ineligible_count,
            excluded_capacity: selection.excluded_capacity_count,
          },
          products: selection.all.map(automation.productRow),
        });
      }

      case 'lens-keyword-run-plan': {
        const plan = await automation.planRun(deps);
        return json(res, 200, { ok: true, plan });
      }

      case 'lens-keyword-run-automation': {
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const started = await automation.startAutomation(deps, {
          createdBy: actor,
          idempotencyKey: body.idempotency_key,
          batchType: 'MANUAL',
        });
        return json(res, 200, {
          ok: true, run: started.run, reused: started.reused,
          eligible_count: started.eligible_count,
          selected_count: started.selected_count,
          excluded_count: started.excluded_count,
        });
      }

      case 'lens-keyword-automation-advance': {
        // The browser pumps the same workflow the cron pumps. Bounded per
        // request so a tab is never blocked on a long batch.
        if (!requirePost(req, res)) return;
        const body = readBody(req);
        const runId = String(body.run_id || '').trim();
        if (!isUuid(runId)) return json(res, 400, { ok: false, error: 'A valid run id is required.' });
        const out = await automation.driveAutomation(deps, runId, { budgetMs: 20000, maxSteps: 12 });
        return json(res, 200, { ok: true, ...out });
      }

      case 'lens-keyword-weekly-status': {
        const status = await weekly.scheduleStatus(deps, {});
        const cacheStats = await repo.searchCacheStats(cfg.CACHE_TTL_DAYS);
        return json(res, 200, { ok: true, schedule: status, search_cache: cacheStats });
      }

      case 'lens-keyword-weekly-history': {
        // Reading history NEVER re-triggers a provider call — it is a pure
        // database read of what already happened.
        const runs = await repo.listWeeklyRuns(Number(req.query.limit) || 12);
        return json(res, 200, { ok: true, weekly_runs: runs });
      }

      case 'lens-keyword-generation': {
        const runId = String(req.query.run_id || '').trim();
        const sku = String(req.query.sku || '').trim();
        if (!isUuid(runId) || !sku) return json(res, 400, { ok: false, error: 'A valid run id and SKU are required.' });
        const rp = await repo.getRunProductBySku(runId, sku);
        if (!rp) return json(res, 404, { ok: false, error: 'That product could not be found in this run.' });
        return json(res, 200, { ok: true, generation: await repo.getGeneration(rp.run_product_id) });
      }

      default:
        return json(res, 404, { ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return errors.respond(res, err, type);
  }
}

/**
 * Cron-only routes. CRON_SECRET bearer auth, fail closed, no session path.
 *
 *   lens-keyword-weekly-run      — starts THIS ISO week's run if it has none,
 *                                  then drives it. A retry returns the same
 *                                  run; it never creates a second one.
 *   lens-keyword-weekly-continue — resumes an in-progress weekly run ONLY.
 *                                  With nothing pending it returns
 *                                  NO_PENDING_WEEKLY_RUN having spent nothing.
 */
async function handleCron(req, res, type) {
  try {
    weekly.assertCronAuthorized(req);
  } catch (e) {
    return json(res, e.status || 401, { ok: false, error: e.message, code: e.code });
  }

  try {
    if (type === 'lens-keyword-weekly-run') {
      const out = await automation.runWeekly(deps, { triggeredBy: 'cron' });
      return json(res, 200, { ok: true, ...out });
    }
    const out = await automation.continueWeekly(deps, {});
    return json(res, 200, { ok: true, ...out });
  } catch (err) {
    return errors.respond(res, err, type);
  }
}

function filtersFromQuery(q) {
  const pick = (v, max) => (v === undefined || v === null ? null : String(v).slice(0, max || 60));
  return {
    sku: pick(q.sku, 120),
    review_status: cfg.REVIEW_VALUES.includes(q.review_status) ? q.review_status : null,
    domain: pick(q.domain, 120),
    has_image: q.has_image === '1' || q.has_image === 'true',
    has_title: q.has_title === '1' || q.has_title === 'true',
    exclude_self: q.include_self === '1' || q.include_self === 'true' ? false : true,
    exclude_duplicates: q.include_duplicates === '1' || q.include_duplicates === 'true' ? false : true,
    sort: pick(q.sort, 40),
    dir: q.dir === 'desc' ? 'desc' : 'asc',
    limit: Number(q.limit) || 100,
    offset: Number(q.offset) || 0,
  };
}

module.exports = { handle, handleCron, CRON_TYPES, requireLensSession, ALLOWED_STAFF, filtersFromQuery };
