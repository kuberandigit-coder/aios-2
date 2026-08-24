'use strict';

// tests/lens-keywords/automation.test.js
//
// REQ-DM-2026-08-SAJE01 — the fully-automatic weekly workflow (§61).
// Pure logic and injected fakes only: no database, no network, no SerpAPI
// credit is spent by anything in this file.

const test = require('node:test');
const assert = require('node:assert');

const cfg = require('../../lib/lens-keywords/config');
const eligibility = require('../../lib/lens-keywords/eligibility');
const competitorFilter = require('../../lib/lens-keywords/competitor-filter');
const cache = require('../../lib/lens-keywords/cache');
const weekly = require('../../lib/lens-keywords/weekly');
const gemma = require('../../lib/lens-keywords/gemma');
const automation = require('../../lib/lens-keywords/automation');

function product(i, over) {
  return Object.assign({
    id: i,
    item_id: `IT${String(i).padStart(4, '0')}`,
    sku: `LDW${String(i).padStart(5, '0')}`,
    title: `Brass Pendant Ceiling Light Fixture ${i}`,
    main_image_url: `https://cdn.example/img/${i}.jpg?v=123`,
    listing_url: `https://ledsone.co.uk/products/item-${i}`,
    product_type: 'Pendant Light',
    impressions_30d: 100,
  }, over || {});
}

// ═══════════════════════ PRODUCT SELECTION (§7-8) ══════════════════════════

test('at most 50 products are ever auto-selected, however many qualify', () => {
  const products = Array.from({ length: 120 }, (_, i) => product(i + 1));
  const out = eligibility.evaluateAndSelect(products, {
    attributeCoverage: new Set(products.map((p) => p.sku)),
    adsEvidence: new Set(products.map((p) => p.item_id)),
  });
  assert.strictEqual(out.eligible_count, 120);
  assert.strictEqual(out.selected_count, cfg.MAX_PRODUCTS_PER_RUN);
  assert.strictEqual(out.selected_count, 50);
  assert.strictEqual(out.excluded_capacity_count, 70);
});

test('fewer than 50 eligible products are NEVER padded with ineligible ones', () => {
  const good = Array.from({ length: 6 }, (_, i) => product(i + 1));
  const bad = Array.from({ length: 40 }, (_, i) => product(100 + i, { sku: null }));
  const out = eligibility.evaluateAndSelect(good.concat(bad), {});
  assert.strictEqual(out.selected_count, 6, 'processes 6, not 46');
  assert.strictEqual(out.excluded_ineligible_count, 40);
  assert.ok(out.selected.every((e) => e.eligible));
});

test('a product missing SKU, image, title or URL is excluded outright with a stated reason', () => {
  const cases = [
    ['sku', { sku: null }, /SKU/i],
    ['image', { main_image_url: null }, /image/i],
    ['title', { title: 'x' }, /title/i],
    ['url', { listing_url: 'not-a-url' }, /URL/i],
  ];
  for (const [label, over, reasonRe] of cases) {
    const gate = eligibility.gateProduct(product(1, over));
    assert.strictEqual(gate.eligible, false, `${label} must gate out`);
    assert.match(gate.reasons.join(' '), reasonRe);
  }
});

test('the completeness score uses the requirement weights and sums to 100 at full coverage', () => {
  const { score, breakdown } = eligibility.scoreProduct(product(1), {
    hasAttributeEvidence: true, hasAdsEvidence: true,
  });
  assert.strictEqual(score, 100);
  assert.strictEqual(breakdown.same_sku_identity, cfg.SELECTION_WEIGHTS.SAME_SKU_IDENTITY);
  assert.strictEqual(breakdown.attribute_evidence, cfg.SELECTION_WEIGHTS.ATTRIBUTE_EVIDENCE);
  assert.strictEqual(breakdown.existing_ads_evidence, cfg.SELECTION_WEIGHTS.EXISTING_ADS_EVIDENCE);
  assert.strictEqual(
    Object.values(cfg.SELECTION_WEIGHTS).reduce((a, b) => a + b, 0), 100,
    'the published weights must actually total 100'
  );
});

test('a product with attribute and Ads evidence outranks one without', () => {
  const rich = product(1);
  const thin = product(2);
  const out = eligibility.evaluateAndSelect([thin, rich], {
    attributeCoverage: new Set([rich.sku]),
    adsEvidence: new Set([rich.item_id]),
    max: 1,
  });
  assert.strictEqual(out.selected[0].sku, rich.sku);
  assert.match(out.excluded_capacity[0].selection_reason, /Missing/);
});

test('equal scores break ties deterministically by SKU, so two runs select the same set', () => {
  const products = Array.from({ length: 5 }, (_, i) => product(i + 1));
  const a = eligibility.evaluateAndSelect(products, { max: 3 });
  const b = eligibility.evaluateAndSelect(products.slice().reverse(), { max: 3 });
  assert.deepStrictEqual(a.selected.map((e) => e.sku), b.selected.map((e) => e.sku));
});

test('the selection summary reports true eligible / selected / excluded counts', () => {
  const products = Array.from({ length: 67 }, (_, i) => product(i + 1))
    .concat(Array.from({ length: 23 }, (_, i) => product(200 + i, { main_image_url: null })));
  const out = eligibility.evaluateAndSelect(products, {});
  assert.strictEqual(out.eligible_count, 67);
  assert.strictEqual(out.selected_count, 50);
  assert.strictEqual(out.excluded_ineligible_count, 23);
});

// ═══════════════════ COMPETITOR AUTO-DECISION (§14-16) ═════════════════════

const OWN = {
  product_title_snapshot: 'Brass Pendant Ceiling Light',
  product_type_snapshot: 'Pendant Light',
};

function match(over) {
  return Object.assign({
    rank: 1, title: 'Brass Pendant Ceiling Light Fitting',
    url: 'https://rival.example/p/1', image_src: 'https://rival.example/t.jpg',
    source_name: 'rival.example', is_self_result: false, is_duplicate: false,
  }, over || {});
}

test('our own listing is auto-excluded as a self result, never scored in', () => {
  const d = competitorFilter.decideOne(match({ is_self_result: true }), OWN, {});
  assert.strictEqual(d.auto_decision, cfg.AUTO_DECISION.EXCLUDED_SELF);
  assert.ok(d.decision_reasons.length);
});

test('a technical duplicate is auto-excluded', () => {
  const d = competitorFilter.decideOne(match({ is_duplicate: true }), OWN, {});
  assert.strictEqual(d.auto_decision, cfg.AUTO_DECISION.EXCLUDED_DUPLICATE);
});

test('a match with no title or no URL is auto-excluded as missing data', () => {
  assert.strictEqual(competitorFilter.decideOne(match({ title: null }), OWN, {}).auto_decision,
    cfg.AUTO_DECISION.EXCLUDED_MISSING_DATA);
  assert.strictEqual(competitorFilter.decideOne(match({ url: null }), OWN, {}).auto_decision,
    cfg.AUTO_DECISION.EXCLUDED_MISSING_DATA);
});

test('a conflicting attribute auto-excludes the match and names both values', () => {
  const d = competitorFilter.decideOne(
    match({ title: 'Chrome Pendant Ceiling Light' }), OWN,
    { ownFacts: ['brass', 'Pendant Light'], totalResults: 10 }
  );
  assert.strictEqual(d.auto_decision, cfg.AUTO_DECISION.EXCLUDED_ATTRIBUTE_CONFLICT);
  assert.match(d.decision_reasons.join(' '), /brass/);
  assert.match(d.decision_reasons.join(' '), /chrome/);
});

test('an unrelated product is auto-excluded as irrelevant, with the score stated', () => {
  const d = competitorFilter.decideOne(
    match({ rank: 40, title: 'Garden Hose Reel Wall Mounted', image_src: null, source_name: null }),
    OWN, { totalResults: 50 }
  );
  assert.strictEqual(d.auto_decision, cfg.AUTO_DECISION.EXCLUDED_IRRELEVANT);
  assert.match(d.decision_reasons.join(' '), /Relevance score \d+\/100/);
});

test('a genuinely comparable listing is auto-included with no human step', () => {
  const d = competitorFilter.decideOne(match(), OWN, { totalResults: 20, ownFacts: ['brass'] });
  assert.strictEqual(d.auto_decision, cfg.AUTO_DECISION.INCLUDED);
  assert.ok(d.auto_score >= cfg.RELEVANCE_THRESHOLD);
});

test('no more than 15 competitors are accepted per product, and the lower bound is not forced', () => {
  const many = Array.from({ length: 30 }, (_, i) => match({ rank: i + 1, url: `https://rival.example/p/${i}` }));
  const out = competitorFilter.decideAll(many, OWN, { ownFacts: ['brass'] });
  assert.ok(out.accepted_count <= cfg.MAX_COMPETITORS_PER_PRODUCT);

  const few = [match({ rank: 1 }), match({ rank: 2, url: 'https://b.example/p' })];
  const small = competitorFilter.decideAll(few, OWN, { ownFacts: ['brass'] });
  assert.ok(small.accepted_count <= 2, 'never invents competitors to reach a target band');
});

test('the relevance weights are the published ones and total 100%', () => {
  const sum = Object.values(cfg.RELEVANCE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.strictEqual(cfg.RELEVANCE_WEIGHTS.LENS_RANK, 0.35);
  assert.strictEqual(cfg.RELEVANCE_WEIGHTS.PRODUCT_TYPE_OVERLAP, 0.30);
});

test('the same result always produces the same decision — no LLM in this path', () => {
  const m = match({ rank: 3 });
  const a = competitorFilter.decideOne(m, OWN, { totalResults: 20, ownFacts: ['brass'] });
  const b = competitorFilter.decideOne(m, OWN, { totalResults: 20, ownFacts: ['brass'] });
  assert.deepStrictEqual(a, b);
});

// ═══════════════════════ SEARCH CACHE (§24-27) ═════════════════════════════

test('the Lens fingerprint ignores CDN cache-busting params but not the image itself', () => {
  const base = { country: 'ca', language: 'en' };
  const a = cache.lensFingerprint(Object.assign({ imageUrl: 'https://cdn.example/a.jpg?v=1&width=800' }, base));
  const b = cache.lensFingerprint(Object.assign({ imageUrl: 'https://cdn.example/a.jpg?v=99' }, base));
  const c = cache.lensFingerprint(Object.assign({ imageUrl: 'https://cdn.example/DIFFERENT.jpg' }, base));
  assert.strictEqual(a, b, 'a re-versioned identical image must reuse the cache');
  assert.notStrictEqual(a, c, 'a genuinely changed image must invalidate the cache');
});

test('country and language are part of the fingerprint', () => {
  const a = cache.lensFingerprint({ imageUrl: 'https://c/a.jpg', country: 'ca', language: 'en' });
  const b = cache.lensFingerprint({ imageUrl: 'https://c/a.jpg', country: 'uk', language: 'en' });
  assert.notStrictEqual(a, b);
});

test('a changed Phase 1 primary keyword invalidates the Phase 2 cache', () => {
  const base = { engine: 'google', country: 'ca', language: 'en' };
  const a = cache.phase2Fingerprint(Object.assign({ query: 'brass pendant light' }, base));
  const b = cache.phase2Fingerprint(Object.assign({ query: 'BRASS  Pendant Light ' }, base));
  const c = cache.phase2Fingerprint(Object.assign({ query: 'chrome pendant light' }, base));
  assert.strictEqual(a, b, 'whitespace/case must not cause a needless re-spend');
  assert.notStrictEqual(a, c);
});

test('each Phase 2 engine has its own fingerprint', () => {
  const q = { query: 'brass pendant light', country: 'ca', language: 'en' };
  const ids = ['google', 'google_images', 'google_shopping']
    .map((engine) => cache.phase2Fingerprint(Object.assign({ engine }, q)));
  assert.strictEqual(new Set(ids).size, 3);
});

test('a cache entry is fresh inside 28 days and stale outside it', () => {
  const now = new Date('2026-08-24T00:00:00Z');
  const day = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  assert.strictEqual(cache.isFresh({ fetched_at: day(0) }, now), true);
  assert.strictEqual(cache.isFresh({ fetched_at: day(27) }, now), true);
  assert.strictEqual(cache.isFresh({ fetched_at: day(28) }, now), false, '28 days is the TTL boundary');
  assert.strictEqual(cache.isFresh({ fetched_at: day(400) }, now), false);
  assert.strictEqual(cache.isFresh(null, now), false);
  assert.strictEqual(cfg.CACHE_TTL_DAYS, 28);
});

test('an expired entry is reported as a MISS and never silently served', async () => {
  const stale = { fingerprint: 'fp', fetched_at: new Date(Date.now() - 40 * 86400000).toISOString(), results: [{ old: true }] };
  const touched = [];
  const repo = { getSearchCache: async () => stale, touchSearchCache: async (f) => touched.push(f) };
  const out = await cache.lookup(repo, 'fp');
  assert.strictEqual(out.hit, false);
  assert.strictEqual(out.reason, 'EXPIRED');
  assert.strictEqual(out.results, null);
  assert.strictEqual(touched.length, 0, 'a stale row must not be counted as a hit');
});

test('a fresh entry is served and its hit is recorded', async () => {
  const fresh = { fingerprint: 'fp', fetched_at: new Date().toISOString(), results: [{ rank: 1 }] };
  const touched = [];
  const repo = { getSearchCache: async () => fresh, touchSearchCache: async (f) => touched.push(f) };
  const out = await cache.lookup(repo, 'fp');
  assert.strictEqual(out.hit, true);
  assert.deepStrictEqual(out.results, [{ rank: 1 }]);
  assert.deepStrictEqual(touched, ['fp']);
});

test('planSpend separates what must be searched live from what is already cached', async () => {
  const rows = {
    a: { fetched_at: new Date().toISOString() },
    b: { fetched_at: new Date(Date.now() - 40 * 86400000).toISOString() },
  };
  const repo = { getSearchCache: async (f) => rows[f] || null };
  const plan = await cache.planSpend(repo, ['a', 'b', 'c']);
  assert.deepStrictEqual(plan, { total: 3, cached_searches: 1, live_searches: 2 });
});

// ═══════════════════════ WEEKLY SCHEDULE (§49-58) ══════════════════════════

test('the weekly key is a stable ISO-week identifier', () => {
  const monday = new Date('2026-08-24T01:00:00Z');
  const sunday = new Date('2026-08-30T23:59:00Z');
  const nextMonday = new Date('2026-08-31T01:00:00Z');
  assert.strictEqual(weekly.weeklyKey(monday), weekly.weeklyKey(sunday), 'one key for the whole ISO week');
  assert.notStrictEqual(weekly.weeklyKey(monday), weekly.weeklyKey(nextMonday));
  assert.match(weekly.weeklyKey(monday), /^SAJEEPAN-WEEKLY-\d{4}-\d{2}$/);
});

test('ISO week numbering is Thursday-based, not day-of-year/7', () => {
  // 2027-01-01 is a Friday, so it belongs to ISO week 53 of 2026.
  assert.deepStrictEqual(weekly.isoWeekOf(new Date('2027-01-01T00:00:00Z')), { year: 2026, week: 53 });
});

test('the next scheduled run is a Monday 01:00 UTC', () => {
  const next = new Date(weekly.nextScheduledRun(new Date('2026-08-26T12:00:00Z')));
  assert.strictEqual(next.getUTCDay(), 1);
  assert.strictEqual(next.getUTCHours(), 1);
  assert.strictEqual(cfg.WEEKLY.CRON_SCHEDULE, '0 1 * * 1');
  assert.match(cfg.WEEKLY.TIMEZONE_NOTE, /UTC/);
});

test('a second weekly trigger in the same week returns the existing run and starts nothing', async () => {
  const store = {};
  let startCalls = 0;
  const deps = {
    repo: {
      getWeeklyRun: async (k) => store[k] || null,
      createWeeklyRun: async ({ isoWeek, triggeredBy }) => {
        if (store[isoWeek]) return { weekly: store[isoWeek], created: false };
        store[isoWeek] = { iso_week: isoWeek, triggered_by: triggeredBy, status: 'RUNNING', run_id: null };
        return { weekly: store[isoWeek], created: true };
      },
      setWeeklyFields: async (k, f) => Object.assign(store[k], f),
    },
    startRun: async () => { startCalls += 1; return { run: { run_id: 'run-1' }, selected_count: 5 }; },
  };

  const first = await weekly.startWeeklyRun(deps, { now: new Date('2026-08-24T01:00:00Z'), triggeredBy: 'cron' });
  assert.strictEqual(first.created, true);

  const retry = await weekly.startWeeklyRun(deps, { now: new Date('2026-08-24T01:05:00Z'), triggeredBy: 'cron' });
  assert.strictEqual(retry.created, false);
  assert.strictEqual(retry.reason, 'ALREADY_RAN_THIS_WEEK');
  assert.strictEqual(startCalls, 1, 'a cron retry must not start a second business run');
  assert.strictEqual(Object.keys(store).length, 1);
});

test('the continuation cron creates nothing when no weekly run is pending', async () => {
  let resumed = false;
  const out = await weekly.continueWeeklyRun({
    repo: { findActiveWeeklyRun: async () => null },
    resumeRun: async () => { resumed = true; },
  }, {});
  assert.strictEqual(out.resumed, false);
  assert.strictEqual(out.reason, 'NO_PENDING_WEEKLY_RUN');
  assert.strictEqual(resumed, false, 'nothing may be started, resumed or searched');
});

test('the continuation cron resumes an in-progress run without creating a new one', async () => {
  const calls = [];
  const out = await weekly.continueWeeklyRun({
    repo: { findActiveWeeklyRun: async () => ({ iso_week: 'SAJEEPAN-WEEKLY-2026-35', run_id: 'run-9', status: 'RUNNING' }) },
    resumeRun: async (a) => { calls.push(a); return { complete: true }; },
  }, {});
  assert.strictEqual(out.resumed, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].runId, 'run-9');
});

test('the weekly entry point actually injects a startRun (a missing one is a silent no-op bug)', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'lib', 'lens-keywords', 'automation.js'), 'utf8');
  const runWeeklySrc = src.slice(src.indexOf('async function runWeekly'), src.indexOf('async function continueWeekly'));
  assert.match(runWeeklySrc, /startRun:/, 'startWeeklyRun calls deps.startRun — it must be provided');
  assert.match(runWeeklySrc, /startAutomation\(/);
  assert.match(runWeeklySrc, /idempotencyKey:\s*isoWeek/,
    'the run idempotency key must be the ISO week, so a retry reuses the same run');
  const continueSrc = src.slice(src.indexOf('async function continueWeekly'));
  assert.ok(!/startAutomation\(/.test(continueSrc.slice(0, continueSrc.indexOf('async function syncWeekly'))),
    'the continuation path must never create a run');
});

test('the weekly row records the true selection counts when a run is created', async () => {
  const store = {};
  let starts = 0;
  const deps = {
    repo: {
      getWeeklyRun: async (k) => store[k] || null,
      createWeeklyRun: async ({ isoWeek, triggeredBy }) => {
        if (store[isoWeek]) return { weekly: store[isoWeek], created: false };
        store[isoWeek] = { weekly_run_id: 'w-1', iso_week: isoWeek, triggered_by: triggeredBy, status: 'RUNNING' };
        return { weekly: store[isoWeek], created: true };
      },
      setWeeklyFields: async (k, f) => Object.assign(store[k], f),
    },
    startRun: async () => {
      starts += 1;
      return { run: { run_id: 'run-1' }, eligible_count: 60, selected_count: 50, excluded_count: 10 };
    },
  };

  const out = await weekly.startWeeklyRun(deps, { now: new Date('2026-09-07T01:00:00Z'), triggeredBy: 'cron' });
  assert.strictEqual(out.created, true);
  assert.strictEqual(starts, 1);
  assert.strictEqual(store[out.iso_week].products_selected, 50);
  assert.strictEqual(store[out.iso_week].products_eligible, 60);

  const retry = await weekly.startWeeklyRun(deps, { now: new Date('2026-09-09T04:00:00Z'), triggeredBy: 'cron' });
  assert.strictEqual(retry.created, false);
  assert.strictEqual(starts, 1, 'the same ISO week must never create a second business run');
});

test('a failed weekly start is recorded on the weekly row rather than swallowed', async () => {
  const store = {};
  const deps = {
    repo: {
      getWeeklyRun: async (k) => store[k] || null,
      createWeeklyRun: async ({ isoWeek }) => {
        store[isoWeek] = { iso_week: isoWeek, status: 'RUNNING' };
        return { weekly: store[isoWeek], created: true };
      },
      setWeeklyFields: async (k, f) => Object.assign(store[k], f),
    },
    startRun: async () => { const e = new Error('no eligible products'); e.code = 'LENS_NO_ELIGIBLE_PRODUCTS'; throw e; },
  };
  await assert.rejects(() => weekly.startWeeklyRun(deps, { now: new Date('2026-09-14T01:00:00Z') }));
  const row = store[weekly.weeklyKey(new Date('2026-09-14T01:00:00Z'))];
  assert.strictEqual(row.status, 'FAILED');
  assert.strictEqual(row.error_message, 'LENS_NO_ELIGIBLE_PRODUCTS');
});

// ═══════════════════════ CRON AUTHENTICATION (§54) ═════════════════════════

function withCronSecret(value, fn) {
  const saved = process.env.CRON_SECRET;
  if (value === null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = value;
  try { return fn(); } finally {
    if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  }
}

test('a missing CRON_SECRET fails closed — the route does nothing', () => {
  withCronSecret(null, () => {
    assert.throws(() => weekly.assertCronAuthorized({ headers: { authorization: 'Bearer anything' } }),
      (e) => e.status === 503 && e.code === cfg.ERRORS.CRON_SECRET_MISSING);
  });
});

test('a correct bearer token is accepted', () => {
  withCronSecret('unit-test-secret', () => {
    assert.strictEqual(weekly.assertCronAuthorized({ headers: { authorization: 'Bearer unit-test-secret' } }), true);
  });
});

test('a wrong, absent or malformed bearer token is rejected', () => {
  withCronSecret('unit-test-secret', () => {
    for (const headers of [{}, { authorization: '' }, { authorization: 'Bearer wrong-value-x' },
      { authorization: 'unit-test-secret' }, { authorization: 'Basic unit-test-secret' }]) {
      assert.throws(() => weekly.assertCronAuthorized({ headers }),
        (e) => e.status === 401 && e.code === cfg.ERRORS.CRON_UNAUTHORIZED);
    }
  });
});

test('a normal staff session is NOT a substitute for the cron secret', () => {
  withCronSecret('unit-test-secret', () => {
    const req = { headers: { cookie: 'dm_session=a.valid.looking.session' }, session: { staff_key: 'sajeepan' } };
    assert.throws(() => weekly.assertCronAuthorized(req),
      (e) => e.status === 401, 'presenting a session must never authorise the scheduled batch');
  });
});

// ═══════════════════ END-TO-END DRIVE (§46-48) ═════════════════════════════

/**
 * Drives the full state machine with stubbed phase/analysis steps: the Lens
 * phase runs to a terminal status, analysis is started automatically with no
 * human step in between, then runs to completion.
 */
function fakeDriveDeps({ lensSteps, analysisSteps }) {
  const run = { run_id: 'run-1', status: 'SEARCHING_PRODUCTS', analysis_status: null, searches_used: 0, cached_searches_used: 0 };
  const log = [];
  let lensLeft = lensSteps;
  let analysisLeft = analysisSteps;
  return {
    log,
    run,
    deps: {
      weekly: weekly,
      repo: { getRun: async () => run },
      phase1Api: {
        advanceRun: async () => {
          log.push('lens');
          lensLeft -= 1;
          if (lensLeft <= 0) run.status = 'COMPLETED';
        },
      },
      analysisApi: {
        startAnalysis: async () => { log.push('start-analysis'); run.analysis_status = 'IN_PROGRESS'; },
        advanceAnalysis: async () => {
          log.push('analysis');
          analysisLeft -= 1;
          if (analysisLeft <= 0) run.analysis_status = 'COMPLETED';
        },
      },
    },
  };
}

test('the workflow chains Lens -> analysis automatically, with no human step between', async () => {
  const f = fakeDriveDeps({ lensSteps: 3, analysisSteps: 4 });
  const out = await automation.driveAutomation(f.deps, 'run-1', { budgetMs: 60000 });
  assert.strictEqual(out.complete, true);
  assert.strictEqual(out.reason, 'COMPLETED');
  assert.strictEqual(out.lens_steps, 3);
  assert.strictEqual(out.analysis_steps, 4);
  assert.deepStrictEqual(f.log, ['lens', 'lens', 'lens', 'start-analysis', 'analysis', 'analysis', 'analysis', 'analysis']);
  assert.ok(f.log.indexOf('start-analysis') > f.log.lastIndexOf('lens'),
    'analysis must begin only after the Lens phase is terminal');
});

test('an exhausted work budget stops cleanly and reports resumable progress', async () => {
  const f = fakeDriveDeps({ lensSteps: 500, analysisSteps: 500 });
  const out = await automation.driveAutomation(f.deps, 'run-1', { budgetMs: 0 });
  assert.strictEqual(out.complete, false);
  assert.strictEqual(out.reason, 'WORK_BUDGET_REACHED');
  assert.strictEqual(f.log.length, 0, 'an already-spent budget must do no work at all');
});

test('a step cap bounds one browser request without ending the run', async () => {
  const f = fakeDriveDeps({ lensSteps: 50, analysisSteps: 50 });
  const out = await automation.driveAutomation(f.deps, 'run-1', { budgetMs: 60000, maxSteps: 5 });
  assert.strictEqual(out.complete, false);
  assert.strictEqual(out.reason, 'STEP_CAP_REACHED');
  assert.strictEqual(out.steps, 5);
  assert.strictEqual(out.run_status, 'SEARCHING_PRODUCTS', 'the run stays resumable');
});

test('driving an already-finished run is a harmless no-op', async () => {
  const f = fakeDriveDeps({ lensSteps: 0, analysisSteps: 0 });
  f.run.status = 'COMPLETED';
  f.run.analysis_status = 'COMPLETED';
  const out = await automation.driveAutomation(f.deps, 'run-1', { budgetMs: 60000 });
  assert.strictEqual(out.complete, true);
  assert.strictEqual(f.log.length, 0, 'a completed run must not re-run any stage');
});

// ═══════════════════════ WORK BUDGET (§48) ═════════════════════════════════

test('the work budget stays under the platform function timeout', () => {
  assert.ok(cfg.MAX_CRON_WORK_MS < 300000, 'must return before members-api.js maxDuration=300s');
  const b = weekly.makeBudget(Date.now() - 1000, 500);
  assert.strictEqual(b.exhausted(), true);
  assert.strictEqual(weekly.makeBudget(Date.now(), 60000).exhausted(), false);
});

test('concurrency is bounded — never a 50-way burst', () => {
  assert.ok(cfg.SERPAPI_CONCURRENCY >= 1 && cfg.SERPAPI_CONCURRENCY <= 2);
  assert.ok(cfg.GENERATION_CONCURRENCY >= 1 && cfg.GENERATION_CONCURRENCY <= 3);
});

// ═══════════════════════ QUOTA RESERVE (§28) ═══════════════════════════════

test('the quota reserve is withheld from automatic consumption', async () => {
  const deps = fakePlanDeps({ available: 60, cachedAll: false, products: 20 });
  const plan = await automation.planRun(deps);
  assert.strictEqual(plan.quota_reserve, cfg.QUOTA_RESERVE);
  assert.strictEqual(plan.spendable_searches, 10, '60 available minus the 50-search reserve');
  assert.strictEqual(plan.run_ready, false, '20 live searches exceed the 10 spendable');
  assert.match(plan.not_ready_reason, /reserve/);
});

test('a fully-cached run is ready even with almost no credit left', async () => {
  const deps = fakePlanDeps({ available: 51, cachedAll: true, products: 20 });
  const plan = await automation.planRun(deps);
  assert.strictEqual(plan.live_searches_needed, 0);
  assert.strictEqual(plan.cached_searches_reused, 20);
  assert.strictEqual(plan.run_ready, true, 'the cache is what makes a weekly 50-product run affordable');
});

test('the run plan reports zero-selectable honestly instead of running empty', async () => {
  const deps = fakePlanDeps({ available: 500, cachedAll: true, products: 0 });
  const plan = await automation.planRun(deps);
  assert.strictEqual(plan.run_ready, false);
  assert.match(plan.not_ready_reason, /eligibility/i);
});

function fakePlanDeps({ available, cachedAll, products }) {
  const rows = Array.from({ length: products }, (_, i) => product(i + 1));
  return {
    eligibility, cache,
    ledsoneClient: () => ({ connect: async () => {}, end: async () => {} }),
    sql: {
      getScopeCutoff: async () => '2026-08-24',
      addDays: (d, n) => require('../../lib/lens-keywords/sql').addDays(d, n),
      getAllScopedProducts: async () => rows,
      getAttributeCoverage: async () => new Set(),
    },
    repo: {
      getSearchCache: async () => (cachedAll ? { fetched_at: new Date().toISOString() } : null),
      touchSearchCache: async () => {},
    },
    quota: {
      checkAllAccounts: async () => [{ key_slot: 'SERP_API_1', configured: true, reachable: true, total_searches_left: available }],
      totalUsableCredits: () => available,
    },
  };
}

test('the credit check counts only searches that would actually be spent', async () => {
  const phase1 = require('../../lib/lens-keywords/phase1');
  const snapshots = Array.from({ length: 40 }, (_, i) => ({ image_url_snapshot: 'https://cdn.example/' + i + '.jpg' }));
  const opts = { country: 'ca', language: 'en' };

  const allCached = await phase1.countUncachedSearches({
    cache, repo: { getSearchCache: async () => ({ fetched_at: new Date().toISOString() }), touchSearchCache: async () => {} },
  }, snapshots, opts);
  assert.strictEqual(allCached, 0, 'a fully-cached run must not be blocked by an un-cached price');

  const noneCached = await phase1.countUncachedSearches({
    cache, repo: { getSearchCache: async () => null },
  }, snapshots, opts);
  assert.strictEqual(noneCached, 40);

  // Without the cache wired in, the estimate must never UNDER-count.
  assert.strictEqual(await phase1.countUncachedSearches({ repo: {} }, snapshots, opts), 40);
});

// ═══════════════════════ GEMMA GENERATION (§32-41) ═════════════════════════

function withEnv(vars, fn) {
  const saved = {};
  Object.keys(vars).forEach((k) => {
    saved[k] = process.env[k];
    if (vars[k] === null) delete process.env[k]; else process.env[k] = vars[k];
  });
  return Promise.resolve(fn()).finally(() => {
    Object.keys(saved).forEach((k) => {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    });
  });
}

test('GOOGLE_API_KEY_GLSK takes precedence over GEMINI_API_KEY', async () => {
  await withEnv({ GOOGLE_API_KEY_GLSK: 'a', GEMINI_API_KEY: 'b' }, () => {
    assert.strictEqual(gemma.resolveKeyEnv(), 'GOOGLE_API_KEY_GLSK');
  });
  await withEnv({ GOOGLE_API_KEY_GLSK: null, GEMINI_API_KEY: 'b' }, () => {
    assert.strictEqual(gemma.resolveKeyEnv(), 'GEMINI_API_KEY');
  });
  await withEnv({ GOOGLE_API_KEY_GLSK: null, GEMINI_API_KEY: null }, () => {
    assert.strictEqual(gemma.resolveKeyEnv(), null);
  });
});

test('config.gemmaKey only reads the two declared env names, never an arbitrary one', async () => {
  await withEnv({ GOOGLE_API_KEY_GLSK: 'v', SOME_OTHER_SECRET: 'nope' }, () => {
    assert.strictEqual(cfg.gemmaKey('GOOGLE_API_KEY_GLSK'), 'v');
    assert.strictEqual(cfg.gemmaKey('SOME_OTHER_SECRET'), null);
  });
});

test('model scoring accepts only generateContent-capable Gemma models', () => {
  assert.ok(gemma.scoreGemmaModel({ name: 'models/gemma-4-31b-it', supportedGenerationMethods: ['generateContent'] }) > 0);
  assert.strictEqual(gemma.scoreGemmaModel({ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }), -1,
    'a Gemini model is not a Gemma model');
  assert.strictEqual(gemma.scoreGemmaModel({ name: 'models/gemma-3-4b-it', supportedGenerationMethods: ['embedContent'] }), -1);
  assert.ok(
    gemma.scoreGemmaModel({ name: 'models/gemma-4-31b-it', supportedGenerationMethods: ['generateContent'] })
    > gemma.scoreGemmaModel({ name: 'models/gemma-3-27b-it', supportedGenerationMethods: ['generateContent'] }),
    'a newer generation must outrank an older one'
  );
});

test('no model id is used unless the live Models endpoint actually listed it', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'lib', 'lens-keywords', 'gemma.js'), 'utf8');
  assert.match(src, /v1beta\/models\?key=/, 'discovery must call ListModels');
  assert.match(src, /PREFERRED_MODELS/);
  // The preferred ids may only be looked FOR in the response, never assumed.
  assert.match(src, /models\.find\(\(m\) =>[\s\S]{0,120}=== preferred\)/);
  assert.ok(!/gemini-4/.test(src), 'a nonexistent model id must never be invented');
});

test('only verified evidence is ever sent to the model', () => {
  const validated = [
    { term: 'brass', category: 'Material / Finish', status: 'MATCHED_FACT' },
    { term: 'pendant light', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' },
    { term: 'chrome', category: 'Material / Finish', status: 'CONFLICT' },
    { term: '3000k', category: 'Feature / Modifier', status: 'UNVERIFIED_FACT' },
    { term: 'rivalbrand', category: 'Brand Naming Pattern', status: 'BRAND_EXCLUDED' },
  ];
  const ev = gemma.safeEvidence(validated);
  const sent = JSON.stringify(ev.facts) + JSON.stringify(ev.search_terms);
  assert.match(sent, /brass/);
  assert.ok(!/chrome/.test(sent), 'a CONFLICT term must never reach the model');
  assert.ok(!/3000k/.test(sent), 'an UNVERIFIED_FACT must never reach the model');
  assert.ok(!ev.facts.concat(ev.search_terms).some((t) => t.term === 'rivalbrand'));

  const prompt = gemma.buildPrompt({ currentTitle: 'x', productType: 'Pendant Light', validated, sku: 'LDW1' });
  assert.match(prompt.text, /forbidden_brand_terms/);
  assert.match(prompt.text, /Never invent a fact/i);
});

test('validation rejects a title outside 50-70 characters', () => {
  const v = gemma.validate({ suggested_title: 'Brass Light', suggested_alt_text: 'A brass light' }, { validated: [] });
  assert.strictEqual(v.ok, false);
  assert.ok(v.failures.some((f) => f.startsWith('CHARACTER_COUNT')));
  assert.match(v.correction, /50-70/);
});

test('validation rejects a leaked SKU, a repeated word, a brand and an empty answer', () => {
  const long = 'Brass Pendant Ceiling Light Fitting For Kitchen Islands Home';
  assert.ok(gemma.validate({ suggested_title: `${long} LDW1`, suggested_alt_text: 'x' }, { validated: [], sku: 'LDW1' })
    .failures.includes('SKU_LEAKED'));
  assert.ok(gemma.validate({ suggested_title: 'Brass Brass Pendant Ceiling Light Fitting For Kitchen Islands', suggested_alt_text: 'x' }, { validated: [] })
    .failures.includes('DUPLICATE_WORDS'));
  assert.ok(gemma.validate({ suggested_title: `${long}`, suggested_alt_text: 'Chrome finish' },
    { validated: [{ term: 'chrome', status: 'CONFLICT' }] })
    .failures.includes('UNSUPPORTED_OR_EXCLUDED_TERM'));
  assert.ok(gemma.validate({ suggested_title: '', suggested_alt_text: '' }, { validated: [] })
    .failures.includes('EMPTY_TITLE'));
});

test('a valid answer passes validation', () => {
  const v = gemma.validate({
    suggested_title: 'Brass Pendant Ceiling Light Fitting For Kitchen Islands',
    suggested_alt_text: 'Brass pendant ceiling light',
  }, { validated: [], sku: 'LDW1' });
  assert.deepStrictEqual(v.failures, []);
  assert.strictEqual(v.ok, true);
});

test('JSON is recovered from a fenced or chatty answer, and a broken one is a parse failure', () => {
  assert.strictEqual(gemma.parseJson('```json\n{"a":1}\n```').value.a, 1);
  assert.strictEqual(gemma.parseJson('Sure! {"a":2} hope that helps').value.a, 2);
  assert.strictEqual(gemma.parseJson('not json at all').failure, 'PARSE_FAILED');
  assert.strictEqual(gemma.parseJson('').failure, 'EMPTY_OUTPUT');
});

const GEN_INPUT = {
  currentTitle: 'Old Title',
  productType: 'Pendant Light',
  sku: 'LDW00001',
  validated: [
    { term: 'brass', category: 'Material / Finish', status: 'MATCHED_FACT' },
    { term: 'pendant light', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' },
    { term: 'dimmable', category: 'Feature / Modifier', status: 'NON_FACTUAL_SEARCH_TERM' },
  ],
};

test('a good first answer is accepted with full generation evidence and no retry', async () => {
  let calls = 0;
  const out = await gemma.generateCopy(GEN_INPUT, {
    discoverModel: async () => ({ available: true, model: 'gemma-4-31b-it', source: cfg.GENERATION_SOURCE.GEMMA_4_31B }),
    callModel: async () => {
      calls += 1;
      return { ok: true, text: JSON.stringify({
        suggested_title: 'Brass Pendant Ceiling Light Fitting For Kitchen Islands',
        suggested_alt_text: 'Brass pendant ceiling light above a kitchen island',
        rationale: 'Uses the verified brass finish and product type.',
        keywords_used: ['brass', 'pendant light'],
      }) };
    },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(out.generation_source, cfg.GENERATION_SOURCE.GEMMA_4_31B);
  assert.strictEqual(out.model_name, 'gemma-4-31b-it');
  assert.strictEqual(out.validation_status, 'PASSED');
  assert.ok(out.character_count >= 50 && out.character_count <= 70);
  assert.ok(out.input_hash && out.prompt_version);
  assert.ok(!JSON.stringify(out).includes('GOOGLE_API_KEY'), 'no key material in stored evidence');
});

test('exactly ONE corrective retry is allowed, and a corrected answer is accepted', async () => {
  let calls = 0;
  const out = await gemma.generateCopy(GEN_INPUT, {
    discoverModel: async () => ({ available: true, model: 'gemma-4-31b-it', source: cfg.GENERATION_SOURCE.GEMMA_4_31B }),
    callModel: async (model, prompt) => {
      calls += 1;
      if (calls === 1) return { ok: true, text: '{"suggested_title":"Brass Light","suggested_alt_text":"x"}' };
      assert.match(prompt, /PREVIOUS ANSWER WAS REJECTED/);
      return { ok: true, text: JSON.stringify({
        suggested_title: 'Brass Dimmable Pendant Ceiling Light For Kitchen Islands',
        suggested_alt_text: 'Brass dimmable pendant ceiling light',
        rationale: 'r', keywords_used: ['brass'],
      }) };
    },
  });
  assert.strictEqual(calls, 2);
  assert.strictEqual(out.validation_status, 'PASSED');
});

test('a second validation failure falls back to the deterministic script builder', async () => {
  let calls = 0;
  const out = await gemma.generateCopy(GEN_INPUT, {
    discoverModel: async () => ({ available: true, model: 'gemma-4-31b-it', source: cfg.GENERATION_SOURCE.GEMMA_4_31B }),
    callModel: async () => { calls += 1; return { ok: true, text: '{"suggested_title":"Too Short","suggested_alt_text":"x"}' }; },
  });
  assert.strictEqual(calls, 2, 'never more than one corrective retry');
  assert.strictEqual(out.generation_source, cfg.GENERATION_SOURCE.SCRIPT_FALLBACK);
  assert.match(out.validation_status, /TITLE_SAFE_FALLBACK/);
});

test('no available Gemma model falls straight back to the script builder', async () => {
  let called = false;
  const out = await gemma.generateCopy(GEN_INPUT, {
    discoverModel: async () => ({ available: false, error: 'No Gemma model available to this key.' }),
    callModel: async () => { called = true; return { ok: true, text: '{}' }; },
  });
  assert.strictEqual(called, false);
  assert.strictEqual(out.generation_source, cfg.GENERATION_SOURCE.SCRIPT_FALLBACK);
});

test('a provider error never throws — one product cannot stall the weekly run', async () => {
  const out = await gemma.generateCopy(GEN_INPUT, {
    discoverModel: async () => ({ available: true, model: 'gemma-4-31b-it', source: cfg.GENERATION_SOURCE.GEMMA_4_31B }),
    callModel: async () => { throw new Error('network down'); },
  });
  assert.strictEqual(out.generation_source, cfg.GENERATION_SOURCE.SCRIPT_FALLBACK);
  assert.strictEqual(out.validation_status, 'SCRIPT_FALLBACK');
});

test('the script fallback never pads a title with an invented fact to reach 50 characters', () => {
  const out = gemma.scriptFallback({
    currentTitle: 'x', productType: 'Lamp',
    validated: [{ term: 'lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' }],
  }, 'TEST');
  assert.ok(!out.title || out.title.length < 50, 'thin evidence produces a short title, not a padded one');
  assert.strictEqual(out.title_status, 'NEEDS_REVIEW');
  assert.match(out.rationale, /insufficient validated evidence/i);
});

// ═══════════════════════ ZERO MANUAL REVIEW (§71) ══════════════════════════

test('the normal path records a decision for every competitor — nothing waits on a person', () => {
  const results = [
    match({ rank: 1 }),
    match({ rank: 2, is_self_result: true, url: 'https://ledsone.co.uk/p' }),
    match({ rank: 3, title: null, url: 'https://x.example/3' }),
    match({ rank: 4, title: 'Garden Hose Reel', url: 'https://y.example/4' }),
  ];
  const out = competitorFilter.decideAll(results, OWN, { ownFacts: ['brass'] });
  assert.strictEqual(out.decided.length, 4);
  assert.ok(out.decided.every((d) => d.auto_decision), 'every result carries an automatic decision');
  assert.ok(out.decided.every((d) => Array.isArray(d.decision_reasons) && d.decision_reasons.length),
    'every decision states its reason');
  assert.ok(!out.decided.some((d) => d.auto_decision === 'NEEDS_REVIEW'));
});
