'use strict';

// tests/lens-keywords/serpapi.test.js
//
// REQ-DM-2026-08-SAJE01 — SerpAPI provider module, with global.fetch mocked.
// No real network call and no real key is ever used.

const test = require('node:test');
const assert = require('node:assert');

const serpapi = require('../../lib/lens-keywords/serpapi');
const quota = require('../../lib/lens-keywords/quota');

function withMockFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  return Promise.resolve()
    .then(fn)
    .finally(() => { global.fetch = original; });
}

test('searchLens returns NOT_CONFIGURED without ever calling fetch when the key slot is unset', async () => {
  delete process.env.SERP_API_1;
  let fetchCalled = false;
  await withMockFetch(async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; }, async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://x.example/i.jpg', keySlot: 'SERP_API_1' });
    assert.strictEqual(attempt.status, 'NOT_CONFIGURED');
    assert.strictEqual(fetchCalled, false);
  });
});

test('searchLens rejects a missing image URL as INVALID_PARAMS without calling fetch', async () => {
  process.env.SERP_API_1 = 'unit-test-key';
  let fetchCalled = false;
  await withMockFetch(async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; }, async () => {
    const attempt = await serpapi.searchLens({ imageUrl: '', keySlot: 'SERP_API_1' });
    assert.strictEqual(attempt.status, 'INVALID_PARAMS');
    assert.strictEqual(fetchCalled, false);
  });
  delete process.env.SERP_API_1;
});

test('a successful response with visual_matches is mapped to SUCCESS', async () => {
  process.env.SERP_API_1 = 'unit-test-key';
  const requestedUrl = { value: null };
  await withMockFetch(async (url) => {
    requestedUrl.value = url;
    return {
      ok: true, status: 200,
      json: async () => ({
        search_metadata: { id: 'abc123' },
        visual_matches: [{ position: 1, title: 'Rival Product', link: 'https://rival.example/p', source: 'rival.example', thumbnail: 'https://rival.example/t.jpg' }],
      }),
    };
  }, async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://ledsone.co.uk/i.jpg', keySlot: 'SERP_API_1', country: 'ca', language: 'en' });
    assert.strictEqual(attempt.status, 'SUCCESS');
    assert.strictEqual(attempt.search_id, 'abc123');
    assert.strictEqual(attempt.visual_matches.length, 1);
  });
  assert.match(requestedUrl.value, /engine=google_lens/);
  assert.match(requestedUrl.value, /type=visual_matches/);
  assert.match(requestedUrl.value, /country=ca/);
  delete process.env.SERP_API_1;
});

test('an empty visual_matches array is NO_VISUAL_MATCHES, a legitimate business finding — not an error', async () => {
  process.env.SERP_API_1 = 'unit-test-key';
  await withMockFetch(async () => ({
    ok: true, status: 200, json: async () => ({ search_metadata: { id: 'x' }, visual_matches: [] }),
  }), async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://x.example/i.jpg', keySlot: 'SERP_API_1' });
    assert.strictEqual(attempt.status, 'NO_VISUAL_MATCHES');
  });
  delete process.env.SERP_API_1;
});

test('HTTP 429 is classified as RATE_LIMITED', async () => {
  process.env.SERP_API_1 = 'unit-test-key';
  await withMockFetch(async () => ({
    ok: false, status: 429, json: async () => ({ error: 'quota exceeded' }),
  }), async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://x.example/i.jpg', keySlot: 'SERP_API_1' });
    assert.strictEqual(attempt.status, 'RATE_LIMITED');
  });
  delete process.env.SERP_API_1;
});

test('the api_key value never appears in the returned attempt object', async () => {
  process.env.SERP_API_1 = 'super-secret-value-12345';
  await withMockFetch(async () => ({
    ok: true, status: 200, json: async () => ({ search_metadata: { id: 'x' }, visual_matches: [{ position: 1 }] }),
  }), async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://x.example/i.jpg', keySlot: 'SERP_API_1' });
    const dump = JSON.stringify(attempt);
    assert.ok(!dump.includes('super-secret-value-12345'), 'the attempt object must never carry the raw key value');
  });
  delete process.env.SERP_API_1;
});

test('a network failure is classified, not thrown, so one product cannot crash a run', async () => {
  process.env.SERP_API_1 = 'unit-test-key';
  await withMockFetch(async () => { throw new Error('fetch failed: ECONNREFUSED'); }, async () => {
    const attempt = await serpapi.searchLens({ imageUrl: 'https://x.example/i.jpg', keySlot: 'SERP_API_1' });
    assert.strictEqual(attempt.status, 'CONNECTION_FAILED');
  });
  delete process.env.SERP_API_1;
});

// ─────────────────────────────────────────────────────────────────────────────
// quota.checkAccount — never leaks the key value even on failure paths
// ─────────────────────────────────────────────────────────────────────────────
test('checkAccount never includes the key value in its result, success or failure', async () => {
  process.env.SERP_API_1 = 'super-secret-account-key';
  await withMockFetch(async () => ({
    ok: true, json: async () => ({
      api_key: 'super-secret-account-key', account_email: 'someone@example.com', account_id: 12345,
      plan_name: 'Free', searches_per_month: 100, plan_searches_left: 42, total_searches_left: 42,
      this_month_usage: 58, account_rate_limit_per_hour: 60,
    }),
  }), async () => {
    const status = await quota.checkAccount('SERP_API_1');
    const dump = JSON.stringify(status);
    assert.ok(!dump.includes('super-secret-account-key'));
    assert.ok(!dump.includes('someone@example.com'));
    assert.ok(!('api_key' in status));
    assert.ok(!('account_email' in status));
    assert.ok(!('account_id' in status));
    assert.strictEqual(status.plan_searches_left, 42);
    assert.strictEqual(status.rate_limit_per_hour, 60);
  });
  delete process.env.SERP_API_1;
});

test('checkAccount on an unconfigured slot never calls fetch', async () => {
  delete process.env.SERP_API_2;
  let called = false;
  await withMockFetch(async () => { called = true; return { ok: true, json: async () => ({}) }; }, async () => {
    const status = await quota.checkAccount('SERP_API_2');
    assert.strictEqual(status.configured, false);
    assert.strictEqual(called, false);
  });
});
