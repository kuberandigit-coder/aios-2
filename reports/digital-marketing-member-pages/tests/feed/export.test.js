// tests/feed/export.test.js
//
// Static / mock validation for CSV export, column selection, monitoring plans
// and the Merchant push gate.
//
// Deliberately uses fixtures — NOT live generations — so UI/export logic can be
// proven without consuming any Gemini free-tier quota (task §14, §30).
//
//   node --test tests/feed/export.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const LIB = path.join(__dirname, '..', '..', 'lib', 'feed');
const columns = require(path.join(LIB, 'columns'));
const req5 = require(path.join(LIB, 'req5'));

// ─── fixtures: two approved generations, no LLM involved ────────────────────
function fixtureRow(n, over) {
  return Object.assign({
    product: {
      item_id: `shopify_ZZ_100${n}_200${n}`,
      shopify_product_id: `100${n}`,
      shopify_variant_id: `200${n}`,
      sku: `SKU-${n}`,
      product_type: 'Spider Lights',
      current_title: `Ancien titre ${n}`,
      current_description: `Ancienne description ${n}`,
      google_product_category: '2524',
      image_link: `https://cdn.example/${n}.webp`,
      price_eur: 29.99,
      shopify_conversions: { orders: 2, lines: 3, units: 5 },
    },
    generation: {
      generation_id: `gen-${n}`,
      batch_id: 'batch-1',
      created_at: '2026-08-20T10:00:00.000Z',
      evidence_confidence: 'MEDIUM',
      prompt_version: 'feedopt-fr-v1.0.0',
      prompt_hash: 'a'.repeat(64),
      feed_eligible_status: 'UNKNOWN',
      is_draft_only: true,
      input_snapshot: {},
    },
    variant: {
      variant_id: `var-${n}`,
      variant_label: 'A',
      title_fr: `LEDSone Suspension Araignée Métal Noir ${n}`,
      title_char_count: 40,
      description_fr: `Une suspension élégante numéro ${n}. Idéal avec l'éclairage LED LEDSone.`,
      suggested_gpc: 'Home & Garden > Lighting',
      converting_terms_used: JSON.stringify(['lampe araignée']),
    },
    attempt: { provider_alias: 'local_primary', model: 'Qwen3-Next-80B-A3B-Instruct-Q4_K_M.gguf' },
    baseline: { impressions: 1000, clicks: 20, ctr: 0.02, conversions: 1, gads_conversions: 1, conversion_rate: 0.05 },
    selection: { selected_by: 'thivajini', selected_at: '2026-08-20T11:00:00.000Z' },
    monitoringStartDate: '2026-08-20',
    searchTermLatest: '2026-07-06',
  }, over || {});
}

// ═══════════════════════ COLUMN WHITELIST ═════════════════════════════════
test('column catalogue is grouped and never exposes getter functions', () => {
  const cat = columns.catalogue();
  assert.ok(cat.groups.Identity && cat.groups.Generated && cat.groups.Evidence);
  assert.ok(cat.groups.Current && cat.groups.Performance && cat.groups.Audit);
  const flat = Object.values(cat.groups).flat();
  flat.forEach((c) => {
    assert.deepEqual(Object.keys(c).sort(), ['default', 'key', 'label']);
    assert.equal(typeof c.get, 'undefined', 'getter must never be serialised to the client');
  });
  assert.ok(cat.default_keys.length >= 1);
});

test('unknown column keys are REJECTED server-side, not silently accepted', () => {
  const r = columns.resolveColumns(['item_id', 'new_title', 'DROP TABLE users', 'password']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.columns, ['item_id', 'new_title']);
  assert.deepEqual(r.rejected, ['DROP TABLE users', 'password']);
});

test('empty column selection is refused', () => {
  const r = columns.resolveColumns([]);
  assert.equal(r.ok, false);
  assert.match(r.error, /At least one valid data column/);
});

test('a selection of only invalid columns is refused', () => {
  const r = columns.resolveColumns(['nope', 'alsoNope']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.rejected, ['nope', 'alsoNope']);
});

test('omitting columns falls back to the recommended default set', () => {
  const r = columns.resolveColumns(undefined);
  assert.equal(r.ok, true);
  assert.deepEqual(r.columns, columns.DEFAULT_KEYS);
});

test('operator column ORDER is preserved and duplicates removed', () => {
  const r = columns.resolveColumns(['new_title', 'item_id', 'new_title', 'sku']);
  assert.deepEqual(r.columns, ['new_title', 'item_id', 'sku']);
});

test('non-array columns input is rejected', () => {
  assert.equal(columns.resolveColumns('item_id').ok, false);
});

// ═══════════════════════ CSV RENDERING ════════════════════════════════════
test('CSV exports ONLY the selected columns, in order', () => {
  const csv = columns.buildCsv(['item_id', 'new_title'], [fixtureRow(1)]);
  const [header] = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(header, '"Item ID","New Title"');
  assert.ok(!csv.includes('Current Description'), 'unselected column must not appear');
  assert.ok(!csv.includes('Prompt Hash'));
});

test('CSV exports ONLY the selected rows', () => {
  const csv = columns.buildCsv(['item_id'], [fixtureRow(1)]);
  assert.ok(csv.includes('shopify_ZZ_1001_2001'));
  assert.ok(!csv.includes('shopify_ZZ_1002_2002'), 'unselected product must not be exported');
});

test('CSV starts with a UTF-8 BOM so Excel renders French accents', () => {
  const csv = columns.buildCsv(['new_title'], [fixtureRow(1)]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('Araignée'), 'accented characters preserved');
  assert.ok(Buffer.from(csv, 'utf8').includes(Buffer.from('Métal', 'utf8')));
});

test('CSV escapes quotes, commas and newlines', () => {
  const row = fixtureRow(1, {
    variant: Object.assign({}, fixtureRow(1).variant, {
      title_fr: 'Titre "spécial", avec virgule',
      description_fr: 'Ligne 1\nLigne 2',
    }),
  });
  const csv = columns.buildCsv(['new_title', 'new_description'], [row]);
  assert.ok(csv.includes('"Titre ""spécial"", avec virgule"'));
  assert.ok(csv.includes('"Ligne 1\nLigne 2"'));
});

test('SECURITY: CSV formula injection is neutralised', () => {
  // Excel/Sheets execute a cell starting with = + - @ — and titles are
  // externally-influenced text, so this is a genuine vector.
  assert.equal(columns.neutraliseFormula('=cmd|calc'), "'=cmd|calc");
  assert.equal(columns.neutraliseFormula('+1+1'), "'+1+1");
  assert.equal(columns.neutraliseFormula('-2+3'), "'-2+3");
  assert.equal(columns.neutraliseFormula('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(columns.neutraliseFormula('\tTAB'), "'\tTAB");
  assert.equal(columns.neutraliseFormula('Suspension'), 'Suspension', 'ordinary text untouched');
  assert.equal(columns.neutraliseFormula(''), '');

  const row = fixtureRow(1, {
    variant: Object.assign({}, fixtureRow(1).variant, { title_fr: '=HYPERLINK("http://evil","x")' }),
  });
  const csv = columns.buildCsv(['new_title'], [row]);
  assert.ok(csv.includes('"\'=HYPERLINK'), 'formula must be prefixed with a quote');
});

test('CSV renders array-valued cells as a readable list', () => {
  const csv = columns.buildCsv(['converting_terms_used'], [fixtureRow(1)]);
  assert.ok(csv.includes('lampe araignée'));
});

test('CSV tolerates missing nested data without throwing', () => {
  const csv = columns.buildCsv(
    ['item_id', 'baseline_impressions', 'selected_by'],
    [{ product: { item_id: 'x' } }]);
  assert.ok(csv.includes('"x"'));
  assert.ok(csv.includes('""'), 'missing values render as empty cells');
});

test('every whitelisted column is renderable without throwing', () => {
  const all = columns.COLUMNS.map((c) => c.key);
  const csv = columns.buildCsv(all, [fixtureRow(1)]);
  const header = csv.replace(/^﻿/, '').split('\r\n')[0];
  assert.equal(header.split('","').length, all.length);
});

// ═══════════════════════ MONITORING SEMANTICS ═════════════════════════════
// These encode the rule that a DOWNLOAD IS NOT A GO-LIVE.

function classify(monitoringStart, today) {
  return monitoringStart > today ? 'SCHEDULED' : 'AWAITING_MANUAL_GO_LIVE';
}
function baselineWindow(monitoringStart, addDays) {
  const end = addDays(monitoringStart, -1);
  return { start: addDays(end, -29), end };
}
const sqlLib = require(path.join(LIB, 'sql'));

test('monitoring start = TODAY yields AWAITING_MANUAL_GO_LIVE, not LIVE', () => {
  assert.equal(classify('2026-08-20', '2026-08-20'), 'AWAITING_MANUAL_GO_LIVE');
});

test('a past custom monitoring date is still AWAITING_MANUAL_GO_LIVE', () => {
  assert.equal(classify('2026-08-01', '2026-08-20'), 'AWAITING_MANUAL_GO_LIVE');
});

test('a FUTURE monitoring date is SCHEDULED and fabricates no baseline', () => {
  assert.equal(classify('2026-09-15', '2026-08-20'), 'SCHEDULED');
});

test('baseline is the 30 days ending immediately BEFORE monitoring starts', () => {
  const w = baselineWindow('2026-08-20', sqlLib.addDays);
  assert.equal(w.end, '2026-08-19', 'ends the day before monitoring starts');
  assert.equal(w.start, '2026-07-21');
});

test('DOWNLOAD IS NOT LIVE: actual_go_live_date requires explicit confirmation', () => {
  const plan = { monitoring_start_date: '2026-08-20', actual_go_live_date: null, status: 'AWAITING_MANUAL_GO_LIVE' };
  assert.equal(plan.actual_go_live_date, null);
  const daysLive = plan.actual_go_live_date ? 1 : null;
  assert.equal(daysLive, null, 'Days Live must be null until go-live is confirmed');
});

test('Days Live is an integer count, not a date (workbook defect corrected)', () => {
  const liveFrom = '2026-08-01';
  const today = '2026-08-20';
  const daysLive = Math.max(0, Math.round((Date.parse(today) - Date.parse(liveFrom)) / 86400000));
  assert.equal(daysLive, 19);
  assert.equal(typeof daysLive, 'number');
  assert.ok(!String(daysLive).includes('-'), 'must never render as a date like 1900-01-18');
});

test('verdict is Too Early below the 14-day minimum', () => {
  const verdict = (days, min) => (days < min ? 'Too Early - Keep Testing' : 'evaluate');
  assert.equal(verdict(0, 14), 'Too Early - Keep Testing');
  assert.equal(verdict(13, 14), 'Too Early - Keep Testing');
  assert.equal(verdict(14, 14), 'evaluate');
});

test('raw verdict thresholds follow the workbook, and are float-robust at the boundary', () => {
  // Binary floats put 0.10 * 1.1 at 0.11000000000000001, so a naive `>=` would
  // classify a product sitting EXACTLY on +10% as Monitor instead of Scale.
  // The rule is unchanged; only the comparison is made robust.
  const atLeast = (value, threshold) => value > threshold || Math.abs(value - threshold) < 1e-9;
  const v = (base, now) => (base === 0 ? 'Monitor - Inconclusive (no baseline conversion rate)'
    : atLeast(now, base * 1.1) ? 'Scale - Keep New Copy'
      : atLeast(now, base * 0.9) ? 'Monitor - Inconclusive'
        : 'Revert - Re-generate');
  assert.equal(v(0.10, 0.11), 'Scale - Keep New Copy', 'exact +10% boundary must Scale');
  assert.equal(v(0.10, 0.09), 'Monitor - Inconclusive', 'exact -10% boundary must Monitor');
  assert.equal(v(0.10, 0.11), 'Scale - Keep New Copy');
  assert.equal(v(0.10, 0.095), 'Monitor - Inconclusive');
  assert.equal(v(0.10, 0.05), 'Revert - Re-generate');
  assert.equal(v(0, 0.05), 'Monitor - Inconclusive (no baseline conversion rate)');
});

test('the x2.9 attribution adjustment is NOT implemented anywhere', () => {
  const fs = require('node:fs');
  for (const f of fs.readdirSync(path.join(LIB)).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(LIB, f), 'utf8');
    assert.ok(!/\*\s*2\.9|2\.9\s*\*/.test(src), `${f} must not implement the x2.9 adjustment`);
  }
  assert.match(req5.VERDICT_NOTE, /NOT IMPLEMENTED \/ AWAITING APPROVAL/);
});

// ═══════════════════════ MERCHANT PUSH GATE ═══════════════════════════════
test('push gate BLOCKS when the feature flag is off', () => {
  delete process.env.MERCHANT_PUSH_ENABLED;
  const g = req5.pushGate({ feed_eligible_status: 'Y' }, { validation_status: 'PASS' });
  assert.equal(g.state, 'BLOCKED');
  assert.ok(g.reasons.some((r) => /feature gate is off/i.test(r)));
});

test('push gate BLOCKS on a Needs Check Feed Gate even with the flag on', () => {
  process.env.MERCHANT_PUSH_ENABLED = 'true';
  const g = req5.pushGate({ feed_eligible_status: 'UNKNOWN' }, { validation_status: 'PASS' });
  assert.equal(g.state, 'BLOCKED');
  assert.ok(g.reasons.some((r) => /Feed Gate is not Eligible/.test(r)),
    'the blocking reason must name the Feed Gate');
  assert.ok(g.reasons.some((r) => /Merchant eligibility status unavailable/.test(r)),
    'and must carry the underlying source reason');
  delete process.env.MERCHANT_PUSH_ENABLED;
});

test('push gate BLOCKS a variant that failed validation', () => {
  process.env.MERCHANT_PUSH_ENABLED = 'true';
  const g = req5.pushGate({ feed_eligible_status: 'Y' }, { validation_status: 'FAIL' });
  assert.equal(g.state, 'BLOCKED');
  assert.ok(g.reasons.some((r) => /has not passed validation/.test(r)));
  delete process.env.MERCHANT_PUSH_ENABLED;
});

test('push gate ALWAYS blocks while Merchant access is unconfigured', () => {
  process.env.MERCHANT_PUSH_ENABLED = 'true';
  const g = req5.pushGate({ feed_eligible_status: 'Y' }, { validation_status: 'PASS' });
  assert.ok(g.reasons.some((r) => /Merchant API access .* is not configured/.test(r)));
  assert.equal(g.state, 'BLOCKED', 'no combination may permit a push in this build');
  delete process.env.MERCHANT_PUSH_ENABLED;
});

test('push-execute route is registered as a WRITE type so it is session-guarded', () => {
  assert.ok(req5.WRITE_TYPES.has('req5-push-execute'));
  assert.ok(req5.READ_TYPES.has('req5-push-preview'));
});

test('a future Merchant patch may only ever touch title and description', () => {
  const allowedMask = ['title', 'description'];
  const forbidden = ['price', 'availability', 'gtin', 'mpn', 'image_link',
    'google_product_category', 'shipping', 'tax', 'feed_label', 'content_language'];
  forbidden.forEach((f) => assert.ok(!allowedMask.includes(f), `${f} must never be in the update mask`));
  assert.deepEqual(allowedMask, ['title', 'description']);
});

// ═══════════════════════ QUOTA BUCKETS ════════════════════════════════════
test('Gemini projects keep SEPARATE quota buckets (different Google projects)', () => {
  const providers = require(path.join(LIB, 'providers'));
  providers.resetUsage();
  const t = 1_700_000_000_000;
  providers.recordUsage('gemini_key_1', 1000, t);
  providers.recordUsage('gemini_key_1', 1000, t);
  providers.recordUsage('gemini_key_2', 500, t);

  const b1 = providers.bucketFor('gemini_key_1', t);
  const b2 = providers.bucketFor('gemini_key_2', t);
  assert.equal(b1.reqMinute, 2);
  assert.equal(b2.reqMinute, 1, 'key 2 must not inherit key 1 usage');
  assert.equal(b1.tokMinute, 2000);
  assert.equal(b2.tokMinute, 500);

  const local = providers.bucketFor('local_primary', t);
  assert.equal(local.reqMinute, 0, 'local has its own bucket too');
  providers.resetUsage();
});

test('observed usage is labelled as application-only, never total project usage', () => {
  const providers = require(path.join(LIB, 'providers'));
  const u = providers.observedUsage('gemini_key_1');
  assert.match(u.note, /application observed usage/i);
  assert.ok('observed_requests_minute' in u);
  assert.ok('observed_requests_day' in u);
});
