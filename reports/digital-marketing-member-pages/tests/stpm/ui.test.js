'use strict';

// tests/stpm/ui.test.js
//
// REQ-DM-2026-08-MAHI01 — static verification of the browser assets.
//
// These are NOT a substitute for opening the page in a browser. They exist
// because no browser automation is available in this environment, and because
// the single most common failure in a hand-wired static page is silent: a
// getElementById that returns null, a listener attached to an id that was
// renamed, a stylesheet class that no markup uses. Those bugs produce a blank
// panel and no error anyone notices.
//
// What is asserted here:
//   * every element id the controller reaches for exists in the markup
//   * every id in the markup is unique
//   * the page's tags are balanced
//   * the security and architecture rules this feature must not regress
//   * the theme tokens are defined for all three viewer states

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'pages', 'mahima', 'search-term-product-mapping');
const HTML = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(DIR, 'stpm.js'), 'utf8');
const CSS = fs.readFileSync(path.join(DIR, 'stpm.css'), 'utf8');
const MAHIMA = fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'mahima.html'), 'utf8');
const ROUTER = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'stpm', 'router.js'), 'utf8');
const REQUIREMENT_JS = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'requirement.js'), 'utf8');

function htmlIds() {
  const ids = [];
  const re = /\sid="([^"]+)"/g;
  let m;
  while ((m = re.exec(HTML))) ids.push(m[1]);
  return ids;
}

// ── wiring ───────────────────────────────────────────────────────────────────
test('every element id the controller uses exists in the markup', () => {
  const ids = new Set(htmlIds());
  const used = new Set();
  const re = /\$\('([A-Za-z0-9_]+)'\)/g;
  let m;
  while ((m = re.exec(JS))) used.add(m[1]);

  const missing = Array.from(used).filter((id) => !ids.has(id));
  assert.deepStrictEqual(missing, [], 'controller references ids absent from index.html: ' + missing.join(', '));
});

test('element ids are unique', () => {
  const ids = htmlIds();
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepStrictEqual(Array.from(new Set(dupes)), [], 'duplicate ids: ' + dupes.join(', '));
});

test('the ids the controller queries by selector also exist', () => {
  const ids = new Set(htmlIds());
  for (const needed of ['campaignList', 'gridBody', 'runs', 'drawer']) {
    assert.ok(ids.has(needed), `#${needed} is queried via querySelector but is not in the markup`);
  }
});

test('HTML tags are balanced for the structural elements', () => {
  for (const tag of ['html', 'head', 'body', 'main', 'header', 'aside', 'table', 'thead', 'tbody']) {
    const open = (HTML.match(new RegExp('<' + tag + '(\\s|>)', 'g')) || []).length;
    const close = (HTML.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    assert.strictEqual(open, close, `<${tag}> opened ${open} times, closed ${close}`);
  }
});

// ── accessibility ────────────────────────────────────────────────────────────
test('tabs expose the ARIA tab pattern', () => {
  assert.match(HTML, /role="tablist"/);
  assert.match(HTML, /id="tabResults"[^>]*role="tab"/);
  assert.match(HTML, /id="panelResults"[^>]*role="tabpanel"/);
});

test('the drawer is a labelled modal dialog and Escape closes it', () => {
  assert.match(HTML, /id="drawer"[^>]*role="dialog"/);
  assert.match(HTML, /aria-modal="true"/);
  assert.match(HTML, /aria-labelledby="drawerTitle"/);
  assert.match(JS, /e\.key === 'Escape'/);
});

test('focus is returned to the trigger when the drawer closes', () => {
  assert.match(JS, /state\.lastFocus\s*=\s*document\.activeElement/);
  assert.match(JS, /state\.lastFocus\.focus\(\)/);
});

test('every form control has a label or an accessible name', () => {
  const controls = HTML.match(/<(input|select)\b[^>]*>/g) || [];
  for (const c of controls) {
    const id = (c.match(/\sid="([^"]+)"/) || [])[1];
    const hasAria = /aria-label=/.test(c);
    const hasLabel = id && new RegExp('<label[^>]*for="' + id + '"').test(HTML);
    // checkboxes in the campaign list are wrapped by their <label>
    const wrapped = /type="checkbox"/.test(c);
    assert.ok(hasAria || hasLabel || wrapped, 'control without an accessible name: ' + c.slice(0, 90));
  }
});

test('sortable headers expose aria-sort and are keyboard reachable', () => {
  assert.match(JS, /aria-sort=/);
  assert.match(JS, /tabindex="0" role="button"/);
  assert.match(JS, /e\.key === 'Enter' \|\| e\.key === ' '/);
});

test('reduced motion is respected', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
});

test('focus is always visible', () => {
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /outline: 2px solid var\(--accent\)/);
});

// ── theming ──────────────────────────────────────────────────────────────────
test('the palette is defined for all three viewer theme states', () => {
  assert.ok(CSS.includes(':root {'), 'bare :root light palette');
  assert.match(CSS, /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-theme="light"\]\)/);
  assert.ok(CSS.includes(':root[data-theme="dark"]'), 'explicit dark stamp');
});

test('body paints an explicit background token rather than inheriting', () => {
  assert.match(CSS, /body\s*\{[\s\S]*background:\s*var\(--ground\)/);
});

test('no CSS colour is left as an unparseable declaration', () => {
  // Guards against a malformed hex slipping into a token block, where the
  // browser silently drops the declaration and the theme half-applies.
  const bad = CSS.match(/--[a-z-]+:\s*#[0-9a-f]{0,5}[^0-9a-f;\s][^;]*;/gi) || [];
  assert.deepStrictEqual(bad, [], 'malformed colour declarations: ' + bad.join(' | '));
});

// ── architecture / security guarantees ───────────────────────────────────────
test('no secret or connection string is referenced in browser code', () => {
  for (const forbidden of ['DILAIKSHAN_NEON_DB', 'DATABASE_URL', 'AUTH_DATABASE_URL', 'process.env', 'postgres://', 'postgresql://']) {
    assert.ok(!JS.includes(forbidden), `browser JS must not reference ${forbidden}`);
    assert.ok(!HTML.includes(forbidden), `page markup must not reference ${forbidden}`);
  }
});

test('the browser calls only the shared requirement router', () => {
  assert.match(JS, /var API = '\/api\/requirement\?fn='/);
  // No direct call to any other api/*.js endpoint.
  const calls = JS.match(/['"]\/api\/[a-z-]+/g) || [];
  for (const c of calls) assert.strictEqual(c.replace(/['"]/, ''), '/api/requirement');
});

test('writes go over POST with same-origin credentials', () => {
  assert.match(JS, /credentials: 'same-origin'/);
  assert.match(JS, /method: 'POST'[\s\S]*mahima-stpm-review|mahima-stpm-review[\s\S]*method: 'POST'/);
});

test('the router never sets wildcard CORS', () => {
  // Checks for an actual setHeader call, not the word — the file documents the
  // rule in prose deliberately, and that documentation should not fail a test.
  assert.ok(!/setHeader\(\s*['"]Access-Control-Allow-Origin/.test(ROUTER),
    'STPM endpoints must not set a CORS header — the older mahima-search-terms handler uses "*" and must not be copied');
});

test('every STPM endpoint requires a session before doing work', () => {
  // requireStpmSession must be called before the switch that dispatches actions.
  const idxAuth = ROUTER.indexOf('requireStpmSession(req, res)');
  const idxSwitch = ROUTER.indexOf('switch (fn)');
  assert.ok(idxAuth > -1 && idxSwitch > -1 && idxAuth < idxSwitch,
    'the session guard must run before any action is dispatched');
});

test('write actions insist on POST', () => {
  assert.match(ROUTER, /case 'mahima-stpm-run':[\s\S]{0,200}requirePost/);
  assert.match(ROUTER, /case 'mahima-stpm-review':[\s\S]{0,200}requirePost/);
});

test('reviewer identity comes from the session, never the request body', () => {
  assert.match(ROUTER, /reviewer: String\(s\.username \|\| s\.staff_key\)/);
  assert.ok(!/reviewer: body\./.test(ROUTER));
});

test('STPM routes are wired into the existing requirement router, not a new function', () => {
  assert.match(REQUIREMENT_JS, /fn\.startsWith\('mahima-stpm-'\)/);
  assert.match(REQUIREMENT_JS, /require\('\.\.\/lib\/stpm\/router'\)/);
  // A new api/stpm.js would breach the 12-function Hobby ceiling.
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'api', 'stpm.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'api', 'lib')));
});

test('the existing account-wide mahima-search-terms route is untouched', () => {
  assert.match(REQUIREMENT_JS, /fn === 'mahima-search-terms'/);
});

test('lib/ is never excluded from the deployment bundle', () => {
  const ignore = fs.readFileSync(path.join(__dirname, '..', '..', '.vercelignore'), 'utf8');
  assert.ok(!/^lib\//m.test(ignore), 'lib/ must never be added to .vercelignore');
  assert.match(ignore, /^db\//m);
  assert.match(ignore, /^tests\//m);
});

test('no scheduler was introduced for STPM', () => {
  // vercel.json already carries an unrelated Sajeepan cron owned by another
  // feature. What must stay true is that STPM adds none of its own: the
  // approved run mode is Manual Run Now only, pending stakeholder confirmation.
  const vercelJson = fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8');
  assert.ok(!/stpm/i.test(vercelJson), 'STPM must not register a cron or scheduled trigger');

  const workflows = path.join(__dirname, '..', '..', '.github', 'workflows');
  if (fs.existsSync(workflows)) {
    for (const f of fs.readdirSync(workflows)) {
      const body = fs.readFileSync(path.join(workflows, f), 'utf8');
      assert.ok(!/stpm/i.test(body), `STPM must not be triggered from a workflow (${f})`);
    }
  }
});

// ── navigation ───────────────────────────────────────────────────────────────
test('the Mahima sidebar links to the feature using the existing full-tool pattern', () => {
  assert.match(MAHIMA, /mahima\/search-term-product-mapping\/index\.html/);
  assert.match(MAHIMA, /data-tool="mahima\/search-term-product-mapping\/index\.html"/);
  assert.match(MAHIMA, /data-fulltool="1"[^>]*>[\s\S]{0,400}Search Term/);
});

test('the existing Mahima tabs still exist', () => {
  for (const tab of ['data-tab="1"', 'data-tab="2"', 'data-tab="3"', 'data-tab="5"']) {
    assert.ok(MAHIMA.includes(tab), 'existing Mahima navigation must not be broken: ' + tab);
  }
});

test('the feature page links back to the Mahima dashboard', () => {
  assert.match(HTML, /href="\.\.\/\.\.\/mahima\.html"/);
});

// ── behaviour the requirement depends on ─────────────────────────────────────
test('requested and actual date ranges are both rendered', () => {
  assert.match(JS, /\['Requested',/);
  assert.match(JS, /\['Showing',/);
});

test('the fallback headline is surfaced verbatim', () => {
  // The exact approved wording lives server-side; the client must show the
  // server's title rather than inventing its own.
  assert.match(JS, /code === 'date_fallback_used'/);
  assert.match(JS, /title = fb\.title/);
});

test('the UI never claims a review succeeded before the server confirms', () => {
  const setReview = JS.slice(JS.indexOf('function setReview('));
  const thenIdx = setReview.indexOf('.then(');
  const assignIdx = setReview.indexOf('row.review_status = value');
  assert.ok(thenIdx > -1 && assignIdx > thenIdx, 'local state must only change inside the success handler');
});

test('a run is guarded against double submission', () => {
  assert.match(JS, /if \(state\.busy\) return;/);
  assert.match(JS, /idempotency_key/);
});

test('the page does no expensive work on first paint', () => {
  // The startup chain must be metadata + history only. Ledsone processing and
  // result paging happen on Run now / on user interaction — never on load.
  // (loadResults appears elsewhere in init() inside event handlers, which is
  // correct; what matters is that it is not in the startup chain.)
  const init = JS.slice(JS.indexOf('function init()'));
  const startup = init.slice(init.indexOf('loadMetadata()'));
  const chainEnd = startup.indexOf('if (document.readyState');
  const chain = chainEnd > -1 ? startup.slice(0, chainEnd) : startup;

  assert.match(chain, /loadMetadata\(\)\s*\.then\(loadHistory\)/);
  assert.ok(!/loadResults\(/.test(chain), 'results must not be fetched before a run exists');
  assert.ok(!/mahima-stpm-run-detail/.test(chain));
});
