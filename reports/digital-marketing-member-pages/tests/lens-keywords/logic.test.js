'use strict';

// tests/lens-keywords/logic.test.js
//
// REQ-DM-2026-08-SAJE01 — pure-logic tests. No database, no network.

const test = require('node:test');
const assert = require('node:assert');

const cfg = require('../../lib/lens-keywords/config');
const sql = require('../../lib/lens-keywords/sql');
const normalize = require('../../lib/lens-keywords/normalize');
const quota = require('../../lib/lens-keywords/quota');
const exporter = require('../../lib/lens-keywords/export');
const review = require('../../lib/lens-keywords/review');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
test('MAX_PRODUCTS_PER_RUN is the requirement-specified hard limit of 50', () => {
  assert.strictEqual(cfg.MAX_PRODUCTS_PER_RUN, 50);
});

test('one search per product — no automatic multi-engine expansion', () => {
  assert.strictEqual(cfg.SEARCHES_PER_PRODUCT, 1);
});

test('serpapiKey() only reads a known slot name, never an arbitrary string', () => {
  process.env.SERP_API_1 = 'unit-test-value';
  assert.strictEqual(cfg.serpapiKey('SERP_API_1'), 'unit-test-value');
  assert.strictEqual(cfg.serpapiKey('SOME_OTHER_ENV'), null);
  delete process.env.SERP_API_1;
});

test('configuredSlots() reflects only what is actually set', () => {
  delete process.env.SERP_API_1;
  delete process.env.SERP_API_2;
  assert.deepStrictEqual(cfg.configuredSlots(), []);
  process.env.SERP_API_1 = 'x';
  assert.deepStrictEqual(cfg.configuredSlots(), ['SERP_API_1']);
  delete process.env.SERP_API_1;
});

test('appUrl() throws a typed, staff-safe-mappable error when DILAIKSHAN_NEON_DB is missing', () => {
  const saved = process.env.DILAIKSHAN_NEON_DB;
  delete process.env.DILAIKSHAN_NEON_DB;
  assert.throws(() => cfg.appUrl(), (e) => e.code === cfg.ERRORS.APP_MISSING && e.status === 503);
  if (saved !== undefined) process.env.DILAIKSHAN_NEON_DB = saved;
});

test('ledsoneUrl() throws a typed error when DATABASE_URL is missing', () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  assert.throws(() => cfg.ledsoneUrl(), (e) => e.code === cfg.ERRORS.LEDSONE_MISSING && e.status === 503);
  if (saved !== undefined) process.env.DATABASE_URL = saved;
});

// ─────────────────────────────────────────────────────────────────────────────
// sql.classifyDataQuality — same-SKU selectability gate (governing prompt §19)
// ─────────────────────────────────────────────────────────────────────────────
test('a product with SKU and image is READY and selectable', () => {
  const r = sql.classifyDataQuality({ sku: 'ABC123', main_image_url: 'https://example.com/a.jpg' });
  assert.strictEqual(r.quality, 'READY');
  assert.strictEqual(r.selectable, true);
});

test('a parent row with no SKU is reported, never silently substituted', () => {
  const r = sql.classifyDataQuality({ sku: null, main_image_url: 'https://example.com/a.jpg' });
  assert.strictEqual(r.quality, 'MISSING_SKU');
  assert.strictEqual(r.selectable, false);
  assert.ok(r.reason);
});

test('a product missing its image is reported, never substituted from another SKU', () => {
  const r = sql.classifyDataQuality({ sku: 'ABC123', main_image_url: null });
  assert.strictEqual(r.quality, 'MISSING_IMAGE');
  assert.strictEqual(r.selectable, false);
});

test('a product missing both is reported as such', () => {
  const r = sql.classifyDataQuality({ sku: '', main_image_url: '' });
  assert.strictEqual(r.quality, 'MISSING_SKU_AND_IMAGE');
  assert.strictEqual(r.selectable, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// normalize.js — never fabricate DOM fields SerpAPI did not return
// ─────────────────────────────────────────────────────────────────────────────
test('normalizeMatch maps only genuinely-returned fields', () => {
  const m = { position: 1, title: 'Bird Cage Pendant Lamp', link: 'https://rival.example/p/1', source: 'rival.example', thumbnail: 'https://rival.example/thumb.jpg' };
  const out = normalize.normalizeMatch(m);
  assert.strictEqual(out.rank, 1);
  assert.strictEqual(out.h3_heading, 'Bird Cage Pendant Lamp');
  assert.strictEqual(out.title, 'Bird Cage Pendant Lamp');
  assert.strictEqual(out.url, 'https://rival.example/p/1');
  assert.strictEqual(out.cite, 'rival.example');
  assert.strictEqual(out.source_name, 'rival.example');
  assert.strictEqual(out.image_src, 'https://rival.example/thumb.jpg');
  assert.strictEqual(out.displayed_domain, 'rival.example');
});

test('normalizeMatch NEVER fakes image_alt, emphasized_text or aria_label', () => {
  const out = normalize.normalizeMatch({ position: 1, title: 'x', link: 'https://a.example', source: 'a.example' });
  assert.strictEqual(out.image_alt, null);
  assert.strictEqual(out.emphasized_text, null);
  assert.strictEqual(out.aria_label, null);
});

test('normalizeMatch falls back to image.link only when thumbnail is absent', () => {
  const out = normalize.normalizeMatch({ position: 1, image: { link: 'https://a.example/full.jpg' } });
  assert.strictEqual(out.image_src, 'https://a.example/full.jpg');
});

test('safePayload never carries fields outside the allowlist', () => {
  const p = normalize.safePayload({ position: 1, title: 't', evil_field: 'secret', api_key: 'shhh' });
  assert.ok(!('evil_field' in p));
  assert.ok(!('api_key' in p));
  assert.strictEqual(p.position, 1);
});

test('self-result detection matches the exact source product URL (canonicalised)', () => {
  const results = [
    { url: 'https://ledsone.co.uk/products/bird-cage-pendant?utm_source=x', title: 'Bird Cage Pendant' },
    { url: 'https://rival.example/products/bird-cage-pendant', title: 'Bird Cage Pendant' },
  ];
  const marked = normalize.markSelfAndDuplicates(results, 'https://ledsone.co.uk/products/bird-cage-pendant');
  assert.strictEqual(marked[0].is_self_result, true);
  assert.strictEqual(marked[1].is_self_result, false);
});

test('duplicate detection matches same canonical URL + title, never a different merchant', () => {
  const results = [
    { url: 'https://rival.example/p/1', title: 'Bird Cage Pendant' },
    { url: 'https://rival.example/p/1?ref=abc', title: 'Bird Cage Pendant' }, // same page, tracking param
    { url: 'https://other.example/p/1', title: 'Bird Cage Pendant' }, // different merchant
  ];
  const marked = normalize.markSelfAndDuplicates(results, null);
  assert.strictEqual(marked[0].is_duplicate, false);
  assert.strictEqual(marked[1].is_duplicate, true, 'same canonical URL + title is a technical duplicate');
  assert.strictEqual(marked[2].is_duplicate, false, 'a different merchant/offer must never be auto-removed');
});

// ─────────────────────────────────────────────────────────────────────────────
// quota.js — key-slot selection (pure logic; no network)
// ─────────────────────────────────────────────────────────────────────────────
test('selectStartingSlot prefers the slot with the strongest remaining balance', () => {
  const statuses = [
    { key_slot: 'SERP_API_1', configured: true, reachable: true, total_searches_left: 40 },
    { key_slot: 'SERP_API_2', configured: true, reachable: true, total_searches_left: 120 },
  ];
  assert.strictEqual(quota.selectStartingSlot(statuses), 'SERP_API_2');
});

test('selectStartingSlot skips unreachable or errored slots', () => {
  const statuses = [
    { key_slot: 'SERP_API_1', configured: true, reachable: false, total_searches_left: null, error_safe: 'down' },
    { key_slot: 'SERP_API_2', configured: true, reachable: true, total_searches_left: 5 },
  ];
  assert.strictEqual(quota.selectStartingSlot(statuses), 'SERP_API_2');
});

test('selectStartingSlot returns null when nothing is usable', () => {
  assert.strictEqual(quota.selectStartingSlot([]), null);
  assert.strictEqual(quota.selectStartingSlot([{ key_slot: 'SERP_API_1', configured: false }]), null);
});

test('otherSlot returns the sibling slot, or null for an unknown slot', () => {
  assert.strictEqual(quota.otherSlot('SERP_API_1'), 'SERP_API_2');
  assert.strictEqual(quota.otherSlot('SERP_API_2'), 'SERP_API_1');
});

test('totalUsableCredits sums only reachable, error-free, configured slots', () => {
  const statuses = [
    { key_slot: 'SERP_API_1', configured: true, reachable: true, total_searches_left: 10 },
    { key_slot: 'SERP_API_2', configured: true, reachable: false, total_searches_left: 999, error_safe: 'down' },
  ];
  assert.strictEqual(quota.totalUsableCredits(statuses), 10);
});

test('the Account API safe-field allowlist never includes api_key or account_email', () => {
  assert.ok(!quota.SAFE_FIELDS.includes('api_key'));
  assert.ok(!quota.SAFE_FIELDS.includes('account_email'));
  assert.ok(!quota.SAFE_FIELDS.includes('account_id'));
});

// ─────────────────────────────────────────────────────────────────────────────
// export.js — CSV, formula-injection guard (copied convention from lib/stpm)
// ─────────────────────────────────────────────────────────────────────────────
test('a value starting with = + - or @ is guarded against formula injection', () => {
  assert.strictEqual(exporter.csvCell('=cmd|/c calc'), "'=cmd|/c calc");
  assert.strictEqual(exporter.csvCell('+1'), "'+1");
  assert.strictEqual(exporter.csvCell('-1'), "'-1");
  assert.strictEqual(exporter.csvCell('@x'), "'@x");
});

// ─────────────────────────────────────────────────────────────────────────────
// review.js — validation happens before any database call
// ─────────────────────────────────────────────────────────────────────────────
test('setReview rejects an invalid result id without calling the repository', async () => {
  await assert.rejects(
    () => review.setReview({ competitor_result_id: 0, review_status: 'INCLUDED', reviewed_by: 'sajeepan' }),
    (e) => e.code === 'LENS_INVALID_RESULT_ID' && e.status === 400
  );
});

test('setReview rejects any status outside NEEDS_REVIEW / INCLUDED / EXCLUDED', async () => {
  await assert.rejects(
    () => review.setReview({ competitor_result_id: 5, review_status: 'APPROVED', reviewed_by: 'sajeepan' }),
    (e) => e.code === 'LENS_INVALID_REVIEW_STATUS'
  );
});

test('CSV export includes every field from the requirement (§26/§29)', () => {
  const file = exporter.build('11111111-1111-1111-1111-111111111111', [{
    sku: 'ABC', product_title_snapshot: 'T', image_url_snapshot: 'I', rank: 1,
    review_status: 'INCLUDED', image_src: 'S', image_alt: null, url: 'U',
    h3_heading: 'H', cite: 'C', emphasized_text: null, aria_label: null,
    provider: 'SERPAPI', observed_at: new Date().toISOString(),
  }]);
  for (const h of ['Image Src', 'Image Alt', 'URL', 'H3 Heading', 'Cite', 'Emphasized Text', 'Aria Label']) {
    assert.ok(file.body.includes(h), `CSV header must include ${h}`);
  }
  assert.strictEqual(file.contentType, 'text/csv; charset=utf-8');
});
