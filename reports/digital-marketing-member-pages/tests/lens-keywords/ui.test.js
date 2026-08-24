'use strict';

// tests/lens-keywords/ui.test.js
//
// REQ-DM-2026-08-SAJE01 — static verification of the browser assets.
// Same rationale as tests/stpm/ui.test.js: no browser automation is available
// in this environment, so the most common silent failure (an id the
// controller reaches for that does not exist in the markup) is caught here
// instead. NOT a substitute for opening the page.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'pages', 'sajeepan', 'google-lens-keywords');
const HTML = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(DIR, 'lens.js'), 'utf8');
const CSS = fs.readFileSync(path.join(DIR, 'lens.css'), 'utf8');
const SAJEEPAN = fs.readFileSync(path.join(ROOT, 'pages', 'sajeepan.html'), 'utf8');

function htmlIds(html) {
  const ids = new Set();
  const re = /\sid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function jsIdRefs(js) {
  const ids = new Set();
  const re = /\$\('([^']+)'\)|getElementById\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(js))) ids.add(m[1] || m[2]);
  return ids;
}

test('every id the controller reaches for exists in the markup', () => {
  const ids = htmlIds(HTML);
  const refs = jsIdRefs(JS);
  // lens.js also reaches for ids that live in the HOST page (sajeepan.html),
  // not the injected fragment — those are excluded, same as stpm's convention.
  const hostIds = htmlIds(SAJEEPAN);
  const missing = [...refs].filter((id) => !ids.has(id) && !hostIds.has(id));
  assert.deepStrictEqual(missing, [], 'lens.js references ids that do not exist in index.html or sajeepan.html');
});

test('every id in the fragment markup is unique', () => {
  const re = /\sid="([^"]+)"/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(HTML))) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepStrictEqual(dupes, []);
});

test('the requirement\'s exact evidence field list appears in the drawer fields', () => {
  for (const f of ['Image Src', 'Image Alt', 'URL', 'H3 Heading', 'Cite', 'Emphasized Text', 'Aria Label']) {
    assert.ok(JS.includes("'" + f + "'"), `evidence drawer must show ${f}`);
  }
});

test('a missing field renders as an explicit "not provided" note, never null/undefined', () => {
  assert.match(JS, /Not provided by current search provider/);
});

test('no secret or connection string is referenced in browser code', () => {
  for (const forbidden of ['SERP_API_1', 'SERP_API_2', 'DILAIKSHAN_NEON_DB', 'DATABASE_URL', 'process.env', 'postgres://', 'postgresql://', 'serpapi.com']) {
    assert.ok(!JS.includes(forbidden), `browser JS must not reference ${forbidden}`);
    assert.ok(!HTML.includes(forbidden), `page markup must not reference ${forbidden}`);
  }
});

test('the browser calls only the existing members-api endpoint, with lens-keyword actions', () => {
  assert.match(JS, /var API = '\/api\/members-api\?member=sajeepan&type='/);
  const calls = JS.match(/api\('lens-keyword-[a-z-]+'/g) || [];
  assert.ok(calls.length > 0, 'lens.js must call at least one lens-keyword-* action');
  assert.ok(calls.every((c) => c.includes('lens-keyword-')), 'every api() call site must use a lens-keyword-* action');
});

test('writes go over POST with same-origin credentials', () => {
  assert.match(JS, /credentials: 'same-origin'/);
  assert.match(JS, /method: 'POST'/);
});

test('CSS is scoped under .lens-wrap and its own custom properties, never bare element/global selectors', () => {
  assert.match(CSS, /--lens-/);
  assert.ok(!/^body\s*\{/m.test(CSS), 'must not style the host page\'s <body> directly');
  assert.ok(!/^\.card\s*\{|^\.chip\s*\{/m.test(CSS), 'must not redefine class names already used by sajeepan.html');
});

// ─────────────────────────────────────────────────────────────────────────────
// Weekly automation UI (§62). The 15-product manual-selection screen is gone;
// what must hold now is one automatic button, an inspectable product table,
// and no surviving manual gate.
// ─────────────────────────────────────────────────────────────────────────────
test('the old X / 15 selection UI is completely gone', () => {
  assert.ok(!/\/\s*15\b/.test(HTML), 'no "/ 15" label may remain in the markup');
  assert.ok(!/Selected\s*<strong/.test(HTML), 'the manual selection counter is removed');
  assert.ok(!/lensSelectedCount|lensEstSearches|lensClearSelection/.test(JS + HTML),
    'the manual selection controls are removed from both markup and controller');
  assert.match(HTML, /id="lensMaxProducts">50</, 'the stated ceiling is 50');
});

test('there is exactly ONE primary action button, and it runs the full workflow', () => {
  const primaries = HTML.match(/class="lens-btn lens-btn-primary lens-btn-lg"/g) || [];
  assert.strictEqual(primaries.length, 1, 'one and only one primary call to action');
  assert.match(HTML, /id="lensRunBtn"[^>]*>Run Automation Now</);
  assert.match(JS, /api\('lens-keyword-run-automation'/);
  assert.ok(!/Continue to Keyword Analysis|lensContinueAnalysisBtn/.test(HTML + JS),
    'the manual "continue to analysis" gate must not survive');
});

test('the run button shows every figure the requirement asks for, computed dynamically', () => {
  for (const id of ['lensPlanSelected', 'lensPlanLive', 'lensPlanCached', 'lensPlanAvailable', 'lensPlanReserve']) {
    assert.ok(HTML.includes(`id="${id}"`), `the action panel must show ${id}`);
  }
  assert.match(JS, /run_ready/, 'run-ready state comes from the server plan, not a client guess');
  assert.match(JS, /not_ready_reason/);
});

test('the All Products table carries every required column', () => {
  const columns = ['Select Status', 'Image', 'SKU', 'Current Title', 'Product URL',
    'Same-SKU Status', 'Image Status', 'Product Data Status', 'Attribute Coverage',
    'Google Ads Evidence', 'Automation Eligibility', 'Selection Score', 'Selection Reason'];
  for (const c of columns) {
    assert.ok(HTML.includes(`>${c}</th>`), `All Products table must have a ${c} column`);
  }
});

test('the tabs use the requirement\'s exact plain-language labels', () => {
  const labels = ['1. Products', '2. Competitors', '3. Phase 1 Keywords', '4. Phase 2 Expansion',
    '5. Ads &amp; Validation', '6. Title &amp; Alt Text', '7. Final Output', '8. History'];
  for (const l of labels) assert.ok(HTML.includes(`>${l}</button>`), `missing tab: ${l}`);
  assert.ok(!/Select Products|Visual Competitors|Review Results/.test(HTML),
    'the old ambiguous technical tab names must be gone');
});

test('competitor decisions are shown as automatic, with no Include/Exclude controls', () => {
  assert.ok(!/data-act="include"|data-act="exclude"/.test(JS), 'manual include/exclude buttons must be gone');
  assert.ok(!/lens-keyword-competitor-review/.test(JS), 'the browser must not call the manual review endpoint');
  assert.match(JS, /AUTO_EXCLUDED_ATTRIBUTE_CONFLICT/);
  assert.match(JS, /decision_reasons/, 'every decision must be able to show its reason');
  assert.ok(HTML.includes('>Decision</th>') && HTML.includes('>Reason</th>'));
});

test('no user-facing text asks a person to approve, review or decide anything', () => {
  for (const phrase of ['Needs Review', 'Review your competitors', 'Review Results', 'awaiting approval']) {
    assert.ok(!HTML.includes(phrase), `markup must not ask for manual review: "${phrase}"`);
  }
});

test('filters and history are pure reads that cannot trigger a provider call', () => {
  // The product filter operates on already-fetched rows — it does not refetch.
  assert.match(JS, /\$\('lensSearchBox'\)\.addEventListener\('input', renderProducts\)/);
  assert.match(JS, /\$\('lensFilterEligibility'\)\.addEventListener\('change', renderProducts\)/);
  // Opening a stored run reads its status; it never calls run-create or advance.
  const openStored = JS.slice(JS.indexOf('function openStoredRun'), JS.indexOf('function tryResume'));
  assert.ok(!/run-automation|automation-advance|run-advance|run-create/.test(openStored),
    'opening a past run must never start or advance a run');
});

test('the weekly schedule header and history table are present', () => {
  for (const id of ['lensSchedEnabled', 'lensSchedWhen', 'lensSchedLast', 'lensSchedNext',
    'lensSchedProducts', 'lensSchedStatus', 'lensSchedCache']) {
    assert.ok(HTML.includes(`id="${id}"`), `schedule header must show ${id}`);
  }
  for (const c of ['Week', 'Run ID', 'Started', 'Completed', 'Products', 'Fresh Searches',
    'Cached Searches', 'Gemma Titles', 'Script Fallback', 'Warnings', 'Status']) {
    assert.ok(HTML.includes(`>${c}</th>`), `weekly history must have a ${c} column`);
  }
  assert.match(JS, /timezone_note/, 'the UTC caveat must be surfaced, not hidden');
});

test('generation provenance is shown to the user, and never the key', () => {
  assert.match(HTML, /id="lensGenSource"/);
  assert.match(HTML, /id="lensGenValidation"/);
  assert.match(JS, /Deterministic script builder/);
  assert.ok(!/GOOGLE_API_KEY|GEMINI_API_KEY/.test(JS + HTML));
});

// ─────────────────────────────────────────────────────────────────────────────
// Readability / layout (§10) — the specific defects reported from screenshots.
// ─────────────────────────────────────────────────────────────────────────────
test('no sticky bottom bar can cover the last rows of a table', () => {
  assert.ok(!/position:\s*sticky[^}]*bottom:\s*0/.test(CSS),
    'the previous sticky run bar overlapped content on short viewports');
  assert.ok(!/lens-run-bar/.test(HTML + JS), 'the sticky run bar markup is removed');
});

test('every wide table scrolls inside its own container, so the page never scrolls sideways', () => {
  assert.match(CSS, /\.lens-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  const tables = HTML.match(/<table class="lens-table"/g) || [];
  const wrappers = HTML.match(/<div class="lens-table-scroll">/g) || [];
  assert.ok(wrappers.length >= tables.length,
    'every static table must sit inside a horizontal scroll container');
});

test('surfaces paint both their own background and their own text colour', () => {
  const panel = CSS.match(/\.lens-panel\s*\{([\s\S]*?)\}/)[1];
  assert.match(panel, /background:/);
  assert.match(panel, /color:/);
  const table = CSS.match(/\.lens-table\s*\{([\s\S]*?)\}/)[1];
  assert.match(table, /background:/);
  assert.match(table, /color:/);
});

test('there is no half-finished dark theme that recolours text but not surfaces', () => {
  const darkBlocks = CSS.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\n\}/g) || [];
  for (const b of darkBlocks) {
    assert.ok(/background/.test(b),
      'a dark block that changes only the text colour leaves unreadable white panels');
  }
});

test('badges wrap rather than clip, and headings are strong enough to read', () => {
  const pill = CSS.match(/\.lens-pill\s*\{([\s\S]*?)\}/)[1];
  assert.ok(!/(^|[^-])height:\s*\d/.test(pill), 'a fixed-height badge clips a long label');
  assert.match(pill, /white-space:\s*normal/);
  assert.match(CSS, /\.lens-panel > h3[^}]*font-weight:\s*800/);
  assert.match(CSS, /--lens-ink-strong:/);
});

test('the feature is visually separated from the dashboard rendered above it', () => {
  assert.match(HTML, /class="lens-shell"/);
  const shell = CSS.match(/\.lens-shell\s*\{([\s\S]*?)\}/)[1];
  assert.match(shell, /border/);
  assert.match(shell, /background/);
  assert.match(shell, /margin-top/);
});

test('the layout has a narrow-viewport rule so nothing overlaps on a small screen', () => {
  assert.match(CSS, /@media\s*\(max-width:\s*900px\)/);
  assert.match(CSS, /\.lens-split\s*\{[^}]*flex-wrap:\s*wrap/);
});

test('interactive controls have a visible keyboard focus state', () => {
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline:/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Host-page wiring
// ─────────────────────────────────────────────────────────────────────────────
test('sajeepan.html links the stylesheet, mounts on tab 5, and loads the script once', () => {
  assert.match(SAJEEPAN, /<link rel="stylesheet" href="sajeepan\/google-lens-keywords\/lens\.css">/);
  assert.match(SAJEEPAN, /window\.SajeepanLensKeywords\.mount\(document\.getElementById\('sajeepan-lens-root'\)\)/);
  const scriptTags = SAJEEPAN.match(/sajeepan\/google-lens-keywords\/lens\.js/g) || [];
  assert.strictEqual(scriptTags.length, 1, 'lens.js must be included exactly once');
});

test('Req1-Req4 panels and their ids are untouched', () => {
  for (const id of ['req1Panel', 'req2Panel', 'req3Panel', 'req4Panel']) {
    assert.match(SAJEEPAN, new RegExp('id="' + id + '"'));
  }
});

test('switchReqTab toggles req5Panel the same way it toggles req1-4', () => {
  assert.match(SAJEEPAN, /var r5 = document\.getElementById\('req5Panel'\); if\(r5\) r5\.style\.display = n===5\?'':'none'/);
});
