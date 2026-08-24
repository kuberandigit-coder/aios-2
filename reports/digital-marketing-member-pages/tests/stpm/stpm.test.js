'use strict';

// tests/stpm/stpm.test.js
//
// REQ-DM-2026-08-MAHI01 — pure-logic tests. No database required.
//
// The boundary tests exist because the requirement's thresholds are strict
// (`>` and `<`, never `>=`/`<=`). A single off-by-one here would silently
// change which search terms a staff member is told to negative, so each
// boundary is asserted from both sides.

const test = require('node:test');
const assert = require('node:assert');

const metrics = require('../../lib/stpm/metrics');
const rules = require('../../lib/stpm/rules');
const intent = require('../../lib/stpm/intent');
const normalize = require('../../lib/stpm/normalize');
const matching = require('../../lib/stpm/matching');
const targeting = require('../../lib/stpm/targeting');
const source = require('../../lib/stpm/source');
const exporter = require('../../lib/stpm/export');
const cfg = require('../../lib/stpm/config');

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────
test('CTR is a percentage', () => {
  assert.strictEqual(metrics.ctr(10, 1000), 1);
  assert.strictEqual(metrics.ctr(5, 1000), 0.5);
});

test('CTR is null (not 0) when impressions are zero or missing', () => {
  // A fabricated 0 would read as "shown and never clicked" and could trip the
  // low-CTR rule for a term that was never shown at all.
  assert.strictEqual(metrics.ctr(0, 0), null);
  assert.strictEqual(metrics.ctr(5, null), null);
  assert.strictEqual(metrics.ctr(5, undefined), null);
});

test('ROAS is value / cost', () => {
  assert.strictEqual(metrics.roas(100, 25), 4);
  assert.strictEqual(metrics.roas(8, 20), 0.4);
});

test('ROAS is null (not 0) when cost is zero or missing — never divides by zero', () => {
  assert.strictEqual(metrics.roas(100, 0), null);
  assert.strictEqual(metrics.roas(100, null), null);
  assert.ok(Number.isFinite(metrics.roas(100, 0)) === false);
});

test('aggregation keeps money null when every contributing row is null', () => {
  const rows = [
    { date: '2026-08-10', campaign_id: 1, search_term: 'led strip', clicks: 2, impressions: 10, cost: null, conversions: 0, conversion_value: null },
    { date: '2026-08-11', campaign_id: 1, search_term: 'led strip', clicks: 3, impressions: 20, cost: null, conversions: 0, conversion_value: null },
  ];
  const out = metrics.aggregateByTermCampaign(rows, { normalize: normalize.normalizeSearchTerm });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].clicks, 5);
  assert.strictEqual(out[0].cost, null);
  assert.strictEqual(out[0].roas, null);
});

test('aggregation groups by term AND campaign, never term alone', () => {
  const rows = [
    { date: '2026-08-10', campaign_id: 1, search_term: 'led strip', clicks: 2, impressions: 10, cost: 1, conversions: 0 },
    { date: '2026-08-10', campaign_id: 2, search_term: 'led strip', clicks: 4, impressions: 20, cost: 2, conversions: 0 },
  ];
  const out = metrics.aggregateByTermCampaign(rows, { normalize: normalize.normalizeSearchTerm });
  assert.strictEqual(out.length, 2, 'same text in two campaigns must stay separate');
});

// ─────────────────────────────────────────────────────────────────────────────
// Threshold boundaries — the requirement's operators are strict
// ─────────────────────────────────────────────────────────────────────────────
function evalRow(over) {
  const base = {
    clicks: 0, impressions: 0, cost: 0, conversions: 0, conversion_value: 0,
    ctr: null, roas: null, search_term_normalized: 'led strip 5m',
  };
  return rules.evaluateWasteRules(Object.assign(base, over)).fired.map((f) => f.rule);
}

test('Rule 1 boundary: 15 clicks does NOT fire, 16 does', () => {
  assert.ok(!evalRow({ clicks: 15, conversions: 0 }).includes(rules.RULE.HIGH_CLICKS_NO_CONV));
  assert.ok(evalRow({ clicks: 16, conversions: 0 }).includes(rules.RULE.HIGH_CLICKS_NO_CONV));
});

test('Rule 1 does not fire when the term converted', () => {
  assert.ok(!evalRow({ clicks: 50, conversions: 1 }).includes(rules.RULE.HIGH_CLICKS_NO_CONV));
});

test('Rule 2 boundary: cost 10.00 does NOT fire, 10.01 does', () => {
  assert.ok(!evalRow({ cost: 10.00, conversions: 0 }).includes(rules.RULE.HIGH_COST_NO_CONV));
  assert.ok(evalRow({ cost: 10.01, conversions: 0 }).includes(rules.RULE.HIGH_COST_NO_CONV));
});

test('Rule 2 never fires on a NULL cost — null must not satisfy a threshold', () => {
  assert.ok(!evalRow({ cost: null, conversions: 0 }).includes(rules.RULE.HIGH_COST_NO_CONV));
});

test('Rule 3 boundary: 500 impressions does NOT qualify, 501 does', () => {
  assert.ok(!evalRow({ impressions: 500, ctr: 0.1 }).includes(rules.RULE.LOW_CTR));
  assert.ok(evalRow({ impressions: 501, ctr: 0.1 }).includes(rules.RULE.LOW_CTR));
});

test('Rule 3 boundary: CTR exactly 0.5 does NOT fire, 0.49 does', () => {
  assert.ok(!evalRow({ impressions: 1000, ctr: 0.5 }).includes(rules.RULE.LOW_CTR));
  assert.ok(evalRow({ impressions: 1000, ctr: 0.49 }).includes(rules.RULE.LOW_CTR));
});

test('Rule 3 never fires on a NULL CTR', () => {
  assert.ok(!evalRow({ impressions: 5000, ctr: null }).includes(rules.RULE.LOW_CTR));
});

test('Rule 4 boundary: ROAS exactly 1 does NOT fire, 0.99 does', () => {
  assert.ok(!evalRow({ conversions: 2, roas: 1 }).includes(rules.RULE.POOR_ROAS));
  assert.ok(evalRow({ conversions: 2, roas: 0.99 }).includes(rules.RULE.POOR_ROAS));
});

test('Rule 4 never fires on a NULL ROAS (zero-cost converting term)', () => {
  // Zero cost with conversions is infinitely profitable, not unprofitable.
  assert.ok(!evalRow({ conversions: 5, roas: null, cost: 0 }).includes(rules.RULE.POOR_ROAS));
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance status
// ─────────────────────────────────────────────────────────────────────────────
test('Performance Status matrix', () => {
  const S = cfg.PERFORMANCE_STATUS;
  assert.strictEqual(rules.performanceStatus(3, 0), S.WORKING);
  assert.strictEqual(rules.performanceStatus(3, 9), S.WORKING);
  assert.strictEqual(rules.performanceStatus(0, 5), S.DROPPED);
  assert.strictEqual(rules.performanceStatus(0, 0), S.NO_CONVERSIONS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision engine
// ─────────────────────────────────────────────────────────────────────────────
test('Decision is always one of exactly three approved values', () => {
  const cases = [
    { fired: [], performance_status: 'Working', opportunity: {} },
    { fired: [{ rule: rules.RULE.HIGH_CLICKS_NO_CONV }], performance_status: 'No Conversions', opportunity: {} },
    { fired: [{ rule: rules.RULE.LOW_CTR }], performance_status: 'Working', opportunity: {} },
    { fired: [], performance_status: 'Working', opportunity: { keyword_opportunity: true } },
  ];
  for (const c of cases) {
    assert.ok(cfg.DECISION_VALUES.includes(rules.decide(c).decision));
  }
});

test('"Review" is never emitted as a Decision', () => {
  const d = rules.decide({
    fired: [{ rule: rules.RULE.LOW_CTR }], performance_status: 'Working', opportunity: {},
  });
  assert.notStrictEqual(d.decision, 'Review');
  assert.strictEqual(d.decision, cfg.DECISION.KEEP);
});

test('Low CTR alone -> Keep, flagged for attention, not a negative recommendation', () => {
  const d = rules.decide({
    fired: [{ rule: rules.RULE.LOW_CTR }], performance_status: 'Working', opportunity: {},
  });
  assert.strictEqual(d.decision, cfg.DECISION.KEEP);
  assert.strictEqual(d.negative_keyword_recommended, false);
  assert.strictEqual(d.decision_basis.needs_attention, true);
});

test('Every fired rule is retained as evidence when several conflict', () => {
  const fired = [
    { rule: rules.RULE.HIGH_CLICKS_NO_CONV },
    { rule: rules.RULE.HIGH_COST_NO_CONV },
    { rule: rules.RULE.LOW_CTR },
  ];
  const d = rules.decide({ fired, performance_status: 'No Conversions', opportunity: {} });
  assert.strictEqual(d.decision_basis.fired_rules.length, 3);
  assert.strictEqual(d.decision_basis.multiple_rules_fired, true);
  // Precedence is not business-ratified; the flag must say so.
  assert.strictEqual(d.decision_basis.precedence_ratified, false);
});

test('A negative recommendation is never an approval', () => {
  const d = rules.decide({
    fired: [{ rule: rules.RULE.HIGH_COST_NO_CONV }], performance_status: 'No Conversions', opportunity: {},
  });
  assert.strictEqual(d.decision, cfg.DECISION.NEGATIVE);
  assert.strictEqual(d.negative_keyword_recommended, true);
  assert.ok(!('review_status' in d), 'the rule engine must never set review status');
});

// ─────────────────────────────────────────────────────────────────────────────
// Intent
// ─────────────────────────────────────────────────────────────────────────────
test('Requirement-stated informational examples are classified deterministically', () => {
  for (const t of ['how to install led strip', 'led strip ideas', 'diy led lamp']) {
    const r = intent.classify(normalize.normalizeSearchTerm(t));
    assert.strictEqual(r.label, intent.LABEL.INFORMATIONAL, t);
    assert.strictEqual(r.confidence, intent.CONFIDENCE.DETERMINISTIC, t);
  }
});

test('German informational vocabulary is flagged as limited, not asserted as certain', () => {
  const r = intent.classify(normalize.normalizeSearchTerm('lampenschirm selber machen'));
  assert.strictEqual(r.label, intent.LABEL.INFORMATIONAL);
  assert.strictEqual(r.confidence, intent.CONFIDENCE.LIMITED);
  assert.match(r.coverage_note, /not yet business-approved/i);
});

test('Intent matches on token boundaries, not substrings', () => {
  // "wie" must not fire inside "wieviel"; a plain includes() would.
  const r = intent.classify(normalize.normalizeSearchTerm('wieviel watt led'));
  assert.strictEqual(r.label, intent.LABEL.PRODUCT);
});

test('An ordinary product term is not flagged', () => {
  const r = intent.classify(normalize.normalizeSearchTerm('led strip 5m warm white'));
  assert.strictEqual(r.label, intent.LABEL.PRODUCT);
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────
test('Units and model codes survive normalization', () => {
  const n = normalize.normalizeSearchTerm('LED Strip 5M - 24V, E27 (300mA)');
  for (const token of ['5m', '24v', 'e27', '300ma']) {
    assert.ok(n.includes(token), `${token} must survive: ${n}`);
  }
});

test('German umlauts and sharp s fold consistently on both sides', () => {
  assert.strictEqual(
    normalize.normalizeSearchTerm('Hängelampe weiß'),
    normalize.normalizeSearchTerm('Haengelampe weiss')
  );
});

test('The internal ~NNNN title suffix is stripped from product titles only', () => {
  assert.strictEqual(
    normalize.normalizeProductTitle('Netzteil 3W LED Treiber 12V 300mA~2430'),
    'netzteil 3w led treiber 12v 300ma'
  );
  // A term a customer typed keeps its digits.
  assert.ok(normalize.normalizeSearchTerm('netzteil 2430').includes('2430'));
});

test('Phrase containment respects token boundaries', () => {
  assert.ok(normalize.containsPhrase('led strip 5m warm', 'strip 5m'));
  assert.ok(!normalize.containsPhrase('unleaded fuel', 'led'));
  assert.ok(!normalize.containsPhrase('15mm cable', '5m'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Product matching
// ─────────────────────────────────────────────────────────────────────────────
const CATALOGUE = [
  {
    item_id: '111', listing_id: '9001', title: 'LED Strip 5m Warm White~2430',
    product_description: 'Ein flexibler LED Streifen fuer Innenraeume.',
    shopify_handle: 'led-strip-5m-warm-white', listing_url: null,
    meta_title: 'LED Strip 5m', meta_description: 'Warmweisser LED Streifen',
    tags: ['led strip', ' bsell', 'Innenbeleuchtung'],
  },
  {
    item_id: '222', listing_id: '9002', title: '24V LED Transformer 60W~1180',
    product_description: 'Konstantspannung Netzteil 24V fuer LED Streifen.',
    shopify_handle: '24v-led-transformer-60w', listing_url: null,
    meta_title: null, meta_description: null,
    tags: ['transformer', 'netzteil'],
  },
  {
    item_id: '333', listing_id: '9003', title: 'Vintage Pendelleuchte E27~1220',
    product_description: 'Pendelleuchte mit E27 Fassung.',
    shopify_handle: 'vintage-pendelleuchte-e27',
    listing_url: 'https://ledsone.de/products/vintage-pendelleuchte-e27/333',
    meta_title: 'Vintage Pendelleuchte', meta_description: 'E27 Pendelleuchte',
    tags: ['pendelleuchte'],
  },
];

const INDEX = matching.buildProductIndex(CATALOGUE);

test('Exact tag match is unique -> Auto Matched', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('LED Strip'), INDEX);
  assert.strictEqual(m.match_type, cfg.MATCH_TYPE.EXACT);
  assert.strictEqual(m.match_source, 'tag');
  assert.strictEqual(m.mapping_status, cfg.MAPPING_STATUS.AUTO);
  assert.strictEqual(m.product_id, '111');
});

test('Exact normalized-title match -> Auto Matched', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('LED Strip 5m Warm White'), INDEX);
  assert.strictEqual(m.match_type, cfg.MATCH_TYPE.EXACT);
  assert.strictEqual(m.match_source, 'title');
  assert.strictEqual(m.mapping_status, cfg.MAPPING_STATUS.AUTO);
});

test('Phrase match -> Manual Review, never Auto (no approved cutoff exists)', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('transformer 60w'), INDEX);
  assert.strictEqual(m.match_type, cfg.MATCH_TYPE.PHRASE);
  assert.strictEqual(m.mapping_status, cfg.MAPPING_STATUS.MANUAL);
  assert.strictEqual(m.product_id, '222');
});

test('No plausible candidate -> No Match with a NULL product id, never forced', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('gartenschlauch 50m'), INDEX);
  assert.strictEqual(m.match_type, cfg.MATCH_TYPE.NONE);
  assert.strictEqual(m.mapping_status, cfg.MAPPING_STATUS.NONE);
  assert.strictEqual(m.product_id, null);
});

test('Ambiguous exact matches are never silently resolved to one product', () => {
  const dupes = matching.buildProductIndex([
    { item_id: 'a', listing_id: '1', title: 'Kabel~1', tags: ['kabel'], product_description: 'x', shopify_handle: 'a', listing_url: null },
    { item_id: 'b', listing_id: '2', title: 'Kabel~2', tags: ['kabel'], product_description: 'y', shopify_handle: 'b', listing_url: null },
  ]);
  const m = matching.matchTerm('kabel', dupes);
  assert.strictEqual(m.mapping_status, cfg.MAPPING_STATUS.MANUAL);
  assert.ok(m.match_evidence.tie_count >= 2);
});

test('Source priority is honoured: title outranks description', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('pendelleuchte'), INDEX);
  assert.strictEqual(m.product_id, '333');
  assert.ok(['title', 'tag', 'meta_title'].includes(m.match_source));
});

test('Missing meta fields are reported, and matching continues regardless', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('netzteil 24v'), INDEX);
  assert.strictEqual(m.product_id, '222');
  const codes = m.data_quality_flags.map((f) => f.code);
  assert.ok(codes.includes('meta_title_missing'));
  assert.ok(codes.includes('meta_description_missing'));
});

test('Product URL is derived exactly as proven when listing_url is absent', () => {
  const url = matching.resolveProductUrl({
    item_id: '111', shopify_handle: 'led-strip-5m-warm-white', listing_url: null,
  });
  assert.strictEqual(url, 'https://ledsone.de/products/led-strip-5m-warm-white/111');
});

test('A stored listing_url always wins over the derivation', () => {
  assert.strictEqual(
    matching.resolveProductUrl({
      item_id: '333', shopify_handle: 'x', listing_url: 'https://ledsone.de/products/vintage-pendelleuchte-e27/333',
    }),
    'https://ledsone.de/products/vintage-pendelleuchte-e27/333'
  );
});

test('Match score is labelled as ranking evidence, not a confidence', () => {
  const m = matching.matchTerm(normalize.normalizeSearchTerm('transformer 60w'), INDEX);
  assert.strictEqual(m.match_evidence.score_is_ranking_evidence_not_confidence, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Date windows and fallback
// ─────────────────────────────────────────────────────────────────────────────
const TODAY = new Date(Date.UTC(2026, 7, 21)); // 2026-08-21

test('Last 7 Days is an inclusive 7-day window', () => {
  const w = source.resolveRequestedWindow({ preset: 'last7' }, TODAY);
  assert.strictEqual(w.start, '2026-08-15');
  assert.strictEqual(w.end, '2026-08-21');
});

test('No fallback when the requested window has rows', async () => {
  const w = source.resolveRequestedWindow({ preset: 'last7' }, TODAY);
  const r = await source.applyDateFallback(w, TODAY, async () => 42);
  assert.strictEqual(r.fallback_used, false);
  assert.strictEqual(r.start, '2026-08-15');
});

test('Zero rows in 7 days falls back to 14 days and records both ranges', async () => {
  const w = source.resolveRequestedWindow({ preset: 'last7' }, TODAY);
  const probe = async (s) => (s === '2026-08-15' ? 0 : 287);
  const r = await source.applyDateFallback(w, TODAY, probe);
  assert.strictEqual(r.fallback_used, true);
  assert.strictEqual(r.fallback_days, 14);
  assert.strictEqual(r.start, '2026-08-08');
  assert.strictEqual(r.end, '2026-08-21');
  assert.strictEqual(r.rows, 287);
});

test('Both windows empty: keeps the REQUESTED range and does not claim a fallback', async () => {
  const w = source.resolveRequestedWindow({ preset: 'last7' }, TODAY);
  const r = await source.applyDateFallback(w, TODAY, async () => 0);
  assert.strictEqual(r.fallback_used, false);
  assert.strictEqual(r.start, '2026-08-15');
  assert.match(r.fallback_reason, /fallback/i);
});

test('A custom range is never widened automatically', async () => {
  const w = source.resolveRequestedWindow({ preset: 'custom', start: '2026-06-01', end: '2026-06-30' }, TODAY);
  assert.strictEqual(w.allowFallback, false);
  const r = await source.applyDateFallback(w, TODAY, async () => 0);
  assert.strictEqual(r.fallback_used, false);
  assert.strictEqual(r.start, '2026-06-01');
  assert.strictEqual(r.end, '2026-06-30');
});

test('Invalid custom dates are rejected', () => {
  assert.throws(() => source.resolveRequestedWindow({ preset: 'custom', start: 'nope', end: '2026-06-30' }, TODAY), /valid start and end/i);
  assert.throws(() => source.resolveRequestedWindow({ preset: 'custom', start: '2026-02-31', end: '2026-06-30' }, TODAY), /valid start and end/i);
  assert.throws(() => source.resolveRequestedWindow({ preset: 'custom', start: '2026-07-01', end: '2026-06-01' }, TODAY), /not be after/i);
});

test('Historical window ends the day before the current window starts', () => {
  const h = source.resolveHistoricalWindow({ preset: 'prev30' }, '2026-08-15');
  assert.strictEqual(h.end, '2026-08-14');
  assert.strictEqual(h.start, '2026-07-16');
});

test('Previous 60 Days is honoured', () => {
  const h = source.resolveHistoricalWindow({ preset: 'prev60' }, '2026-08-15');
  assert.strictEqual(h.end, '2026-08-14');
  assert.strictEqual(h.start, '2026-06-16');
});

test('An overlapping custom historical range is rejected', () => {
  assert.throws(
    () => source.resolveHistoricalWindow({ preset: 'custom', start: '2026-08-01', end: '2026-08-20' }, '2026-08-15'),
    /must end before/i
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Source health
// ─────────────────────────────────────────────────────────────────────────────
test('Campaign data current but search terms stale -> stale_ingestion, not "no activity"', () => {
  const h = source.buildSourceHealth({
    freshness: { search_term: '2026-08-14', pmax_term: '2026-07-16', campaign_perf: '2026-08-21', latest_search_term: '2026-08-14' },
    window: { start: '2026-08-08', end: '2026-08-21' },
    requested: { start: '2026-08-15', end: '2026-08-21' },
    fallback: { fallback_used: true },
    coverage: [{ campaign_id: '1', campaign_name: 'A', rows_in_window: 287, rows_total: 300, max_date: '2026-08-14' }],
    rowCount: 287,
  });
  const codes = h.warnings.map((w) => w.code);
  assert.ok(codes.includes('search_term_ingestion_stale'));
  assert.ok(codes.includes('date_fallback_used'));
  assert.strictEqual(h.ingestion_lag_days, 7);
});

test('The fallback warning states both the requested and the actual range', () => {
  const h = source.buildSourceHealth({
    freshness: { campaign_perf: '2026-08-21', latest_search_term: '2026-08-14' },
    window: { start: '2026-08-08', end: '2026-08-21' },
    requested: { start: '2026-08-15', end: '2026-08-21' },
    fallback: { fallback_used: true },
    coverage: [], rowCount: 10,
  });
  const w = h.warnings.find((x) => x.code === 'date_fallback_used');
  assert.match(w.title, /Last 7 days data is unavailable/i);
  assert.match(w.message, /2026-08-15/);
  assert.match(w.message, /2026-08-08/);
});

test('No rows anywhere -> explicit no_data health with the latest known source date', () => {
  const h = source.buildSourceHealth({
    freshness: { campaign_perf: '2026-08-21', latest_search_term: '2026-08-14' },
    window: { start: '2026-08-15', end: '2026-08-21' },
    requested: { start: '2026-08-15', end: '2026-08-21' },
    fallback: { fallback_used: false },
    coverage: [], rowCount: 0,
  });
  assert.strictEqual(h.health, cfg.SOURCE_HEALTH.NO_DATA);
  const w = h.warnings.find((x) => x.code === 'no_search_term_data');
  assert.match(w.message, /2026-08-14/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Opportunity
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_INDEX = targeting.buildTargetingIndex(
  [{ kind: 'search_theme', value: 'lampenschirm' }],
  ['111']
);

test('A converting term covered by an existing search theme is not an opportunity', () => {
  const o = targeting.evaluateOpportunity({
    row: { conversions: 3, clicks: 10, roas: 4 },
    normalizedTerm: 'lampenschirm kupfer',
    index: TARGET_INDEX, match: { product_id: '222' }, intentLabel: 'product',
  });
  assert.strictEqual(o.keyword_opportunity, false);
  assert.match(o.opportunity_reason, /already represented/i);
});

test('A non-converting term is never an opportunity', () => {
  const o = targeting.evaluateOpportunity({
    row: { conversions: 0, clicks: 40, roas: null },
    normalizedTerm: 'gartenschlauch', index: TARGET_INDEX,
    match: { product_id: '333' }, intentLabel: 'product',
  });
  assert.strictEqual(o.keyword_opportunity, false);
  assert.strictEqual(o.opportunity_candidate, false);
});

test('Absence of keyword rows alone does NOT make every converting term an opportunity', () => {
  // The matched product already served, so the targeting gap is unproven.
  const o = targeting.evaluateOpportunity({
    row: { conversions: 2, clicks: 5, roas: 3 },
    normalizedTerm: 'led treiber 12v', index: TARGET_INDEX,
    match: { product_id: '111' }, intentLabel: 'product',
  });
  assert.strictEqual(o.keyword_opportunity, false);
  assert.strictEqual(o.opportunity_candidate, true);
  assert.match(o.opportunity_reason, /already serves/i);
});

test('A proven gap -> confirmed opportunity', () => {
  const o = targeting.evaluateOpportunity({
    row: { conversions: 2, clicks: 5, roas: 3 },
    normalizedTerm: 'led treiber 12v', index: TARGET_INDEX,
    match: { product_id: '999' }, intentLabel: 'product',
  });
  assert.strictEqual(o.keyword_opportunity, true);
  assert.strictEqual(o.targeting_evidence.semantics_ratified, false);
});

test('Informational intent can never be an opportunity', () => {
  const o = targeting.evaluateOpportunity({
    row: { conversions: 5, clicks: 20, roas: 6 },
    normalizedTerm: 'led strip ideas', index: TARGET_INDEX,
    match: { product_id: '999' }, intentLabel: 'informational',
  });
  assert.strictEqual(o.keyword_opportunity, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
const EXPORT_ROWS = [
  {
    search_term: 'led strip 5m', campaign_name: 'PMax DE', campaign_type: 'PERFORMANCE_MAX',
    clicks: 22, impressions: 650, cost: 12.5, conversions: 0, conversion_value: 0,
    ctr: 3.38, roas: null, historical_conversions: 0, performance_status: 'No Conversions',
    waste_reasons: [{ rule: 'high_clicks_no_conversion', label: 'High clicks + no conversion', explain: '22 clicks > 15' }],
    decision: 'Negative Keyword', negative_keyword_recommended: true,
    keyword_opportunity: false, opportunity_candidate: false,
    product_id: null, match_type: 'No Match', mapping_status: 'No Match',
    review_status: 'Pending',
  },
  {
    search_term: 'led transformer 24v', campaign_name: 'PMax DE', campaign_type: 'PERFORMANCE_MAX',
    clicks: 8, impressions: 420, cost: 5.2, conversions: 2, conversion_value: 35,
    ctr: 1.9, roas: 6.73, historical_conversions: 5, performance_status: 'Working',
    waste_reasons: [], decision: 'Keyword Opportunity', negative_keyword_recommended: false,
    keyword_opportunity: true, opportunity_candidate: true, opportunity_reason: 'Not covered by a search theme.',
    product_id: '222', product_title: '24V LED Transformer', match_type: 'Exact',
    match_score: 95, match_source: 'tag', mapping_status: 'Auto Matched', review_status: 'Approved',
  },
];

test('Full export contains every row and a header', () => {
  const csv = exporter.buildFullExport(EXPORT_ROWS);
  assert.ok(csv.includes('Search Term'));
  assert.ok(csv.includes('led strip 5m'));
  assert.ok(csv.includes('led transformer 24v'));
});

test('Negative export contains ONLY recommended negatives, and carries Review Status', () => {
  const csv = exporter.buildNegativeExport(EXPORT_ROWS);
  assert.ok(csv.includes('led strip 5m'));
  assert.ok(!csv.includes('led transformer 24v'));
  assert.ok(csv.includes('Review Status'));
  assert.ok(csv.includes('Pending'));
});

test('Opportunity export contains only opportunities/candidates', () => {
  const csv = exporter.buildOpportunityExport(EXPORT_ROWS);
  assert.ok(csv.includes('led transformer 24v'));
  assert.ok(!csv.includes('led strip 5m'));
  assert.ok(csv.includes('Confirmed'));
});

test('CSV neutralises spreadsheet formula injection from customer-typed terms', () => {
  const csv = exporter.buildFullExport([Object.assign({}, EXPORT_ROWS[0], { search_term: '=cmd|/c calc' })]);
  assert.ok(csv.includes("'=cmd"), 'a leading = must be escaped');
});

test('CSV quotes values containing commas and quotes', () => {
  assert.strictEqual(exporter.csvCell('a,b'), '"a,b"');
  assert.strictEqual(exporter.csvCell('say "hi"'), '"say ""hi"""');
});

// ─────────────────────────────────────────────────────────────────────────────
// Config guarantees
// ─────────────────────────────────────────────────────────────────────────────
test('Thresholds match the approved requirement exactly', () => {
  assert.strictEqual(cfg.THRESHOLDS.HIGH_CLICKS, 15);
  assert.strictEqual(cfg.THRESHOLDS.HIGH_COST, 10);
  assert.strictEqual(cfg.THRESHOLDS.LOW_CTR_IMPRESSIONS, 500);
  assert.strictEqual(cfg.THRESHOLDS.LOW_CTR_PCT, 0.5);
  assert.strictEqual(cfg.THRESHOLDS.POOR_ROAS, 1);
});

test('Review defaults to Pending and allows exactly three values', () => {
  assert.strictEqual(cfg.REVIEW.PENDING, 'Pending');
  assert.deepStrictEqual(cfg.REVIEW_VALUES.slice().sort(), ['Approved', 'Pending', 'Rejected']);
});

test('The canonical source rule excludes PMax insight rows', () => {
  assert.match(cfg.CANONICAL_SOURCE_RULE, /insight_id IS NULL/);
  assert.ok(!/campaign_search_term_insights/.test(cfg.CANONICAL_SOURCE_RULE));
});

// ── Current-period presets (UI correction pass) ─────────────────────────────
//
// Three presets with deliberately different fallback semantics. The important
// one is `last14`: the user asked for fourteen days on purpose, so telling them
// "Last 7 days data is unavailable" would be untrue.

test('Last 7 Days is the default and is the only window that may auto-widen', () => {
  const w = source.resolveRequestedWindow({}, TODAY);          // no preset supplied
  assert.strictEqual(w.preset, 'last7');
  assert.strictEqual(w.start, '2026-08-15');
  assert.strictEqual(w.end, '2026-08-21');
  assert.strictEqual(w.allowFallback, true);
});

test('Last 14 Days resolves to a real 14-day window', () => {
  const w = source.resolveRequestedWindow({ preset: 'last14' }, TODAY);
  assert.strictEqual(w.preset, 'last14');
  assert.strictEqual(w.start, '2026-08-08');
  assert.strictEqual(w.end, '2026-08-21');
});

test('An explicit Last 14 Days request never reports a fallback', async () => {
  const w = source.resolveRequestedWindow({ preset: 'last14' }, TODAY);
  assert.strictEqual(w.allowFallback, false);

  const withRows = await source.applyDateFallback(w, TODAY, async () => 287);
  assert.strictEqual(withRows.fallback_used, false);
  assert.strictEqual(withRows.start, '2026-08-08');

  // Even with no rows it must not claim the 7-day window failed.
  const empty = await source.applyDateFallback(w, TODAY, async () => 0);
  assert.strictEqual(empty.fallback_used, false);
});

test('The fallback banner is not shown for an explicit Last 14 Days request', () => {
  const w = source.resolveRequestedWindow({ preset: 'last14' }, TODAY);
  const h = source.buildSourceHealth({
    freshness: { campaign_perf: '2026-08-21', latest_search_term: '2026-08-14' },
    window: w, requested: w, fallback: { fallback_used: false },
    coverage: [], rowCount: 287,
  });
  assert.ok(!h.warnings.some((x) => x.code === 'date_fallback_used'),
    'a user who asked for 14 days must not be told the 7-day window was unavailable');
});

test('Last 7 Days still falls back to 14 and preserves both ranges', async () => {
  const w = source.resolveRequestedWindow({ preset: 'last7' }, TODAY);
  const r = await source.applyDateFallback(w, TODAY, async (s) => (s === '2026-08-15' ? 0 : 287));
  assert.strictEqual(r.fallback_used, true);
  assert.strictEqual(r.fallback_days, 14);
  assert.strictEqual(w.start, '2026-08-15');   // requested preserved
  assert.strictEqual(r.start, '2026-08-08');   // actual widened
});

test('A custom current range is never auto-widened', async () => {
  const w = source.resolveRequestedWindow({ preset: 'custom', start: '2026-06-01', end: '2026-06-30' }, TODAY);
  const r = await source.applyDateFallback(w, TODAY, async () => 0);
  assert.strictEqual(r.fallback_used, false);
  assert.strictEqual(r.start, '2026-06-01');
  assert.strictEqual(r.end, '2026-06-30');
});
