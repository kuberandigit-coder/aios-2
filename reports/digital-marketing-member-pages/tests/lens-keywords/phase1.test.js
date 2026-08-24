'use strict';

// tests/lens-keywords/phase1.test.js
//
// REQ-DM-2026-08-SAJE01 — orchestration tests via dependency injection.
// No real database and no real network call: every collaborator is a fake
// that records what it was asked to do, so these assertions prove BEHAVIOUR
// (validation order, credit-safety, per-product isolation, idempotency)
// without needing DILAIKSHAN_NEON_DB, DATABASE_URL or SERP_API_1/2.

const test = require('node:test');
const assert = require('node:assert');

const phase1 = require('../../lib/lens-keywords/phase1');
const cfg = require('../../lib/lens-keywords/config');
const realQuota = require('../../lib/lens-keywords/quota');
const realNormalize = require('../../lib/lens-keywords/normalize');
const realSql = require('../../lib/lens-keywords/sql');

function makeSku(n) { return 'SKU-' + n; }

function fakeReadyRow(sku) {
  return {
    sku, mapped_sku: null, parent_sku: null, item_id: 'item-' + sku,
    title: 'Product ' + sku, product_description: 'desc', main_image_url: 'https://ledsone.co.uk/img/' + sku + '.jpg',
    listing_url: 'https://ledsone.co.uk/products/' + sku, shopify_handle: sku, product_type: 'Ceiling Rose',
    is_parent: 0, is_child: 1, status: 'active',
  };
}

function makeFakeRepo() {
  const runs = new Map();
  const products = new Map(); // run_id -> [product rows]
  const attempts = new Map(); // run_id -> [attempt rows]
  const calls = { createRun: 0, findRunByIdempotencyKey: 0 };
  let runSeq = 0;

  return {
    calls,
    async findRunByIdempotencyKey(key) {
      calls.findRunByIdempotencyKey++;
      for (const r of runs.values()) if (r.idempotency_key === key) return r;
      return null;
    },
    async createRun({ createdBy, country, language, requestedProductCount, idempotencyKey }) {
      calls.createRun++;
      const run_id = 'run-' + (++runSeq);
      const run = {
        run_id, run_no: runSeq, created_by: createdBy, status: cfg.RUN_STATE.PREPARING,
        country, language, requested_product_count: requestedProductCount,
        products_total: 0, products_done: 0, products_success: 0, products_no_match: 0,
        products_failed: 0, products_skipped_missing_image: 0, competitor_result_count: 0,
        idempotency_key: idempotencyKey || null,
      };
      runs.set(run_id, run);
      products.set(run_id, []);
      attempts.set(run_id, []);
      return { run, reused: false };
    },
    async addRunProducts(runId, snapshots) {
      const list = snapshots.map((s, i) => ({
        run_product_id: runId + '-p' + i, run_id: runId, seq: i + 1, sku: s.sku,
        product_title_snapshot: s.product_title_snapshot, product_url_snapshot: s.product_url_snapshot,
        image_url_snapshot: s.image_url_snapshot, state: cfg.PRODUCT_STATE.WAITING,
      }));
      products.set(runId, list);
      runs.get(runId).products_total = list.length;
      return list;
    },
    async getRun(runId) { return runs.get(runId) || null; },
    async setRunFields(runId, fields) { Object.assign(runs.get(runId), fields); },
    async saveQuotaSnapshot() { /* no-op for tests */ },
    async claimNextProduct(runId) {
      const list = products.get(runId) || [];
      const next = list.find((p) => p.state === cfg.PRODUCT_STATE.WAITING);
      if (next) next.state = cfg.PRODUCT_STATE.RUNNING;
      return next || null;
    },
    async completeProduct(runProductId, patch) {
      for (const list of products.values()) {
        const p = list.find((x) => x.run_product_id === runProductId);
        if (p) Object.assign(p, { state: patch.state, error_code: patch.error_code || null, error_detail_safe: patch.error_detail_safe || null, result_count: patch.result_count || 0 });
      }
    },
    async insertCompetitorResults() { /* no-op for tests */ },
    async insertProviderAttempt(runId, runProductId, attempt) {
      attempts.get(runId).push(Object.assign({ run_product_id: runProductId }, attempt));
    },
    async getLastAttemptForRun(runId) {
      const list = attempts.get(runId) || [];
      return list.length ? list[list.length - 1] : null;
    },
    async recount(runId) {
      const list = products.get(runId) || [];
      const total = list.length;
      const success = list.filter((p) => p.state === cfg.PRODUCT_STATE.SUCCESS).length;
      const no_match = list.filter((p) => p.state === cfg.PRODUCT_STATE.NO_VISUAL_MATCHES).length;
      const failed = list.filter((p) => p.state === cfg.PRODUCT_STATE.FAILED).length;
      const missing_image = list.filter((p) => p.state === cfg.PRODUCT_STATE.MISSING_IMAGE).length;
      const pending = list.filter((p) => p.state === cfg.PRODUCT_STATE.WAITING || p.state === cfg.PRODUCT_STATE.RUNNING).length;
      return { total, pending, done: total - pending, success, no_match, failed, missing_image };
    },
    _products: products,
  };
}

function makeFakeDeps({ rows, quotaStatuses, ledsoneClientCalls, serpScript }) {
  const scriptQueue = serpScript ? serpScript.slice() : [];
  return {
    cfg,
    sql: {
      async getProductsBySku(client, skus) {
        return skus.map((s) => rows[s]).filter(Boolean);
      },
      classifyDataQuality: realSql.classifyDataQuality,
      async getAttributes() { return []; },
    },
    repo: makeFakeRepo(),
    quota: {
      async checkAllAccounts() { return quotaStatuses; },
      totalUsableCredits: realQuota.totalUsableCredits,
      selectStartingSlot: realQuota.selectStartingSlot,
      otherSlot: realQuota.otherSlot,
    },
    serpapi: {
      async searchLens(params) {
        const next = scriptQueue.shift();
        if (typeof next === 'function') return next(params);
        return next || { status: 'NO_VISUAL_MATCHES', visual_matches: [] };
      },
    },
    normalize: realNormalize,
    ledsoneClient: () => {
      if (ledsoneClientCalls) ledsoneClientCalls.count = (ledsoneClientCalls.count || 0) + 1;
      return { connect: async () => {}, end: async () => {} };
    },
  };
}

const HEALTHY_QUOTA = [
  { key_slot: 'SERP_API_1', configured: true, reachable: true, total_searches_left: 500, error_safe: null },
  { key_slot: 'SERP_API_2', configured: true, reachable: true, total_searches_left: 500, error_safe: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Product-count limits — validated BEFORE any Ledsone connection
// ─────────────────────────────────────────────────────────────────────────────
test('exactly 50 selected products is allowed', async () => {
  const rows = {};
  const skus = [];
  for (let i = 1; i <= 50; i++) { const s = makeSku(i); skus.push(s); rows[s] = fakeReadyRow(s); }
  const calls = {};
  const deps = makeFakeDeps({ rows, quotaStatuses: HEALTHY_QUOTA, ledsoneClientCalls: calls });
  const out = await phase1.createRun(deps, { createdBy: 'sajeepan', skus });
  assert.strictEqual(out.run.products_total, 50);
});

test('51 selected products is rejected before touching Ledsone or quota', async () => {
  const rows = {};
  const skus = [];
  for (let i = 1; i <= 51; i++) { const s = makeSku(i); skus.push(s); rows[s] = fakeReadyRow(s); }
  const calls = {};
  const deps = makeFakeDeps({ rows, quotaStatuses: HEALTHY_QUOTA, ledsoneClientCalls: calls });
  await assert.rejects(
    () => phase1.createRun(deps, { createdBy: 'sajeepan', skus }),
    (e) => e.code === cfg.ERRORS.TOO_MANY_PRODUCTS && e.status === 400
  );
  assert.strictEqual(calls.count || 0, 0, 'must not open a Ledsone connection for a rejected request');
});

test('zero selected products is rejected', async () => {
  const deps = makeFakeDeps({ rows: {}, quotaStatuses: HEALTHY_QUOTA });
  await assert.rejects(
    () => phase1.createRun(deps, { createdBy: 'sajeepan', skus: [] }),
    (e) => e.code === cfg.ERRORS.NO_PRODUCTS
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Missing-image / missing-SKU handling — never silently substituted
// ─────────────────────────────────────────────────────────────────────────────
test('a product missing its image is rejected at run creation, not silently dropped', async () => {
  const sku = makeSku('noimg');
  const rows = { [sku]: Object.assign(fakeReadyRow(sku), { main_image_url: null }) };
  const deps = makeFakeDeps({ rows, quotaStatuses: HEALTHY_QUOTA });
  await assert.rejects(
    () => phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku] }),
    (e) => e.code === 'LENS_PRODUCTS_NOT_READY' && e.message.includes(sku)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency — a double click never spends a second quota check
// ─────────────────────────────────────────────────────────────────────────────
test('the same idempotency key returns the same run without a new quota check', async () => {
  const sku = makeSku('idem');
  const rows = { [sku]: fakeReadyRow(sku) };
  let quotaCalls = 0;
  const deps = makeFakeDeps({ rows, quotaStatuses: HEALTHY_QUOTA });
  const realCheck = deps.quota.checkAllAccounts.bind(deps.quota);
  deps.quota.checkAllAccounts = async () => { quotaCalls++; return realCheck(); };

  const first = await phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku], idempotencyKey: 'k-1' });
  assert.strictEqual(first.reused, false);
  assert.strictEqual(quotaCalls, 1);

  const second = await phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku], idempotencyKey: 'k-1' });
  assert.strictEqual(second.reused, true);
  assert.strictEqual(second.run.run_id, first.run.run_id);
  assert.strictEqual(quotaCalls, 1, 'a reused run must never trigger a second (even free) quota check');
});

// ─────────────────────────────────────────────────────────────────────────────
// Insufficient aggregate quota — blocked before a run row is ever created
// ─────────────────────────────────────────────────────────────────────────────
test('insufficient aggregate quota blocks run creation entirely', async () => {
  const rows = {};
  const skus = [];
  for (let i = 1; i <= 5; i++) { const s = makeSku('q' + i); skus.push(s); rows[s] = fakeReadyRow(s); }
  const lowQuota = [
    { key_slot: 'SERP_API_1', configured: true, reachable: true, total_searches_left: 2, error_safe: null },
    { key_slot: 'SERP_API_2', configured: false, reachable: false, total_searches_left: null, error_safe: 'SERP_API_2 is not configured.' },
  ];
  const deps = makeFakeDeps({ rows, quotaStatuses: lowQuota });
  await assert.rejects(
    () => phase1.createRun(deps, { createdBy: 'sajeepan', skus }),
    (e) => e.code === cfg.ERRORS.INSUFFICIENT_QUOTA
  );
  assert.strictEqual(deps.repo.calls.createRun, 0, 'no run row may be created when quota is insufficient');
});

test('no configured SerpAPI key at all is a distinct, staff-mappable error', async () => {
  const sku = makeSku('noserp');
  const rows = { [sku]: fakeReadyRow(sku) };
  const noneConfigured = [
    { key_slot: 'SERP_API_1', configured: false, reachable: false, total_searches_left: null, error_safe: 'SERP_API_1 is not configured.' },
    { key_slot: 'SERP_API_2', configured: false, reachable: false, total_searches_left: null, error_safe: 'SERP_API_2 is not configured.' },
  ];
  const deps = makeFakeDeps({ rows, quotaStatuses: noneConfigured });
  await assert.rejects(
    () => phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku] }),
    (e) => e.code === cfg.ERRORS.SERPAPI_NOT_CONFIGURED && e.status === 503
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Sequential advancement + per-product failure isolation
// ─────────────────────────────────────────────────────────────────────────────
test('advanceRun processes exactly one product per call, in order', async () => {
  const rows = {}; const skus = [];
  for (let i = 1; i <= 3; i++) { const s = makeSku('seq' + i); skus.push(s); rows[s] = fakeReadyRow(s); }
  const deps = makeFakeDeps({
    rows, quotaStatuses: HEALTHY_QUOTA,
    serpScript: [
      { status: 'NO_VISUAL_MATCHES', visual_matches: [] },
      { status: 'NO_VISUAL_MATCHES', visual_matches: [] },
      { status: 'NO_VISUAL_MATCHES', visual_matches: [] },
    ],
  });
  const { run } = await phase1.createRun(deps, { createdBy: 'sajeepan', skus });

  const r1 = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(r1.done, false);
  assert.strictEqual(r1.counts.done, 1);

  const r2 = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(r2.counts.done, 2);

  const r3 = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(r3.done, true);
  assert.strictEqual(r3.counts.done, 3);
  assert.strictEqual(r3.status, cfg.RUN_STATE.COMPLETED_WITH_WARNINGS, 'all NO_VISUAL_MATCHES is a warning, not a hard failure');
});

test('one product throwing an unexpected error is isolated — the run continues', async () => {
  const rows = {}; const skus = [];
  for (let i = 1; i <= 2; i++) { const s = makeSku('iso' + i); skus.push(s); rows[s] = fakeReadyRow(s); }
  const deps = makeFakeDeps({
    rows, quotaStatuses: HEALTHY_QUOTA,
    serpScript: [
      () => { throw new Error('unexpected provider crash'); },
      { status: 'SUCCESS', search_id: 'sid-2', visual_matches: [{ position: 1, title: 'Rival', link: 'https://rival.example/1', source: 'rival.example' }] },
    ],
  });
  const { run } = await phase1.createRun(deps, { createdBy: 'sajeepan', skus });

  const r1 = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(r1.counts.failed, 1, 'the crashing product must be marked FAILED, not abort the run');

  const r2 = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(r2.done, true);
  assert.strictEqual(r2.counts.success, 1, 'the second product must still succeed');
  assert.strictEqual(r2.status, cfg.RUN_STATE.COMPLETED_WITH_WARNINGS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Credit-safe retry policy (governing prompt §15)
// ─────────────────────────────────────────────────────────────────────────────
test('RATE_LIMITED on the starting slot switches to the other slot ONCE, never a third attempt', async () => {
  const sku = makeSku('fallback');
  const rows = { [sku]: fakeReadyRow(sku) };
  let calls = 0;
  const deps = makeFakeDeps({
    rows, quotaStatuses: HEALTHY_QUOTA,
    serpScript: [
      (p) => { calls++; return { status: 'RATE_LIMITED', key_slot: p.keySlot, error_detail_safe: 'rate limited' }; },
      (p) => { calls++; return { status: 'SUCCESS', key_slot: p.keySlot, search_id: 's2', visual_matches: [{ position: 1, title: 'R', link: 'https://r.example', source: 'r.example' }] }; },
    ],
  });
  const { run } = await phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku] });
  const out = await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(calls, 2, 'exactly two attempts: the rate-limited slot, then the other slot once');
  assert.strictEqual(out.counts.success, 1);
});

test('TIMEOUT retries once on the SAME slot, not the other one', async () => {
  const sku = makeSku('timeout');
  const rows = { [sku]: fakeReadyRow(sku) };
  const seenSlots = [];
  const deps = makeFakeDeps({
    rows, quotaStatuses: HEALTHY_QUOTA,
    serpScript: [
      (p) => { seenSlots.push(p.keySlot); return { status: 'TIMEOUT', key_slot: p.keySlot }; },
      (p) => { seenSlots.push(p.keySlot); return { status: 'SUCCESS', key_slot: p.keySlot, search_id: 's', visual_matches: [{ position: 1, title: 'R', link: 'https://r.example', source: 'r.example' }] }; },
    ],
  });
  const { run } = await phase1.createRun(deps, { createdBy: 'sajeepan', skus: [sku] });
  await phase1.advanceRun(deps, run.run_id);
  assert.strictEqual(seenSlots.length, 2);
  assert.strictEqual(seenSlots[0], seenSlots[1], 'a TIMEOUT retry must use the same key slot');
});

test('resolveKeySlot switches away from a slot whose last attempt was QUOTA_EXHAUSTED', async () => {
  const deps = makeFakeDeps({ rows: {}, quotaStatuses: HEALTHY_QUOTA });
  const runId = 'run-x';
  deps.repo.getLastAttemptForRun = async () => ({ key_slot: 'SERP_API_1', status: 'QUOTA_EXHAUSTED' });
  const slot = await phase1.resolveKeySlot(deps, runId);
  assert.strictEqual(slot, 'SERP_API_2');
});

test('resolveKeySlot keeps using a healthy slot across products', async () => {
  const deps = makeFakeDeps({ rows: {}, quotaStatuses: HEALTHY_QUOTA });
  deps.repo.getLastAttemptForRun = async () => ({ key_slot: 'SERP_API_2', status: 'SUCCESS' });
  const slot = await phase1.resolveKeySlot(deps, 'run-x');
  assert.strictEqual(slot, 'SERP_API_2');
});
