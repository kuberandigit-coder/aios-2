'use strict';

// lib/lens-keywords/automation.js
//
// REQ-DM-2026-08-SAJE01 — the ONE automatic workflow (weekly-automation
// prompt §9, §46-48). Both the weekly cron and the single "Run Automation
// Now" button call exactly this code; there is no second, manual-only path
// and no human approval gate anywhere in it.
//
// SHAPE
//   listAllProducts()  -> the SKU-wise table with eligibility evidence (§7).
//                         Read-only. Makes ZERO provider calls, so filtering
//                         and sorting in the UI never costs a search.
//   planRun()          -> what a run WOULD cost right now: products selectable,
//                         live searches needed, cached searches reused,
//                         SerpAPI searches available. Also zero provider calls
//                         beyond the free Account API check.
//   startAutomation()  -> selects, snapshots and creates the run.
//   driveAutomation()  -> pumps both state machines inside a work-time budget,
//                         persisting after every bounded action, so a Vercel
//                         invocation always returns before its timeout and the
//                         next invocation resumes exactly where this one
//                         stopped.
//
// QUOTA RESERVE: automatic consumption stops while fewer than QUOTA_RESERVE
// searches remain across both accounts. The reserve is never spent by the
// scheduler; it exists so an urgent manual investigation is always possible.

const cfg = require('./config');
const { MAX_PRODUCTS_PER_RUN, QUOTA_RESERVE, MAX_CRON_WORK_MS, RUN_TERMINAL, ANALYSIS_TERMINAL } = cfg;

function realDeps() {
  const phase1 = require('./phase1');
  const analysis = require('./analysis');
  return Object.assign(analysis.realDeps(), {
    eligibility: require('./eligibility'),
    cache: require('./cache'),
    weekly: require('./weekly'),
    phase1Api: phase1,
    analysisApi: analysis,
  });
}

// ═══════════════════════ 1. PRODUCT TABLE / SELECTION ══════════════════════

/**
 * Every product in Sajeepan's scope with its eligibility evidence — the
 * "All Products" table (§7). One Ledsone connection, two bulk queries; never
 * one query per product.
 */
async function listAllProducts(deps, { limit } = {}) {
  const client = deps.ledsoneClient();
  try {
    await client.connect();
    const to = await deps.sql.getScopeCutoff(client);
    if (!to) return emptySelection();
    const from = deps.sql.addDays(to, -30);

    const products = await deps.sql.getAllScopedProducts(client, { from, to });
    const attributeCoverage = await deps.sql.getAttributeCoverage(client, products);
    // Existing Google Ads evidence at PRODUCT level: this item genuinely
    // served impressions in Sajeepan's campaigns in the window. Read from the
    // same scope query — no extra round trip.
    const adsEvidence = new Set(
      products.filter((p) => Number(p.impressions_30d) > 0).map((p) => p.item_id)
    );

    const selection = deps.eligibility.evaluateAndSelect(products, {
      attributeCoverage, adsEvidence,
      max: Number.isFinite(limit) ? limit : MAX_PRODUCTS_PER_RUN,
    });
    return Object.assign(selection, { scope_from: from, scope_to: to });
  } finally {
    await client.end().catch(() => {});
  }
}

function emptySelection() {
  return {
    total_candidates: 0, eligible_count: 0, selected_count: 0,
    excluded_capacity_count: 0, excluded_ineligible_count: 0,
    selected: [], excluded_capacity: [], excluded_ineligible: [], all: [],
    scope_from: null, scope_to: null,
  };
}

/** UI-shaped row for the All Products table — no secret, no raw provider blob. */
function productRow(e) {
  const p = e.product || {};
  return {
    sku: p.sku || null,
    item_id: p.item_id || null,
    image_url: p.main_image_url || null,
    current_title: p.title || null,
    product_url: p.listing_url || null,
    same_sku_status: p.sku && p.item_id ? 'RESOLVED' : 'UNRESOLVED',
    image_status: e.breakdown ? (e.breakdown.valid_image ? 'VALID' : 'MISSING') : 'MISSING',
    product_data_status: e.eligible ? 'COMPLETE' : 'INCOMPLETE',
    attribute_coverage: e.breakdown ? (e.breakdown.attribute_evidence ? 'PRESENT' : 'NONE') : 'NONE',
    google_ads_evidence: e.breakdown ? (e.breakdown.existing_ads_evidence ? 'PRESENT' : 'NONE') : 'NONE',
    automation_eligibility: e.eligible ? (e.auto_selected ? 'SELECTED' : 'ELIGIBLE') : 'NOT_ELIGIBLE',
    selection_score: e.score,
    selection_reason: e.selection_reason,
    select_status: e.auto_selected ? 'AUTO_SELECTED' : (e.eligible ? 'ELIGIBLE_NOT_SELECTED' : 'EXCLUDED'),
  };
}

// ═══════════════════════ 2. RUN PLAN (button state) ════════════════════════

/**
 * Everything the single "Run Automation Now" button displays, computed
 * dynamically (§9). Spends no SerpAPI search: the Account API balance check
 * is free and the cache plan is a database read.
 */
async function planRun(deps) {
  const selection = await listAllProducts(deps);
  const country = cfg.LENS_DEFAULTS.COUNTRY;
  const language = cfg.LENS_DEFAULTS.LANGUAGE;

  const lensFingerprints = selection.selected.map((e) => deps.cache.lensFingerprint({
    imageUrl: e.product.main_image_url, country, language,
  }));
  const lensPlan = await deps.cache.planSpend(deps.repo, lensFingerprints);

  const statuses = await deps.quota.checkAllAccounts();
  const available = deps.quota.totalUsableCredits(statuses);
  const spendable = Math.max(0, available - QUOTA_RESERVE);

  // Phase 2 costs up to 3 further searches per product, but its fingerprints
  // depend on the Phase 1 primary keyword, which does not exist until Phase 1
  // has run. It is reported as an UPPER BOUND, never as a settled number.
  const phase2Upper = selection.selected_count * 3;

  return {
    products_selected: selection.selected_count,
    products_eligible: selection.eligible_count,
    products_excluded: selection.excluded_ineligible_count,
    live_searches_needed: lensPlan.live_searches,
    cached_searches_reused: lensPlan.cached_searches,
    phase2_searches_upper_bound: phase2Upper,
    serpapi_searches_available: available,
    quota_reserve: QUOTA_RESERVE,
    spendable_searches: spendable,
    run_ready: selection.selected_count > 0 && lensPlan.live_searches <= spendable,
    not_ready_reason: selection.selected_count === 0
      ? 'No product currently meets the automation eligibility requirements.'
      : (lensPlan.live_searches > spendable
        ? `This run needs ${lensPlan.live_searches} live searches but only ${spendable} are spendable (a ${QUOTA_RESERVE}-search reserve is never used automatically).`
        : null),
    accounts: statuses.map(require('./phase1').publicQuota),
  };
}

// ═══════════════════════ 3. START ══════════════════════════════════════════

/**
 * Select up to 50 products automatically and create the run. Never pads: if
 * only 31 products qualify, 31 are processed and the true counts are stored.
 */
async function startAutomation(deps, { createdBy, idempotencyKey, batchType } = {}) {
  const selection = await listAllProducts(deps);
  if (!selection.selected_count) {
    const e = new Error('No product currently meets the automation eligibility requirements.');
    e.status = 400; e.code = cfg.ERRORS.NO_ELIGIBLE_PRODUCTS;
    e.detail = { eligible: selection.eligible_count, excluded: selection.excluded_ineligible_count };
    throw e;
  }

  const skus = selection.selected.map((e) => e.sku);
  const { run, reused } = await deps.phase1Api.createRun(deps, {
    createdBy: createdBy || 'automation',
    skus,
    idempotencyKey,
  });

  if (!reused) {
    await deps.repo.setRunFields(run.run_id, { batch_type: batchType || 'MANUAL' });
    // Persist the selection evidence so the UI can show WHY each product is here.
    const products = await deps.repo.getRunProducts(run.run_id);
    const bySku = new Map(selection.selected.map((e) => [e.sku, e]));
    for (const p of products) {
      const e = bySku.get(p.sku);
      if (!e) continue;
      await deps.repo.setProductSelection(p.run_product_id, {
        selection_score: e.score, selection_reason: e.selection_reason, auto_selected: true,
      });
    }
  }

  return {
    run, reused,
    eligible_count: selection.eligible_count,
    selected_count: selection.selected_count,
    excluded_count: selection.excluded_ineligible_count,
  };
}

// ═══════════════════════ 4. DRIVE ══════════════════════════════════════════

/**
 * Pump both state machines until the run is finished or the work budget is
 * spent. Every iteration is ONE bounded action that persists its own result
 * before returning, so being cut off mid-run is always safe and always
 * resumable — the next invocation simply claims the next unfinished unit.
 *
 * The Lens phase must reach a terminal state before the analysis phase starts;
 * that ordering is unchanged. What CHANGED is that no human decision sits
 * between them any more — competitor decisions are already recorded
 * automatically at capture time (phase1.decideCompetitors).
 */
async function driveAutomation(deps, runId, { budgetMs, maxSteps } = {}) {
  const budget = deps.weekly.makeBudget(Date.now(), Number.isFinite(budgetMs) ? budgetMs : MAX_CRON_WORK_MS);
  const stepCap = Number.isFinite(maxSteps) ? maxSteps : 10000;
  let steps = 0;
  let lensSteps = 0;
  let analysisSteps = 0;

  while (steps < stepCap && !budget.exhausted()) {
    const run = await deps.repo.getRun(runId);
    if (!run) break;

    if (!RUN_TERMINAL.includes(run.status)) {
      await deps.phase1Api.advanceRun(deps, runId);
      lensSteps += 1; steps += 1;
      continue;
    }

    if (!run.analysis_status) {
      await deps.analysisApi.startAnalysis(deps, runId);
      steps += 1;
      continue;
    }
    if (ANALYSIS_TERMINAL.includes(run.analysis_status)) {
      return finished(deps, runId, { steps, lensSteps, analysisSteps, budget });
    }

    await deps.analysisApi.advanceAnalysis(deps, runId);
    analysisSteps += 1; steps += 1;
  }

  const run = await deps.repo.getRun(runId);
  const complete = run && RUN_TERMINAL.includes(run.status)
    && run.analysis_status && ANALYSIS_TERMINAL.includes(run.analysis_status);
  if (complete) return finished(deps, runId, { steps, lensSteps, analysisSteps, budget });

  return {
    complete: false,
    reason: budget.exhausted() ? 'WORK_BUDGET_REACHED' : 'STEP_CAP_REACHED',
    steps, lens_steps: lensSteps, analysis_steps: analysisSteps,
    elapsed_ms: budget.elapsed(),
    run_status: run && run.status,
    analysis_status: run && run.analysis_status,
  };
}

async function finished(deps, runId, ctx) {
  const run = await deps.repo.getRun(runId);
  return {
    complete: true, reason: 'COMPLETED',
    steps: ctx.steps, lens_steps: ctx.lensSteps, analysis_steps: ctx.analysisSteps,
    elapsed_ms: ctx.budget.elapsed(),
    run_status: run && run.status,
    analysis_status: run && run.analysis_status,
    searches_used: run && run.searches_used,
    cached_searches_used: run && run.cached_searches_used,
  };
}

// ═══════════════════════ 5. WEEKLY ENTRY POINTS ════════════════════════════

/** The weekly cron's whole job: one run per ISO week, then drive it. */
async function runWeekly(deps, { now, triggeredBy, budgetMs } = {}) {
  // startWeeklyRun owns the once-per-week guard; it calls startRun ONLY when
  // this invocation genuinely created the week's row, so product selection and
  // run creation can never happen twice for one ISO week.
  const withStart = Object.assign({}, deps, {
    startRun: ({ isoWeek }) => startAutomation(deps, {
      createdBy: 'weekly-automation',
      idempotencyKey: isoWeek,
      batchType: 'WEEKLY',
    }),
  });
  const started = await deps.weekly.startWeeklyRun(withStart, { now, triggeredBy });
  if (!started.created) {
    // Already ran (or is running) this week — resume it, never duplicate it.
    if (started.weekly && started.weekly.run_id) {
      const progress = await driveAutomation(deps, started.weekly.run_id, { budgetMs });
      await syncWeekly(deps, started.iso_week, started.weekly.run_id, progress);
      return { iso_week: started.iso_week, created: false, reason: started.reason, progress };
    }
    return { iso_week: started.iso_week, created: false, reason: started.reason, progress: null };
  }

  if (started.weekly) {
    await deps.repo.setRunFields(started.run.run_id, { weekly_run_id: started.weekly.weekly_run_id });
  }
  const progress = await driveAutomation(deps, started.run.run_id, { budgetMs });
  await syncWeekly(deps, started.iso_week, started.run.run_id, progress);
  return { iso_week: started.iso_week, created: true, run_id: started.run.run_id, selection: started.selection, progress };
}

/** The continuation cron's whole job: resume, or do nothing at all. */
async function continueWeekly(deps, { now, budgetMs } = {}) {
  return deps.weekly.continueWeeklyRun(Object.assign({}, deps, {
    resumeRun: async ({ isoWeek, runId }) => {
      const progress = await driveAutomation(deps, runId, { budgetMs });
      await syncWeekly(deps, isoWeek, runId, progress);
      return progress;
    },
  }), { now });
}

/** Mirror the run's real counters onto the weekly row. Never estimates. */
async function syncWeekly(deps, isoWeek, runId, progress) {
  const run = await deps.repo.getRun(runId);
  if (!run) return;
  const fields = {
    fresh_searches_used: run.searches_used || 0,
    cached_searches_used: run.cached_searches_used || 0,
    products_selected: run.products_total || 0,
  };
  if (progress && progress.complete) {
    fields.status = run.status === cfg.RUN_STATE.FAILED ? 'FAILED'
      : (run.status === cfg.RUN_STATE.COMPLETED_WITH_WARNINGS ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED');
    fields.completed_at = new Date();
    const gen = await countGenerations(deps, runId);
    fields.gemma_generations = gen.gemma;
    fields.script_fallback_generations = gen.script;
  }
  await deps.repo.setWeeklyFields(isoWeek, fields);
}

async function countGenerations(deps, runId) {
  const r = await deps.repo.query(
    `SELECT
       count(*) FILTER (WHERE generation_source LIKE 'GEMMA%')::int AS gemma,
       count(*) FILTER (WHERE generation_source = 'SCRIPT_FALLBACK')::int AS script
     FROM public.google_lens_keyword_generation WHERE run_id = $1`,
    [runId]
  );
  return r.rows[0] || { gemma: 0, script: 0 };
}

module.exports = {
  realDeps,
  listAllProducts,
  productRow,
  planRun,
  startAutomation,
  driveAutomation,
  runWeekly,
  continueWeekly,
  syncWeekly,
};
