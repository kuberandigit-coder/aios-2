'use strict';

// tests/lens-keywords/analysis-logic.test.js
//
// REQ-DM-2026-08-SAJE01 — Stages 4-11 pure-logic tests. No database, no
// network.

const test = require('node:test');
const assert = require('node:assert');

const keywords = require('../../lib/lens-keywords/keywords');
const attributes = require('../../lib/lens-keywords/attributes');
const title = require('../../lib/lens-keywords/title');
const altText = require('../../lib/lens-keywords/alt-text');
const finalOutput = require('../../lib/lens-keywords/final-output');
const planner = require('../../lib/lens-keywords/keyword-planner');
const normalize = require('../../lib/lens-keywords/normalize');

// ─────────────────────────────────────────────────────────────────────────────
// keywords.js — tokenization / n-grams / DOCUMENT frequency (not occurrence)
// ─────────────────────────────────────────────────────────────────────────────
test('normalizeText strips punctuation and possessives without destroying words', () => {
  assert.strictEqual(keywords.normalizeText("Bird's Cage Pendant Lamp!"), 'bird cage pendant lamp');
});

test('extractPhrases yields unigrams, bigrams and trigrams, keeping meaningful phrases intact', () => {
  const phrases = keywords.extractPhrases('bird cage pendant lamp');
  assert.ok(phrases.includes('bird'));
  assert.ok(phrases.includes('bird cage'));
  assert.ok(phrases.includes('bird cage pendant'));
});

test('title_frequency is DISTINCT-document frequency, never raw in-title occurrence count', () => {
  // "pendant" appears twice in doc 0's own title, but that must count as ONE vote.
  const docs = [
    { text: 'Pendant Pendant Lamp Bird Cage', source_name: 'a.example', url: 'https://a.example/1' },
    { text: 'Bird Cage Pendant Light', source_name: 'b.example', url: 'https://b.example/1' },
    { text: 'Ceiling Rose Brass', source_name: 'c.example', url: 'https://c.example/1' },
  ];
  const candidates = keywords.buildCandidates(docs, {});
  const pendant = candidates.find((c) => c.term === 'pendant');
  assert.strictEqual(pendant.title_frequency, 2, 'pendant appears in 2 DISTINCT documents, not 3 occurrences');
});

test('brandTokensFromDocs detects a source-domain token repeated in the title, excluding the store\'s own brand', () => {
  const docs = [
    { text: 'RivalCo Bird Cage Pendant Lamp', source_name: 'rivalco.example', url: 'https://rivalco.example/1' },
    { text: 'LEDSone Bird Cage Pendant Lamp', source_name: 'ledsone.co.uk', url: 'https://ledsone.co.uk/1' },
  ];
  const tokens = keywords.brandTokensFromDocs(docs, 'ledsone');
  assert.ok(tokens.has('rivalco'));
  assert.ok(!tokens.has('ledsone'), 'the business\'s own brand must never be flagged');
});

test('categorize is transparent lexicon matching, not a black-box score', () => {
  assert.strictEqual(keywords.categorize('brass pendant', {}), 'Material / Finish');
  assert.strictEqual(keywords.categorize('modern industrial', {}), 'Style / Aesthetic');
  assert.strictEqual(keywords.categorize('dimmable', {}), 'Feature / Modifier');
  assert.strictEqual(keywords.categorize('pendant lamp', {}), 'Product Type');
  assert.strictEqual(keywords.categorize('30cm', {}), 'Size / Dimension');
});

test('topN excludes brand terms from the business-facing Top 10', () => {
  const candidates = [
    { term: 'rivalco', title_frequency: 9, is_brand: true },
    { term: 'pendant lamp', title_frequency: 5, is_brand: false },
  ];
  const top = keywords.topN(candidates, 10);
  assert.strictEqual(top.length, 1);
  assert.strictEqual(top[0].term, 'pendant lamp');
});

// ─────────────────────────────────────────────────────────────────────────────
// attributes.js — the five-way status vocabulary
// ─────────────────────────────────────────────────────────────────────────────
test('a factual term that agrees with the SOT is MATCHED_FACT', () => {
  const c = { term: 'brass', category: 'Material / Finish', is_brand: false };
  const r = attributes.validateOne(c, [{ key: 'material_primary', label: 'Material', value: 'Brass' }]);
  assert.strictEqual(r.status, 'MATCHED_FACT');
});

test('a factual term that disagrees with the SOT is CONFLICT', () => {
  const c = { term: 'chrome', category: 'Material / Finish', is_brand: false };
  const r = attributes.validateOne(c, [{ key: 'material_primary', label: 'Material', value: 'Brass' }]);
  assert.strictEqual(r.status, 'CONFLICT');
});

test('a factual term with no SOT row at all is UNVERIFIED_FACT, not silently allowed or rejected', () => {
  const c = { term: 'brass', category: 'Material / Finish', is_brand: false };
  const r = attributes.validateOne(c, []);
  assert.strictEqual(r.status, 'UNVERIFIED_FACT');
});

test('product-type / style / search-intent language is always NON_FACTUAL_SEARCH_TERM', () => {
  const c = { term: 'pendant lamp', category: 'Product Type', is_brand: false };
  const r = attributes.validateOne(c, []);
  assert.strictEqual(r.status, 'NON_FACTUAL_SEARCH_TERM');
});

test('a detected brand token is always BRAND_EXCLUDED, regardless of category', () => {
  const c = { term: 'rivalco', category: 'Material / Finish', is_brand: true };
  const r = attributes.validateOne(c, [{ key: 'material_primary', value: 'rivalco' }]);
  assert.strictEqual(r.status, 'BRAND_EXCLUDED');
});

// ─────────────────────────────────────────────────────────────────────────────
// title.js — 50-70 chars, no brand, no conflict
// ─────────────────────────────────────────────────────────────────────────────
test('title.build only uses MATCHED_FACT / NON_FACTUAL_SEARCH_TERM terms', () => {
  const validated = [
    { term: 'rivalco', category: 'Material / Finish', status: 'BRAND_EXCLUDED' },
    { term: 'chrome', category: 'Material / Finish', status: 'CONFLICT' },
    { term: 'brass', category: 'Material / Finish', status: 'MATCHED_FACT' },
    { term: 'pendant lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' },
    { term: 'dimmable', category: 'Feature / Modifier', status: 'MATCHED_FACT' },
  ];
  const result = title.build({ currentTitle: 'Old Title', productType: 'Pendant Lamp', validated });
  assert.ok(!/rivalco/i.test(result.suggested_title));
  assert.ok(!/chrome/i.test(result.suggested_title));
});

test('title.build flags NEEDS_REVIEW rather than padding with fabricated words', () => {
  const validated = [{ term: 'pendant', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' }];
  const result = title.build({ currentTitle: 'x', productType: null, validated });
  if (result.suggested_title && result.suggested_title.length < title.MIN_LEN) {
    assert.strictEqual(result.status, 'NEEDS_REVIEW');
  }
});

test('title.build never exceeds the 70-character maximum', () => {
  const validated = [
    { term: 'antique brushed brass copper bronze finish', category: 'Material / Finish', status: 'MATCHED_FACT' },
    { term: 'modern industrial rustic scandinavian farmhouse pendant lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' },
  ];
  const result = title.build({ currentTitle: 'x', productType: null, validated });
  assert.ok(result.suggested_title.length <= title.MAX_LEN);
});

// ─────────────────────────────────────────────────────────────────────────────
// alt-text.js
// ─────────────────────────────────────────────────────────────────────────────
test('alt-text.build never uses a CONFLICT or BRAND_EXCLUDED term', () => {
  const validated = [
    { term: 'rivalco', category: 'Material / Finish', status: 'BRAND_EXCLUDED' },
    { term: 'brass', category: 'Material / Finish', status: 'MATCHED_FACT' },
    { term: 'pendant lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' },
  ];
  const result = altText.build({ currentAltText: null, productType: null, validated });
  assert.ok(!/rivalco/i.test(result.suggested_alt_text));
});

// ─────────────────────────────────────────────────────────────────────────────
// final-output.js — dedupe + provenance, exclude UNVERIFIED_FACT
// ─────────────────────────────────────────────────────────────────────────────
test('final-output dedupes a term appearing in both Phase 1 and Phase 2', () => {
  const rows = finalOutput.build({
    phase1Validated: [{ term: 'pendant lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM', title_frequency: 5 }],
    phase2Validated: [{ term: 'Pendant Lamp', category: 'Product Type', status: 'NON_FACTUAL_SEARCH_TERM' }],
    plannerSuggestions: [], titleKeywords: [], existingAdsEvidence: {},
  });
  assert.strictEqual(rows.length, 1, 'the same normalized term from two phases must not appear twice');
});

test('final-output excludes BRAND_EXCLUDED and CONFLICT terms entirely', () => {
  const rows = finalOutput.build({
    phase1Validated: [
      { term: 'rivalco', status: 'BRAND_EXCLUDED', title_frequency: 9 },
      { term: 'chrome', status: 'CONFLICT', title_frequency: 3 },
      { term: 'brass', status: 'MATCHED_FACT', title_frequency: 4 },
    ],
    phase2Validated: [], plannerSuggestions: [], titleKeywords: [], existingAdsEvidence: {},
  });
  assert.strictEqual(rows.find((r) => r.normalized_keyword === 'rivalco'), undefined);
  assert.strictEqual(rows.find((r) => r.normalized_keyword === 'chrome'), undefined);
  assert.ok(rows.find((r) => r.normalized_keyword === 'brass'));
});

test('final-output marks UNVERIFIED_FACT terms EXCLUDED rather than silently including them', () => {
  const rows = finalOutput.build({
    phase1Validated: [{ term: 'ceramic', status: 'UNVERIFIED_FACT', title_frequency: 2 }],
    phase2Validated: [], plannerSuggestions: [], titleKeywords: [], existingAdsEvidence: {},
  });
  const row = rows.find((r) => r.normalized_keyword === 'ceramic');
  assert.strictEqual(row.final_status, 'EXCLUDED');
});

// ─────────────────────────────────────────────────────────────────────────────
// keyword-planner.js — credential gate (proven absent, 2026-08-24)
// ─────────────────────────────────────────────────────────────────────────────
test('isConfigured() is false with no Google Ads credential set (the current proven state)', () => {
  for (const v of Object.values(planner.ENV)) delete process.env[v];
  assert.strictEqual(planner.isConfigured(), false);
});

test('missingVars() lists exactly the required, absent variable NAMES — never a value', () => {
  for (const v of planner.REQUIRED) delete process.env[v];
  const missing = planner.missingVars();
  assert.deepStrictEqual(missing.sort(), planner.REQUIRED.slice().sort());
});

test('getSuggestions() returns BLOCKED_CONFIG_REQUIRED honestly when no credential is configured — never a fabricated suggestion', async () => {
  for (const v of planner.REQUIRED) delete process.env[v];
  const fakeRepo = {
    async findFreshPlannerSuggestions() { return []; },
    async savePlannerSuggestions() { /* no-op */ },
  };
  const result = await planner.getSuggestions({ repo: fakeRepo }, { seedKeyword: 'pendant lamp', country: 'ca', language: 'en' });
  assert.strictEqual(result.status, 'BLOCKED_CONFIG_REQUIRED');
  assert.strictEqual(result.suggestions.length, 0);
  assert.ok(Array.isArray(result.missing_config) && result.missing_config.length > 0);
});

test('getSuggestions() reuses a fresh cached result without calling the live API', async () => {
  const cachedRow = { seed_keyword: 'pendant lamp', matched_keyword: 'pendant lamp', status: 'FETCHED' };
  const fakeRepo = { async findFreshPlannerSuggestions() { return [cachedRow]; } };
  let apiCalled = false;
  const fakeApi = { async generateIdeasLive() { apiCalled = true; return []; } };
  const result = await planner.getSuggestions({ repo: fakeRepo, keywordPlannerApi: fakeApi }, { seedKeyword: 'pendant lamp' });
  assert.strictEqual(result.status, 'CACHED');
  assert.strictEqual(apiCalled, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// normalize.js — Phase 2 engine normalizers never fabricate fields
// ─────────────────────────────────────────────────────────────────────────────
test('normalizeOrganic maps only documented organic_results fields', () => {
  const out = normalize.normalizeOrganic({ position: 1, title: 'T', link: 'https://a.example/p', snippet: 'S', displayed_link: 'a.example/p' });
  assert.strictEqual(out.snippet, 'S');
  assert.strictEqual(out.image_src, null, 'organic results never carry an image');
});

test('normalizeImage prefers original over thumbnail for image_src', () => {
  const out = normalize.normalizeImage({ position: 1, title: 'T', link: 'https://a.example', source: 'a.example', original: 'https://a.example/full.jpg', thumbnail: 'https://a.example/thumb.jpg' });
  assert.strictEqual(out.image_src, 'https://a.example/full.jpg');
});

test('normalizeShopping never fabricates a rating/reviews value the provider did not return', () => {
  const out = normalize.normalizeShopping({ position: 1, title: 'T', product_link: 'https://a.example/p', source: 'RivalCo', price: '$19.99' });
  assert.strictEqual(out.rating, null);
  assert.strictEqual(out.reviews, null);
});
