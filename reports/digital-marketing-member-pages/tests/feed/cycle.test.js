// tests/feed/cycle.test.js
//
// ONE-BUTTON OPTIMIZATION CYCLE — orchestration behaviour.
//
// lib/feed/cycle.js takes every collaborator through `deps`, so the whole state
// machine can be driven here against an in-memory fake database. No Postgres,
// no Ledsone, no LLM, no network.
//
// What these tests protect:
//   * pressing Run twice produces ONE cycle and ONE set of AI calls
//   * a Check Required product never costs an AI call
//   * one product failing never kills the cycle
//   * a cycle with warnings still produces a report
//
//   node --test tests/feed/cycle.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const cycle = require(path.join(ROOT, 'lib', 'feed', 'cycle'));
const gate = require(path.join(ROOT, 'lib', 'feed', 'gate'));

// ═══════════ a very small fake of the two data stores ══════════════════════

function makeDeps(opts) {
  const o = opts || {};
  const db = {
    cycles: [],
    products: [],
    events: [],
    batches: [],
    terms: [],
  };
  const calls = { generate: 0, terms: 0 };
  let seq = 0;

  function candidate(i, over) {
    return Object.assign({
      item_id: 'shopify_FR_' + (100 + i) + '_' + (200 + i),
      shopify_variant_id: String(200 + i),
      shopify_product_id: String(100 + i),
      sku: 'SKU' + i,
      handle: 'p' + i,
      current_title: 'Titre ' + i,
      current_description: 'Description ' + i,
      product_type: 'Luminaires',
      google_product_category: '594',
      image_link: 'https://example.invalid/' + i + '.jpg',
      price_eur: 50 + i,
      specs: [],
      stock: { status: 'IN_STOCK', source: 'merchant_products.availability' },
      shopify_conversions: { orders: 1, lines: 1, units: 1 },
      missing_evidence: [],
      perf_30d: { impressions: 1000 - i, clicks: 10, ctr: 0.005, conversions: 1, conversion_rate: 0.1 },
      feed_eligible: { status: o.gateStatus || 'UNKNOWN', source: 'NOT_AVAILABLE_IN_LEDSONE_DB' },
    }, over || {});
  }

  // == null, not ||, so an explicit 0 really means zero candidates.
  const candidates = Array.from({ length: o.candidateCount == null ? 3 : o.candidateCount }, (_, i) => candidate(i));
  if (o.mutate) o.mutate(candidates);

  // ── the fake application database ──────────────────────────────────────
  const repo = {
    async query(text, params) {
      const p = params || [];
      if (/INSERT INTO public\.thivajini_feed_cycle_event/.test(text)) {
        db.events.push({ cycle_id: p[0], level: p[1], item_id: p[2], message: p[3], detail: p[4] });
        return { rows: [] };
      }
      if (/INSERT INTO public\.thivajini_feed_cycle\b/.test(text)) {
        if (p[4] && db.cycles.some((c) => c.idempotency_key === p[4])) return { rows: [] }; // unique index
        const row = {
          cycle_id: 'cyc-' + (++seq), cycle_no: seq, batch_id: p[0], created_by: p[1],
          status: p[2], settings: JSON.parse(p[3]), idempotency_key: p[4],
          ads_perf_cutoff: p[5], pmax_terms_cutoff: p[6], conventional_terms_cutoff: p[7],
          products_total: p[8], products_done: 0, products_generated: 0, products_check: 0,
          products_failed: 0, products_skipped: 0, llm_calls: 0, gemini_calls: 0,
          created_at: '2026-08-21T09:00:00Z', started_at: '2026-08-21T09:00:00Z', finished_at: null,
        };
        db.cycles.push(row);
        return { rows: [row] };
      }
      if (/SELECT \* FROM public\.thivajini_feed_cycle WHERE idempotency_key/.test(text)) {
        return { rows: db.cycles.filter((c) => c.idempotency_key === p[0]) };
      }
      if (/SELECT \* FROM public\.thivajini_feed_cycle WHERE cycle_id/.test(text)) {
        return { rows: db.cycles.filter((c) => c.cycle_id === p[0]) };
      }
      if (/UPDATE public\.thivajini_feed_cycle\s+SET llm_calls/.test(text)) {
        const c = db.cycles.find((x) => x.cycle_id === p[0]);
        c.llm_calls += p[1]; c.gemini_calls += p[2];
        return { rows: [c] };
      }
      if (/^\s*UPDATE public\.thivajini_feed_cycle SET /.test(text)) {
        const c = db.cycles.find((x) => x.cycle_id === p[0]);
        const keys = text.match(/SET (.*) WHERE/)[1].split(', ').map((s) => s.split(' = ')[0]);
        keys.forEach((k, i) => { c[k] = p[i + 1]; });
        return { rows: [c] };
      }
      if (/INSERT INTO public\.thivajini_feed_cycle_product/.test(text)) {
        if (db.products.some((x) => x.cycle_id === p[0] && x.item_id === p[2])) return { rows: [] };
        const row = { cycle_product_id: 'cp-' + (db.products.length + 1), cycle_id: p[0], seq: p[1], item_id: p[2], state: 'WAITING', excluded_from_export: false };
        db.products.push(row);
        return { rows: [row] };
      }
      if (/SET state = 'RUNNING'/.test(text)) {
        const next = db.products.filter((x) => x.cycle_id === p[0] && x.state === 'WAITING')
          .sort((a, b) => a.seq - b.seq)[0];
        if (!next) return { rows: [] };
        next.state = 'RUNNING';
        return { rows: [next] };
      }
      if (/UPDATE public\.thivajini_feed_cycle_product\s+SET state=\$2/.test(text)) {
        const row = db.products.find((x) => x.cycle_product_id === p[0]);
        Object.assign(row, {
          state: p[1], state_detail: p[2], gate_status: p[3], gate_source: p[4],
          gate_reasons: p[5] && JSON.parse(p[5]), result_code: p[6], result_note: p[7],
          evidence_snapshot: p[8] && JSON.parse(p[8]), data_quality: p[9] && JSON.parse(p[9]),
          terms_count: p[10], generation_id: p[11],
        });
        return { rows: [row] };
      }
      if (/SET state='FAILED'/.test(text)) {
        const row = db.products.find((x) => x.cycle_product_id === p[0]);
        Object.assign(row, { state: 'FAILED', result_code: p[1], result_note: p[2], error_message: p[2] });
        return { rows: [row] };
      }
      if (/count\(\*\) FILTER/.test(text)) {
        const rows = db.products.filter((x) => x.cycle_id === p[0]);
        const n = (f) => rows.filter(f).length;
        return {
          rows: [{
            total: rows.length,
            generated: n((r) => r.state === 'GENERATED'),
            check_required: n((r) => r.state === 'CHECK_REQUIRED'),
            failed: n((r) => ['FAILED', 'VALIDATION_FAILED'].includes(r.state)),
            skipped: n((r) => r.state === 'SKIPPED'),
            pending: n((r) => ['WAITING', 'RUNNING'].includes(r.state)),
          }],
        };
      }
      if (/FROM public\.thivajini_feed_cycle_product\s+WHERE cycle_id = \$1 ORDER BY seq/.test(text)) {
        return { rows: db.products.filter((x) => x.cycle_id === p[0]).sort((a, b) => a.seq - b.seq) };
      }
      if (/FROM public\.thivajini_feed_cycle_event/.test(text)) {
        return { rows: db.events.filter((e) => e.cycle_id === p[0]) };
      }
      if (/FROM public\.thivajini_feed_cycle c/.test(text)) {
        return { rows: db.cycles.slice().reverse().map((c) => Object.assign({ exports: 0, monitoring: 0 }, c)) };
      }
      if (/UPDATE public\.thivajini_feed_cycle_product SET selected_variant|SET excluded_from_export/.test(text)) {
        const row = db.products.find((x) => x.cycle_id === p[0] && x.item_id === p[1]);
        if (!row) return { rows: [] };
        if (/selected_variant/.test(text)) row.selected_variant = p[2];
        if (/excluded_from_export/.test(text)) row.excluded_from_export = p[p.length - 1];
        return { rows: [row] };
      }
      return { rows: [] };
    },
    async createBatch(b) { const row = { batch_id: 'batch-1', ...b }; db.batches.push(row); return row; },
    async saveTermSelections(t) { calls.terms += 1; db.terms.push(t); return t.terms; },
    async listVariants() { return []; },
    async listAttempts() { return []; },
  };

  const deps = {
    repo,
    gate,
    sql: {
      isoDate: (d) => new Date(d).toISOString().slice(0, 10),
      addDays: (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10),
      async getSourceCutoffs() { return { ads_perf: '2026-08-20', pmax_terms: '2026-06-30', conv_terms: '2026-07-06' }; },
      async getCandidates() { return candidates.map((c) => Object.assign({}, c)); },
      async attachSpecs(_c, list) { return list; },
      async attachStock(_c, list) { return list; },
      async attachShopifyConversions(_c, list) { return list; },
      async getPaidSearchTerms() {
        if (o.noTerms) return [];
        return [
          { search_term: 'suspension cuivre', conversions: 4, clicks: 20, impressions: 900, conversion_value: 300, conversion_rate: 0.2, source_table: 'campaign_search_term_data', category_label: 'Lighting' },
          { search_term: 'lampe industrielle', conversions: 2, clicks: 10, impressions: 400, conversion_value: 120, conversion_rate: 0.2, source_table: 'campaign_search_term_data', category_label: null },
        ];
      },
      async getOrganicTerms() { return []; },
      async getItemPerformance() { return { impressions: 1, clicks: 1, ctr: 1, conversions: 1, conversion_value: 1, conversion_rate: 1, source_max_date: '2026-08-20' }; },
      FR: { CAMPAIGNS: [1, 2, 3] },
    },
    ledsoneClient: () => ({ connect: async () => {}, end: async () => {}, query: async () => ({ rows: [] }) }),
    termsFreshness: () => ({ status: 'STALE', note: 'historical', latest: '2026-07-06', days_behind: 46 }),
    async generateForProduct(args) {
      calls.generate += 1;
      if (o.generate) return o.generate(args, calls);
      return {
        generationId: 'gen-' + calls.generate,
        winner: { ok: true }, winnerAlias: 'local_primary', winnerModel: 'qwen',
        llmCalls: 1, geminiCalls: 0, attemptSummary: ['local_primary:SUCCESS'],
      };
    },
  };

  return { deps, db, calls };
}

// ═══════════ 1. idempotency ════════════════════════════════════════════════

test('pressing Run twice with the same key creates ONE cycle', async () => {
  const { deps, db } = makeDeps();
  const a = await cycle.createCycle(deps, { createdBy: 'thivajini', settings: {}, idempotencyKey: 'k1' });
  const b = await cycle.createCycle(deps, { createdBy: 'thivajini', settings: {}, idempotencyKey: 'k1' });
  assert.equal(a.reused, false);
  assert.equal(b.reused, true, 'the second press must reuse the first cycle');
  assert.equal(a.cycle.cycle_id, b.cycle.cycle_id);
  assert.equal(db.cycles.length, 1, 'only one cycle row exists');
});

test('a duplicated Run cannot double the AI calls', async () => {
  const { deps, calls } = makeDeps({ candidateCount: 2, gateStatus: 'Y' });
  await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'k2' });
  await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'k2' });
  const c = (await cycle.listCycles(deps, 5))[0];
  let guard = 0;
  while (guard++ < 20) {
    const step = await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' });
    if (step.done) break;
  }
  assert.equal(calls.generate, 2, 'exactly one generation per product, not four');
});

test('different keys create different cycles', async () => {
  const { deps, db } = makeDeps();
  await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'a' });
  await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'b' });
  assert.equal(db.cycles.length, 2);
});

// ═══════════ 2. the Feed Gate decides whether an AI call happens ═══════════

test('Check Required products are skipped and cost NO AI call', async () => {
  const { deps, calls, db } = makeDeps({ candidateCount: 3 });   // all UNKNOWN -> CHECK
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'g1' });
  let guard = 0;
  while (guard++ < 20) { if ((await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) break; }

  assert.equal(calls.generate, 0, 'no AI call may be spent on a Check Required product');
  assert.equal(calls.terms, 0, 'and no term selection is written either');
  const rows = db.products.filter((p) => p.cycle_id === c.cycle_id);
  assert.equal(rows.length, 3);
  rows.forEach((r) => {
    assert.equal(r.state, 'CHECK_REQUIRED');
    assert.equal(r.result_code, cycle.RESULT.SKIPPED_GATE);
    assert.equal(r.gate_status, 'CHECK');
    assert.match(r.result_note, /eligibility requires check/i);
  });
});

test('an explicit operator opt-in allows drafts for Check Required', async () => {
  const { deps, calls } = makeDeps({ candidateCount: 2 });
  const { cycle: c } = await cycle.createCycle(deps, {
    createdBy: 'x', settings: { allow_draft_for_check: true }, idempotencyKey: 'g2',
  });
  let guard = 0;
  while (guard++ < 20) { if ((await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) break; }
  assert.equal(calls.generate, 2, 'the opt-in is honoured');
});

test('the opt-in never marks anything Eligible', async () => {
  const { deps, db } = makeDeps({ candidateCount: 1 });
  const { cycle: c } = await cycle.createCycle(deps, {
    createdBy: 'x', settings: { allow_draft_for_check: true }, idempotencyKey: 'g3',
  });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const row = db.products.find((p) => p.cycle_id === c.cycle_id);
  assert.equal(row.gate_status, 'CHECK', 'the gate stays CHECK');
  assert.equal(row.state, 'GENERATED');
  assert.match(row.result_note, /draft only/i, 'and the result says draft only');
});

test('a genuinely Eligible product generates normally', async () => {
  const { deps, calls, db } = makeDeps({ candidateCount: 2, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'g4' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  assert.equal(calls.generate, 2);
  db.products.filter((p) => p.cycle_id === c.cycle_id).forEach((r) => {
    assert.equal(r.gate_status, 'ELIGIBLE');
    assert.equal(r.result_code, cycle.RESULT.GENERATED);
    assert.equal(r.result_note, null, 'nothing to warn about');
  });
});

// ═══════════ 3. one product must not kill the cycle ════════════════════════

test('a thrown error on one product leaves the others untouched', async () => {
  const { deps, db } = makeDeps({
    candidateCount: 3, gateStatus: 'Y',
    generate: (args, calls) => {
      if (calls.generate === 2) throw new Error('provider exploded');
      return { generationId: 'gen-' + calls.generate, winner: { ok: true }, llmCalls: 1, geminiCalls: 0, attemptSummary: [] };
    },
  });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'f1' });
  let last;
  let guard = 0;
  while (guard++ < 20) { last = await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' }); if (last.done) break; }

  assert.equal(last.status, cycle.CYCLE.COMPLETED_WITH_WARNINGS);
  assert.equal(last.counts.generated, 2);
  assert.equal(last.counts.failed, 1);
  const failed = db.products.filter((p) => p.state === 'FAILED');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].result_code, cycle.RESULT.GENERATION_FAILED);
});

test('a provider that returns no winner is recorded, not thrown away', async () => {
  const { deps, db } = makeDeps({
    candidateCount: 1, gateStatus: 'Y',
    generate: () => ({ generationId: 'gen-x', winner: null, terminalStatus: 'VALIDATION_FAILED', llmCalls: 3, geminiCalls: 2, attemptSummary: ['local:FAIL'] }),
  });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'f2' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const row = db.products[0];
  assert.equal(row.state, 'VALIDATION_FAILED');
  assert.equal(row.result_code, cycle.RESULT.VALIDATION_FAILED);
  assert.equal(row.generation_id, 'gen-x', 'the generation is still linked for the audit');
});

test('a product with no paid converting terms is skipped, not failed', async () => {
  const { deps, calls, db } = makeDeps({ candidateCount: 1, gateStatus: 'Y', noTerms: true });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'f3' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  assert.equal(calls.generate, 0, 'no AI call without evidence');
  assert.equal(db.products[0].state, 'SKIPPED');
  assert.equal(db.products[0].result_code, cycle.RESULT.SKIPPED_EVIDENCE);
});

// ═══════════ 4. terminal status + report ═══════════════════════════════════

test('an all-good cycle completes cleanly', async () => {
  const { deps } = makeDeps({ candidateCount: 2, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 't1' });
  let last;
  while (!(last = await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  assert.equal(last.status, cycle.CYCLE.COMPLETED);
});

test('a report is produced even when every product needed a check', async () => {
  const { deps } = makeDeps({ candidateCount: 2 });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 't2' });
  let last;
  while (!(last = await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  assert.equal(last.status, cycle.CYCLE.COMPLETED_WITH_WARNINGS);

  const rep = await cycle.getReport(deps, c.cycle_id);
  assert.equal(rep.rows.length, 2, 'the report still has a row per product');
  rep.rows.forEach((r) => {
    assert.equal(r.result_code, cycle.RESULT.SKIPPED_GATE);
    assert.ok(r.feed_gate, 'each row carries its gate');
    assert.equal(r.feed_gate.status, 'CHECK');
  });
});

test('advancing a finished cycle is a no-op, not an error', async () => {
  const { deps } = makeDeps({ candidateCount: 1, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 't3' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const again = await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' });
  assert.equal(again.done, true);
  assert.ok(cycle.TERMINAL.includes(again.status));
});

// ═══════════ 5. timeline + selection ═══════════════════════════════════════

test('the cycle writes an auditable timeline', async () => {
  const { deps } = makeDeps({ candidateCount: 2, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'e1' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const detail = await cycle.getDetail(deps, c.cycle_id);
  const msgs = detail.events.map((e) => e.message);
  assert.ok(msgs.includes('Cycle started'));
  assert.ok(msgs.some((m) => /candidate product/.test(m)));
  assert.ok(msgs.filter((m) => m === 'Variants generated').length === 2);
  assert.ok(msgs.includes('Final report created'));
});

test('a skipped product says WHY in the timeline', async () => {
  const { deps } = makeDeps({ candidateCount: 1 });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'e2' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const detail = await cycle.getDetail(deps, c.cycle_id);
  const skip = detail.events.find((e) => /eligibility requires check/i.test(e.message));
  assert.ok(skip, 'the skip is on the timeline');
  assert.equal(skip.level, 'WARN', 'it is a warning, not an error');
});

test('a variant choice and an exclusion are persisted', async () => {
  const { deps } = makeDeps({ candidateCount: 1, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 's1' });
  while (!(await cycle.advanceCycle(deps, { cycleId: c.cycle_id, actor: 'x' })).done) { /* drain */ }
  const item = (await cycle.getStatus(deps, c.cycle_id)).products[0].item_id;

  const picked = await cycle.selectVariant(deps, { cycleId: c.cycle_id, itemId: item, variantLabel: 'B' });
  assert.equal(picked.selected_variant, 'B');
  const excluded = await cycle.selectVariant(deps, { cycleId: c.cycle_id, itemId: item, excluded: true });
  assert.equal(excluded.excluded_from_export, true);
});

// ═══════════ 6. settings + candidate selection reuse existing logic ════════

test('the default product count follows the written workflow', () => {
  assert.equal(cycle.DEFAULT_PRODUCT_COUNT, 10);
});

test('the product count is honoured and capped', async () => {
  const { deps, db } = makeDeps({ candidateCount: 12, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, {
    createdBy: 'x', settings: { product_count: 4 }, idempotencyKey: 'n1',
  });
  assert.equal(db.products.filter((p) => p.cycle_id === c.cycle_id).length, 4);
});

test('an explicit product list overrides the automatic pick', async () => {
  const { deps, db } = makeDeps({ candidateCount: 5, gateStatus: 'Y' });
  const { cycle: c } = await cycle.createCycle(deps, {
    createdBy: 'x', settings: {}, idempotencyKey: 'n2',
    itemIds: ['shopify_FR_102_202', 'shopify_FR_104_204'],
  });
  const picked = db.products.filter((p) => p.cycle_id === c.cycle_id).map((p) => p.item_id).sort();
  assert.deepEqual(picked, ['shopify_FR_102_202', 'shopify_FR_104_204']);
});

test('no candidates is a clear refusal, not a silent empty cycle', async () => {
  const { deps } = makeDeps({ candidateCount: 0 });
  await assert.rejects(
    () => cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'n3' }),
    (e) => { assert.equal(e.code, 'CYCLE_NO_CANDIDATES'); return true; });
});

// ═══════════ 7. source-level guarantees ════════════════════════════════════

test('cycle.js never requires req5.js — the graph stays acyclic', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'cycle.js'), 'utf8');
  assert.ok(!src.includes("require('./req5')"), 'cycle must not require req5');
  assert.ok(src.includes("require('./gate')"), 'it may require the pure gate module');
});

test('the cycle never reads a database variable of its own', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'cycle.js'), 'utf8');
  ['DATABASE_URL', 'NEON_DATABASE_URL', 'AUTH_DATABASE_URL'].forEach((v) => {
    assert.ok(!src.includes('process.env.' + v), `cycle.js must not read ${v}`);
  });
});

test('the manual endpoint and the cycle share ONE generation implementation', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  assert.ok(src.includes('async function generateForProduct('), 'the shared core exists');
  const handler = src.slice(src.indexOf('async function handleGenerate('), src.indexOf('async function runProviderChain('));
  assert.ok(handler.includes('await generateForProduct('), 'the manual endpoint calls it');
  assert.ok(!handler.includes('runProviderChain('), 'and does not run its own chain');
  assert.ok((src.match(/const chain = await runProviderChain\(/g) || []).length === 1,
    'the provider chain is invoked in exactly one place');
});

test('Vercel function count is unchanged — no new top-level API file', () => {
  const files = fs.readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js'));
  assert.equal(files.length, 12, 'the project must stay at 12 serverless functions, found ' + files.length);
  assert.ok(files.includes('members-api.js'), 'Req5 still routes through members-api');
});

test('every cycle route is registered and session-guarded', () => {
  const req5 = require(path.join(ROOT, 'lib', 'feed', 'req5'));
  ['req5-cycle-status', 'req5-cycle-report', 'req5-cycle-detail', 'req5-cycle-history']
    .forEach((t) => assert.ok(req5.READ_TYPES.has(t), t + ' is a read route'));
  ['req5-cycle-create', 'req5-cycle-advance', 'req5-cycle-select', 'req5-monitoring-start']
    .forEach((t) => assert.ok(req5.WRITE_TYPES.has(t), t + ' is a write route'));
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function handleReq5('), src.indexOf('module.exports'));
  assert.ok(fn.includes('requireSession(req, res)'), 'session enforced for reads and writes');
  assert.ok(fn.includes("req.method !== 'POST'"), 'writes require POST');
});

// ═══════════ 8. download is not a go-live (server side) ════════════════════

test('a DEFERRED export creates no monitoring plan and no baseline', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function handleExport('), src.indexOf('async function handleMonitoringStart('));
  assert.ok(fn.includes("const deferred = mode === 'DEFERRED'"), 'DEFERRED is understood');
  assert.ok(fn.includes('if (!isFuture && !deferred)'), 'no baseline is captured');
  assert.ok(fn.includes('for (const p of (deferred ? [] : plansToCreate))'), 'no monitoring plan');
  assert.ok(fn.includes("'DOWNLOADED_NOT_LIVE'"), 'the export records that nothing is live');
});

test('monitoring only starts through its own endpoint, with a real go-live date', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function handleMonitoringStart('), src.indexOf('/** Explicit human confirmation'));
  assert.ok(fn.includes('actual_go_live_date must be YYYY-MM-DD'), 'the date is required');
  assert.ok(fn.includes('The go-live date cannot be in the future'), 'and cannot be in the future');
  assert.ok(fn.includes('sql.addDays(goLive, -1)'), 'baseline ends the day before go-live');
  assert.ok(fn.includes('repo.confirmMonitoringLive'), 'the plan moves to live testing');
});

// ═══════════ 9. REGRESSION: production 42P10 on cycle creation ═════════════
//
// 2026-08-21. Pressing "Run Optimization Cycle" returned, in the browser:
//     there is no unique or exclusion constraint matching the ON CONFLICT
//     specification                                        [SQLSTATE 42P10]
//
// Two independent defects:
//   1. the conflict target did not name the PARTIAL index predicate, so
//      PostgreSQL could not infer the index;
//   2. err() passed the raw database message through to the browser because it
//      was under 200 characters.
// Both are covered below.

/** Every `CREATE UNIQUE INDEX … WHERE …` declared by the migrations. */
function partialUniqueIndexes() {
  const dir = path.join(ROOT, 'db', 'migrations');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /CREATE\s+UNIQUE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s+ON\s+([\w.]+)\s*\(([^)]*)\)\s*WHERE\s+([^;]+);/gi;
    let m;
    while ((m = re.exec(sql))) {
      out.push({
        file: f,
        name: m[1],
        table: m[2].replace(/^public\./, ''),
        cols: m[3].split(',').map((c) => c.trim()).join(','),
        predicate: m[4].trim().replace(/\s+/g, ' '),
      });
    }
  }
  return out;
}

/** Every `INSERT INTO <table> … ON CONFLICT (…) [WHERE …]` in lib/feed. */
function conflictStatements() {
  const dir = path.join(ROOT, 'lib', 'feed');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const marker = /ON CONFLICT\s*\(/gi;
    let m;
    while ((m = marker.exec(src))) {
      // Nearest PRECEDING `INSERT INTO`. A lazy `INSERT[\s\S]*?ON CONFLICT`
      // spans whole statements and attributes the clause to the wrong table,
      // which makes the check below match nothing and pass vacuously.
      const before = src.slice(0, m.index);
      const ins = [...before.matchAll(/INSERT\s+INTO\s+([\w.]+)/gi)].pop();
      if (!ins) continue;

      // Balanced capture, so `COALESCE(item_id,'')` is not cut at its bracket.
      let i = m.index + m[0].length;
      let depth = 1;
      for (; i < src.length && depth > 0; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
      }
      const target = src.slice(m.index + m[0].length, i - 1);
      const nl = src.indexOf('\n', i);
      const tail = src.slice(i, nl < 0 ? src.length : nl);

      const cols = [];
      let buf = '';
      let d = 0;
      for (const ch of target) {
        if (ch === '(') d++;
        else if (ch === ')') d--;
        if (ch === ',' && d === 0) { cols.push(buf.trim()); buf = ''; } else buf += ch;
      }
      if (buf.trim()) cols.push(buf.trim());

      out.push({ file: f, table: ins[1].replace(/^public\./, ''), cols: cols.join(','), tail });
    }
  }
  return out;
}

test('every ON CONFLICT against a PARTIAL unique index repeats its predicate', () => {
  const partials = partialUniqueIndexes();
  assert.ok(partials.length > 0, 'the suite must actually find the partial indexes it guards');

  const statements = conflictStatements();
  assert.ok(statements.length > 0, 'and the ON CONFLICT statements it checks');

  // Self-check. A parser that silently matched nothing would make this whole
  // test pass vacuously — which is exactly how the 42P10 defect shipped.
  const cycleStmt = statements.find(
    (x) => x.table === 'thivajini_feed_cycle' && x.cols === 'idempotency_key');
  assert.ok(cycleStmt,
    'the parser must find the cycle idempotency INSERT; it found: ' +
    JSON.stringify(statements.map((x) => x.table + '(' + x.cols + ')')));
  const termStmt = statements.find((x) => x.table === 'thivajini_feed_term_selection');
  assert.ok(termStmt, 'and the term-selection INSERT');
  assert.ok(termStmt.cols.includes("COALESCE(item_id,'')"),
    'with its COALESCE captured whole, not truncated at the first bracket');

  for (const s of statements) {
    const hit = partials.find((p) => p.table === s.table && p.cols === s.cols);
    if (!hit) continue;   // backed by a plain constraint/index — inference works
    // PostgreSQL cannot infer a partial index from a bare conflict target.
    assert.match(s.tail, /WHERE/i,
      `${s.file}: ON CONFLICT (${s.cols}) on ${s.table} is backed by the PARTIAL index ` +
      `${hit.name} (${hit.predicate}) — the statement must repeat that predicate or ` +
      'PostgreSQL raises SQLSTATE 42P10');
    const want = hit.predicate.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ');
    const got = s.tail.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ');
    assert.ok(got.includes(want),
      `${s.file}: the predicate must match the index exactly.\n  index: ${hit.predicate}\n  stmt : ${s.tail.trim()}`);
  }
});

test('the cycle idempotency insert names the partial predicate', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'cycle.js'), 'utf8');
  assert.ok(
    /ON CONFLICT \(idempotency_key\)\s+WHERE idempotency_key IS NOT NULL\s+DO NOTHING/.test(src),
    'the exact statement that failed in production must carry the predicate');
});

test('the partial index it relies on still exists in the migrations', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'db', 'migrations', '2026-08-21_003_thivajini_feed_cycle.sql'), 'utf8');
  assert.ok(sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS thivajini_feed_cycle_idem_uq'));
  assert.ok(sql.includes('WHERE idempotency_key IS NOT NULL'),
    'if this index ever stops being partial, the query predicate must be revisited');
});

test('a raw PostgreSQL error can never reach the browser', () => {
  const req5 = require(path.join(ROOT, 'lib', 'feed', 'req5'));
  const seen = [];
  const res = { status(c) { this._c = c; return this; }, json(o) { seen.push([this._c, o]); return this; } };

  const e = new Error('there is no unique or exclusion constraint matching the ON CONFLICT specification');
  e.code = '42P10';
  req5.__err(res, e);

  const [status, payload] = seen[0];
  assert.equal(status, 500);
  assert.ok(!/ON CONFLICT/i.test(payload.error), 'the staff message must not mention ON CONFLICT');
  assert.ok(!/constraint/i.test(payload.error), 'nor constraints');
  assert.ok(!payload.error.includes('42P10'), 'nor the SQLSTATE');
  assert.ok(payload.detail.includes('ON CONFLICT'), 'the technical text is preserved as detail');
});

test('every SQLSTATE-shaped error code is treated as a database fault', () => {
  const req5 = require(path.join(ROOT, 'lib', 'feed', 'req5'));
  // A representative spread: syntax, FK, not-null, undefined table, deadlock.
  ['42P10', '23503', '23502', '42P01', '40P01', '22P02'].forEach((code) => {
    const msg = req5.__staffMessage(code, 'some raw postgres detail about ' + code);
    assert.ok(!msg.includes(code), `${code} must not appear in the staff message`);
    assert.ok(!msg.includes('postgres'), 'no raw detail may leak for ' + code);
  });
  // A non-SQLSTATE code is still allowed through when it is short and readable.
  assert.equal(req5.__staffMessage('CYCLE_NO_CANDIDATES', 'No candidate products matched these settings.'),
    'No candidate products matched these settings.');
});

test('cycle creation failure has its own staff sentence', () => {
  const req5 = require(path.join(ROOT, 'lib', 'feed', 'req5'));
  assert.equal(req5.CYCLE_CREATE_FAILED,
    "We couldn't start this optimization cycle. Please try again or contact the technical team.");
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function handleCycleCreate('), src.indexOf('async function handleCycleAdvance('));
  assert.ok(fn.includes('error: CYCLE_CREATE_FAILED'), 'the handler returns it');
  assert.ok(fn.includes("console.error('[req5] cycle-create'"), 'and logs the technical cause server-side');
  assert.ok(fn.includes('detail:'), 'while keeping detail for Diagnostics');
});

test('creating a cycle makes no provider call', async () => {
  const { deps, calls } = makeDeps({ candidateCount: 2 });
  await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: 'nolm' });
  assert.equal(calls.generate, 0, 'cycle creation must never touch an LLM');
  assert.equal(calls.terms, 0, 'nor write term selections');
});

test('a NULL idempotency key still creates a cycle', async () => {
  const { deps, db } = makeDeps({ candidateCount: 1 });
  const a = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: null });
  const b = await cycle.createCycle(deps, { createdBy: 'x', settings: {}, idempotencyKey: null });
  assert.equal(a.reused, false);
  assert.equal(b.reused, false, 'NULL keys are not unique to each other');
  assert.equal(db.cycles.length, 2);
});
