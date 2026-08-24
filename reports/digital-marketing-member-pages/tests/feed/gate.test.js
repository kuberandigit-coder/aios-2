// tests/feed/gate.test.js
//
// FEED GATE + DATA QUALITY — the staff-facing eligibility model.
//
// The rule these tests protect: "Eligible" is asserted ONLY from a real source
// value or an explicitly approved rule. It is never derived from stock, feed
// presence, Ads activity, GPC or specs. Everything else is "Needs Check" —
// which is a data gap, not an application failure.
//
//   node --test tests/feed/gate.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const gate = require(path.join(ROOT, 'lib', 'feed', 'gate'));

// ═══════════ 1. the three user-facing states ═══════════════════════════════

test('internal UNKNOWN renders as "Needs Check", never as UNKNOWN', () => {
  const g = gate.fromLegacy({ status: 'UNKNOWN', source: 'NOT_AVAILABLE_IN_LEDSONE_DB' });
  assert.equal(g.status, 'CHECK', 'internal neutral state is CHECK');
  assert.equal(g.display, 'Needs Check');
  assert.equal(g.badge, 'amber');
  assert.ok(!g.display.includes('UNKNOWN'), 'the word UNKNOWN must not reach staff');
  assert.ok(g.tooltip.includes('Merchant eligibility status is not available'),
    'the reason is preserved for the tooltip');
  assert.ok(g.reasons.includes(gate.CHECK_REASON), 'the source reason is preserved');
  assert.equal(g.source, 'UNVERIFIED');
});

test('a real Y renders as "Eligible — Y" and clears the push gate', () => {
  const g = gate.feedGate({ sourceValue: 'Y', sourceName: 'merchant_products.eligibility' });
  assert.equal(g.status, 'ELIGIBLE');
  assert.equal(g.display, 'Eligible — Y');
  assert.equal(g.badge, 'green');
  assert.equal(g.source, 'SOURCE');
  assert.equal(g.blocks_push, false);
  assert.ok(g.reasons[0].includes('merchant_products.eligibility'), 'names where the value came from');
});

test('a real N renders as "Not Eligible — N" and still blocks push', () => {
  const g = gate.feedGate({ sourceValue: 'N', sourceName: 'merchant_products.eligibility' });
  assert.equal(g.status, 'NOT_ELIGIBLE');
  assert.equal(g.display, 'Not Eligible — N');
  assert.equal(g.badge, 'red');
  assert.equal(g.blocks_push, true);
});

test('the workbook value "Check" stays CHECK and is never promoted', () => {
  const g = gate.feedGate({ sourceValue: 'Check' });
  assert.equal(g.status, 'CHECK');
  assert.equal(g.display, 'Needs Check');
  assert.equal(g.source, 'UNVERIFIED');
  assert.equal(g.blocks_push, true);
});

test('an approved derived rule is labelled DERIVED_APPROVED_RULE and cited', () => {
  const g = gate.feedGate({ sourceValue: 'Y', approvedRule: 'DR-2026-08 §4.1 workbook rule' });
  assert.equal(g.source, 'DERIVED_APPROVED_RULE');
  assert.ok(g.reasons.some((r) => r.includes('DR-2026-08')), 'the rule must be cited');
});

// ═══════════ 2. Eligible is never INVENTED ═════════════════════════════════

test('Y is never derived from stock, feed presence, Ads activity, GPC or specs', () => {
  // A product with everything except an eligibility source.
  const rich = {
    item_id: 'shopify_FR_101_202',
    shopify_variant_id: '202',
    current_title: 'Suspension Cuivre Design Industriel',
    current_description: 'Une suspension en cuivre.',
    product_type: 'Luminaires > Suspensions',
    google_product_category: '594',
    price_eur: 89.9,
    image_link: 'https://example.invalid/a.jpg',
    stock: { status: 'IN_STOCK', source: 'merchant_products.availability' },
    specs: [{ key: 'ip_rating', value: 'IP20' }],
    feed_eligible: { status: 'UNKNOWN', source: 'NOT_AVAILABLE_IN_LEDSONE_DB', note: 'Present in Merchant feed (label FR)' },
    missing_evidence: [],
    perf_30d: { impressions: 9000, clicks: 300, conversions: 12 },
  };
  const g = gate.fromLegacy(rich.feed_eligible);
  assert.equal(g.status, 'CHECK', 'in stock + in feed + has specs must NOT make it Eligible');
  assert.equal(g.blocks_push, true);

  const q = gate.dataQuality(rich, { hasPaidTerms: true });
  assert.equal(q.can_generate, true, 'a draft is still allowed');
  assert.equal(q.can_push, false, 'production push is not');
});

test('the source code contains no eligibility-deriving heuristic', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'gate.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // ELIGIBLE may be ASSIGNED in exactly one place, and only from a literal Y.
  const NL = String.fromCharCode(10);
  // A single `=` (not ==, ===, !=, <=, >=) followed by a space, then ELIGIBLE
  // somewhere on the same line. Comparisons are excluded by the lookbehind set.
  const assignments = code.split(NL).filter((l) => /(^|[^=!<>])=\s.*GATE\.ELIGIBLE/.test(l));
  assert.equal(assignments.length, 1,
    'ELIGIBLE must be assigned in exactly one place, found: ' + JSON.stringify(assignments));
  assert.ok(/raw === .Y./.test(assignments[0]),
    'the single assignment must be guarded by a literal Y: ' + assignments[0]);
  ['stock', 'availability', 'gmc_feed_label', 'perf_30d', 'specs.length'].forEach((h) => {
    assert.ok(!code.includes(h + ' ?') && !code.includes('if (' + h),
      `eligibility must not branch on ${h}`);
  });
});

// ═══════════ 3. blocking vs non-blocking gaps ══════════════════════════════

const BASE = {
  item_id: 'shopify_FR_1_2',
  shopify_variant_id: '2',
  current_title: 'Titre actuel',
  feed_eligible: { status: 'UNKNOWN' },
  specs: [],
  missing_evidence: [],
};

test('missing product identity BLOCKS generation', () => {
  const q = gate.dataQuality({ ...BASE, item_id: null, shopify_variant_id: null, shopify_product_id: null });
  assert.equal(q.can_generate, false);
  assert.equal(q.level, 'MISSING_CRITICAL');
  assert.equal(q.badge, 'red');
  assert.equal(q.label, 'Missing critical data');
  assert.ok(q.gaps.blocking.some((g) => g.field === 'product_identity'));
});

test('no title AND no description BLOCKS generation', () => {
  const q = gate.dataQuality({ ...BASE, current_title: null, current_description: null });
  assert.equal(q.can_generate, false);
  assert.ok(q.gaps.blocking.some((g) => g.label === 'Current title unavailable'));
});

test('no paid converting terms BLOCKS generation', () => {
  const q = gate.dataQuality(BASE, { hasPaidTerms: false });
  assert.equal(q.can_generate, false);
  assert.ok(q.gaps.blocking.some((g) => g.field === 'paid_terms'));
});

test('Needs Check blocks PUSH but not generation, with the right sentence', () => {
  const q = gate.dataQuality(BASE, { hasPaidTerms: true });
  assert.equal(q.can_generate, true);
  assert.equal(q.can_push, false);
  assert.equal(q.level, 'PARTIAL');
  assert.equal(q.badge, 'amber');
  assert.equal(q.summary, 'You can generate a draft, but this product is not ready for production push.');
  assert.ok(q.gaps.push_blocking.some((g) => g.label === 'Feed eligibility needs review'));
});

test('MPN, item_group_id and Keyword Planner are INFORMATIONAL only', () => {
  const q = gate.dataQuality(
    { ...BASE, missing_evidence: ['mpn', 'item_group_id', 'keyword_planner'] },
    { hasPaidTerms: true });
  assert.equal(q.can_generate, true, 'none of these may block generation');
  ['mpn', 'item_group_id', 'keyword_planner'].forEach((f) => {
    assert.ok(q.gaps.informational.some((g) => g.field === f), `${f} must be informational`);
    assert.ok(!q.gaps.blocking.some((g) => g.field === f));
    assert.ok(!q.gaps.push_blocking.some((g) => g.field === f));
  });
});

test('a fully-evidenced, Eligible product is COMPLETE and pushable', () => {
  const q = gate.dataQuality({
    ...BASE,
    feed_gate: gate.feedGate({ sourceValue: 'Y', sourceName: 'src' }),
    specs: [{ key: 'ip_rating', value: 'IP20' }],
  }, { hasPaidTerms: true, termsStale: false });
  assert.equal(q.level, 'COMPLETE');
  assert.equal(q.badge, 'green');
  assert.equal(q.can_push, true);
  assert.equal(q.counts.blocking, 0);
  assert.equal(q.counts.push_blocking, 0);
});

// ═══════════ 4. staff-friendly labels replace raw field names ══════════════

test('raw field names are translated into staff sentences', () => {
  const cases = {
    sku: 'SKU unavailable',
    verified_technical_specs: 'Technical specifications unavailable',
    google_product_category: 'Google Product Category unavailable',
    current_description: 'Current description unavailable',
    feed_eligible: 'Feed eligibility needs review',
    fresh_paid_terms: 'Fresh paid search terms unavailable',
  };
  Object.keys(cases).forEach((k) => assert.equal(gate.labelFor(k), cases[k]));
});

test('an unknown field still gets a readable label, never a raw token', () => {
  const l = gate.labelFor('some_new_field');
  assert.ok(!l.includes('_'), 'underscores must not reach staff');
  assert.equal(l, 'some new field unavailable');
});

test('the classified gap list never leaks a raw field name as its label', () => {
  const q = gate.dataQuality(
    { ...BASE, missing_evidence: ['sku', 'verified_technical_specs', 'google_product_category'] },
    { hasPaidTerms: true, termsStale: true });
  const all = [].concat(q.gaps.blocking, q.gaps.push_blocking, q.gaps.informational);
  assert.ok(all.length > 0);
  all.forEach((g) => {
    assert.ok(!/_/.test(g.label), `label "${g.label}" still looks like a field name`);
    assert.ok(!/UNKNOWN/.test(g.label));
  });
});

// ═══════════ 5. the API attaches the gate to every product ═════════════════

test('req5 attaches feed_gate and data_quality to candidates and product detail', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'req5.js'), 'utf8');
  assert.ok(src.includes('c.feed_gate = gate.fromLegacy(c.feed_eligible)'), 'candidates carry feed_gate');
  assert.ok(src.includes('c.data_quality = gate.dataQuality('), 'candidates carry data_quality');
  assert.ok(src.includes('product.feed_gate = gate.fromLegacy(product.feed_eligible)'), 'detail carries feed_gate');
  assert.ok(src.includes("'No verified technical specifications available'"),
    'zero specs is a sentence, not a 0');
});

test('the CSV renders the Feed Gate wording, not the internal token', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'feed', 'columns.js'), 'utf8');
  const line = src.split('\n').find((l) => l.includes("key: 'eligibility_status'"));
  assert.ok(line, 'the eligibility column still exists');
  assert.ok(line.includes('gate.fromLegacy'), 'it must go through the gate');
  assert.ok(!line.includes("|| 'UNKNOWN'"), 'no raw UNKNOWN fallback in an exported file');
});
