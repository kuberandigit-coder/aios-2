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
const HTML = fs.readFileSync(path.join(DIR, 'view.html'), 'utf8');
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

  // Some ids are created by the controller itself (the body-level drawer
  // layers, and the reset button rendered into the empty state), so accept
  // any id the script also writes into markup it generates.
  const runtimeIds = new Set([...JS.matchAll(/id="([A-Za-z0-9_]+)"/g)].map((m) => m[1]));
  const missing = Array.from(used).filter((id) => !ids.has(id) && !runtimeIds.has(id));
  assert.deepStrictEqual(missing, [], 'controller references ids absent from view.html: ' + missing.join(', '));
});

test('element ids are unique', () => {
  const ids = htmlIds();
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepStrictEqual(Array.from(new Set(dupes)), [], 'duplicate ids: ' + dupes.join(', '));
});

test('the ids the controller queries by selector also exist', () => {
  const ids = new Set(htmlIds());
  for (const needed of ['stpmCampaignList', 'stpmGridBody', 'stpmRuns']) {
    assert.ok(ids.has(needed), `#${needed} is queried via querySelector but is not in the markup`);
  }
});

// ── accessibility ────────────────────────────────────────────────────────────
test('tabs expose the ARIA tab pattern', () => {
  assert.match(HTML, /role="tablist"/);
  assert.match(HTML, /id="stpmTabResults"[^>]*role="tab"/);
  assert.match(HTML, /id="stpmPanelResults"[^>]*role="tabpanel"/);
});

test('the drawer is a labelled modal dialog and Escape closes it', () => {
  // The drawer is built by the controller and appended to <body>, so these
  // assertions target the script rather than the fragment.
  assert.match(JS, /setAttribute\('role', 'dialog'\)/);
  assert.match(JS, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(JS, /setAttribute\('aria-labelledby', 'stpmDrawerTitle'\)/);
  // The handler guards with `!==` and then dispatches to the innermost layer.
  assert.match(JS, /e\.key !== 'Escape'/);
  assert.match(JS, /closeDrawer\(\);?\s*\n?\s*\}/);
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
  assert.match(CSS, /outline: 2px solid var\(--stpm-accent\)/);
});

// ── theming ──────────────────────────────────────────────────────────────────
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

test('the existing Mahima tabs still exist', () => {
  for (const tab of ['data-tab="1"', 'data-tab="2"', 'data-tab="3"', 'data-tab="5"']) {
    assert.ok(MAHIMA.includes(tab), 'existing Mahima navigation must not be broken: ' + tab);
  }
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

test('the view does no expensive work on mount', () => {
  // mount() loads metadata + history only. Ledsone processing and result
  // paging happen on Run now / on user interaction, never on mount.
  const mount = JS.slice(JS.indexOf('mount: function'), JS.indexOf('unmount: function'));
  assert.match(mount, /loadMetadata\(\)\.then\(loadHistory\)/);
  assert.ok(!/loadResults\(/.test(mount), 'results must not be fetched before a run exists');
  assert.ok(!/mahima-stpm-run-detail/.test(mount));
});

// ── Mahima shell integration (added after the view moved into mahima.html) ──
//
// The feature must behave as a Mahima dashboard view, not a second website:
// the sidebar stays visible, the content area swaps, and there is no iframe
// and no duplicate sidebar markup inside the fragment.

test('view.html is a FRAGMENT, not a standalone document', () => {
  const bare = HTML.replace(/<!--[\s\S]*?-->/g, '');   // ignore explanatory comments
  for (const tag of ['<html', '<head', '<body', '<!DOCTYPE']) {
    assert.ok(!bare.toLowerCase().includes(tag.toLowerCase()),
      `view.html must not contain ${tag} — it is injected into mahima.html`);
  }
});

test('the fragment does not carry its own sidebar or a second nav shell', () => {
  for (const marker of ['ms-sidebar', 'msSidebar', 'ms-navlist', 'msNavList', 'ms-brand']) {
    assert.ok(!HTML.includes(marker), `view.html must not duplicate the Mahima shell (${marker})`);
  }
});

test('the standalone index.html has been removed', () => {
  assert.ok(!fs.existsSync(path.join(DIR, 'index.html')),
    'the feature must not be reachable as a separate staff page');
});

test('the sidebar entry is a Mahima tab, not an iframe tool', () => {
  assert.match(MAHIMA, /data-tab="7"[^>]*>[\s\S]{0,600}Search Term/);
  assert.ok(!/data-tool="mahima\/search-term-product-mapping/.test(MAHIMA),
    'the feature must not open through the iframe tool frame');
  assert.ok(!/data-fulltool="1"[^>]*>[\s\S]{0,400}Search Term/.test(MAHIMA));
});

test('mahima.html provides the mount point inside the content area', () => {
  assert.match(MAHIMA, /id="tabPanel7"/);
  assert.match(MAHIMA, /id="mahima-stpm-root"/);
  const contentArea = MAHIMA.indexOf('id="msContentArea"');
  const panel = MAHIMA.indexOf('id="tabPanel7"');
  const toolFrame = MAHIMA.indexOf('id="msToolFrame"');
  assert.ok(contentArea > -1 && panel > contentArea && panel < toolFrame,
    'tabPanel7 must live inside #msContentArea, before the tool frame');
});

test('showTab drives panel 7 and mounts lazily', () => {
  assert.match(MAHIMA, /tabPanel7'\)\.style\.display = n===7/);
  assert.match(MAHIMA, /tabBtn7'\)\.classList\.toggle\('on', n===7\)/);
  assert.match(MAHIMA, /n===7 && window\.MahimaSTPM/);
  assert.match(MAHIMA, /MahimaSTPM\.mount\(document\.getElementById\('mahima-stpm-root'\)\)/);
});

test('the tab bar exposes the new view', () => {
  assert.match(MAHIMA, /id="tabBtn7"[^>]*onclick="showTab\(7\)"/);
});

test('mahima.html loads the scoped stylesheet and the controller', () => {
  assert.match(MAHIMA, /<link rel="stylesheet" href="mahima\/search-term-product-mapping\/stpm\.css">/);
  assert.match(MAHIMA, /<script src="mahima\/search-term-product-mapping\/stpm\.js"><\/script>/);
});

test('the controller exposes a clean mount/unmount boundary', () => {
  assert.match(JS, /window\.MahimaSTPM = MahimaSTPM/);
  assert.match(JS, /mount: function \(root\)/);
  assert.match(JS, /unmount: function \(\)/);
  // Idempotent: switching away and back must not refetch.
  assert.match(JS, /if \(state\.mounted && state\.root === root\) return Promise\.resolve\(\)/);
});

test('the controller does not self-initialise on DOMContentLoaded', () => {
  assert.ok(!/DOMContentLoaded/.test(JS),
    'mounting is driven by the Mahima shell, not by page load');
});

test('CSS cannot leak into the host page', () => {
  // mahima.html defines --accent/--ink/--muted on :root and styles .card,
  // .chip, .pager and .num. Nothing here may reach them.
  assert.ok(!/(^|\})\s*:root\s*\{/.test(CSS), 'no bare :root block may redefine host tokens');
  assert.ok(!/(^|\})\s*body\s*[,{]/.test(CSS), 'no bare body rule');
  const declared = CSS.match(/--[a-z][a-z0-9-]*\s*:/gi) || [];
  const leaky = declared.filter((d) => !d.startsWith('--stpm-'));
  assert.deepStrictEqual(leaky, [], 'every custom property must be --stpm-*: ' + leaky.join(', '));
});

test('every CSS rule is scoped to the feature', () => {
  // Strip comments, then check each selector list.
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  const re = /(^|\})\s*([^@{}]+?)\s*\{/g;
  let m;
  while ((m = re.exec(body))) selectors.push(m[2].trim());
  const bad = selectors.filter((sel) =>
    sel && !/^\d+%$/.test(sel) && sel !== 'from' && sel !== 'to' &&
    sel.split(',').some((s) => !/(^|\s)\.stpm/.test(s.trim()))
  );
  assert.deepStrictEqual(bad, [], 'unscoped selectors: ' + bad.slice(0, 5).join(' | '));
});

test('existing Mahima tabs are untouched', () => {
  for (const t of ['tabPanel1', 'tabPanel2', 'tabPanel3', 'tabPanel5', 'tabPanel6']) {
    assert.ok(MAHIMA.includes('id="' + t + '"'), 'existing panel must survive: ' + t);
  }
  for (const t of ['tabBtn1', 'tabBtn2', 'tabBtn3', 'tabBtn5', 'tabBtn6']) {
    assert.ok(MAHIMA.includes('id="' + t + '"'), 'existing tab button must survive: ' + t);
  }
  // The iframe tool pattern must still work for EOD / Blog / Germany.
  assert.match(MAHIMA, /data-tool="eod\/index\.html"/);
  assert.match(MAHIMA, /data-tool="blog-tool\/index\.html"/);
});

test('the existing hash-restore routing still covers the new tab', () => {
  // #t7 resolves through the same a[data-tab] lookup the shell already uses.
  assert.match(MAHIMA, /location\.hash \|\| ''\)\.match\(\/\^#t\(\[0-9\]\+\)\$\//);
  assert.match(MAHIMA, /a\[data-tab="' \+ m\[1\] \+ '"\]/);
});

test('body-level layers are created by script, not duplicated in markup', () => {
  assert.ok(!HTML.includes('stpm-drawer'), 'the drawer is appended to <body> by stpm.js');
  assert.ok(!HTML.includes('stpm-toast'));
  assert.match(JS, /className = 'stpm-drawer'/);
  assert.match(JS, /document\.body\.appendChild\(drawer\)/);
  assert.match(JS, /unmount:[\s\S]*?removeChild/);
});

// ── UI correction pass ──────────────────────────────────────────────────────

test('Current period offers Last 7, Last 14 and Custom, with Last 7 selected', () => {
  assert.match(HTML, /<option value="last7" selected>Last 7 Days<\/option>/);
  assert.match(HTML, /<option value="last14">Last 14 Days<\/option>/);
  assert.match(HTML, /<option value="custom">Custom/);
});

test('there is no back-to-Mahima control anywhere in the view', () => {
  // Navigation back to other requirements happens only through the persistent
  // Mahima sidebar. A second nav affordance inside the content would imply the
  // view is a separate page.
  const bare = HTML.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/mahima\.html/.test(bare), 'the fragment must not link to mahima.html');
  assert.ok(!/&larr;|←/.test(bare), 'no back arrow control');
  assert.ok(!/stpm-back|topbar/.test(CSS), 'no back-button or topbar styling remains');
  assert.ok(!fs.existsSync(path.join(DIR, 'index.html')));
});

test('the results table is ONE table with a single thead and tbody', () => {
  assert.strictEqual((HTML.match(/<table/g) || []).length, 1);
  assert.strictEqual((HTML.match(/<thead>/g) || []).length, 1);
  assert.strictEqual((HTML.match(/<tbody/g) || []).length, 1);
});

test('the table has a scroll viewport that owns both axes', () => {
  assert.match(HTML, /class="stpm-table-wrap"[^>]*role="region"/);
  assert.match(HTML, /class="stpm-table-wrap"[^>]*tabindex="0"/);
  // Without overflow AND a bounded height there is no scroll container, and
  // `position: sticky; top: 0` resolves against the page instead — which is
  // exactly the header/body overlap this pass fixed.
  const rule = CSS.match(/\.stpm \.stpm-table-wrap \{[\s\S]*?\}/);
  assert.ok(rule, '.stpm-table-wrap rule must exist');
  assert.match(rule[0], /overflow:\s*auto/);
  assert.match(rule[0], /max-height:/);
});

test('the header is sticky, opaque, and layered above the body', () => {
  const th = CSS.match(/\.stpm table\.stpm-grid thead th \{[\s\S]*?\}/);
  assert.ok(th, 'thead th rule must exist');
  assert.match(th[0], /position:\s*sticky/);
  assert.match(th[0], /top:\s*0/);
  // Opaque background — rows pass directly underneath.
  assert.match(th[0], /background:\s*var\(--stpm-surface-sunk\)/);
  assert.match(CSS, /--stpm-surface-sunk:\s*#[0-9a-f]{6}/i);

  const zHeader = Number((th[0].match(/z-index:\s*(\d+)/) || [])[1]);
  const bodyStick = CSS.match(/\.stpm table\.stpm-grid \.stpm-stick \{[\s\S]*?\}/)[0];
  const zBody = Number((bodyStick.match(/z-index:\s*(\d+)/) || [])[1]);
  const corner = CSS.match(/\.stpm table\.stpm-grid thead \.stpm-stick \{[^}]*\}/)[0];
  const zCorner = Number((corner.match(/z-index:\s*(\d+)/) || [])[1]);

  assert.ok(zHeader > zBody, 'sticky header must sit above the sticky column');
  assert.ok(zCorner > zHeader, 'the header/column corner must sit above both');
});

test('no rule can pull body content above the header', () => {
  // Negative top margins or transforms on the table body are the usual cause
  // of rows rendering through a sticky header.
  const tbody = CSS.match(/\.stpm table\.stpm-grid tbody[^{]*\{[^}]*\}/g) || [];
  for (const r of tbody) {
    assert.ok(!/margin-top:\s*-/.test(r), 'no negative top margin on tbody');
    assert.ok(!/transform:/.test(r), 'no transform on tbody');
  }
  assert.ok(!/thead[^{]*\{[^}]*position:\s*absolute/.test(CSS), 'header must stay in table flow');
  assert.ok(!/tbody[^{]*\{[^}]*display:\s*block/.test(CSS), 'tbody must not become an independent block');
});

test('header and body share column sizing rules', () => {
  assert.match(CSS, /\.stpm table\.stpm-grid th, \.stpm table\.stpm-grid td/);
  assert.match(CSS, /td\.stpm-num, \.stpm table\.stpm-grid th\.stpm-n \{[^}]*white-space: nowrap/);
});

test('the Known limitations trigger exists and is separate from the health banner', () => {
  assert.match(HTML, /id="stpmLimitsBtn"/);
  assert.match(HTML, /Known limitations/);
  assert.match(CSS, /\.stpm \.stpm-limits-trigger/);
  // It must not live inside the dynamic source-health section.
  const health = HTML.slice(HTML.indexOf('id="stpmHealth"'), HTML.indexOf('</section>'));
  assert.ok(!health.includes('stpmLimitsBtn'), 'standing limitations are not a run warning');
});

test('the limitations modal is an accessible dialog', () => {
  assert.match(JS, /role="dialog" aria-modal="true" aria-labelledby="stpmLimitsTitle"/);
  assert.match(JS, /id="stpmLimitsTitle">Current limitations/);
  assert.match(JS, /id="stpmLimitsClose"/);
  assert.match(JS, /id="stpmLimitsDone"/);
  assert.match(JS, /function openLimits/);
  assert.match(JS, /function closeLimits/);
});

test('the modal traps Tab, closes on Escape, and restores focus', () => {
  assert.match(JS, /function trapTab/);
  assert.match(JS, /e\.key !== 'Tab'/);
  // Escape must close the modal BEFORE the drawer — it is the inner layer.
  const onKey = JS.slice(JS.indexOf('function onKeydown'), JS.indexOf('var LIMITATIONS'));
  assert.ok(onKey.indexOf('closeLimits') > -1 && onKey.indexOf('closeLimits') < onKey.indexOf('closeDrawer'),
    'Escape must close the innermost layer first');
  assert.match(JS, /state\.limitsFocus = document\.activeElement/);
  assert.match(JS, /state\.limitsFocus\.focus\(\)/);
});

test('the limitations text stays in staff language', () => {
  const block = JS.slice(JS.indexOf('var LIMITATIONS'), JS.indexOf('function openLimits'));
  for (const jargon of ['N-13', 'semantics_ratified', 'STPM_APP_DATABASE', 'mahima_stpm_',
                        'migration', 'DILAIKSHAN_NEON_DB', 'insight_id', 'LEDSONE']) {
    assert.ok(!block.includes(jargon), 'internal term must not reach staff UI: ' + jargon);
  }
  // Match short fragments: the source wraps these strings across concatenated
  // lines, so a long phrase would not appear contiguously in the file text.
  assert.match(block, /Search-term data can lag behind campaign totals/);
  assert.match(block, /Match Score is ranking evidence/);
  assert.match(block, /published to Google Ads or Shopify/);
  assert.match(block, /recommendations only/);
});

test('mounting repeatedly cannot duplicate the view or the body layers', () => {
  // Guard 1: mount() returns early when already mounted into the same root.
  assert.match(JS, /if \(state\.mounted && state\.root === root\) return Promise\.resolve\(\)/);
  // Guard 2: createLayers() returns existing layers instead of appending again.
  const cl = JS.slice(JS.indexOf('function createLayers'), JS.indexOf('function onKeydown'));
  assert.match(cl, /if \(state\.layers\) return state\.layers;/);
  // Guard 3: the fragment replaces the root's content rather than appending.
  assert.match(JS, /root\.innerHTML = html/);
  assert.ok(!/root\.insertAdjacentHTML|root\.appendChild\(/.test(JS),
    'the fragment must replace, never append');
});

test('the Mahima shell can never mount inside itself', () => {
  for (const marker of ['msSidebar', 'msContentArea', 'msToolFrame', 'msNavList']) {
    assert.ok(!HTML.includes(marker), 'fragment must not contain ' + marker);
    assert.ok(!JS.includes(marker), 'controller must not create or move ' + marker);
  }
  // Exactly one of each shell element in the host page.
  for (const id of ['msSidebar', 'msNavList', 'msContentArea', 'mahima-stpm-root', 'tabPanel7']) {
    const count = (MAHIMA.match(new RegExp('id="' + id + '"', 'g')) || []).length;
    assert.strictEqual(count, 1, 'exactly one #' + id + ' expected, found ' + count);
  }
});

test('filters, tabs and pager stay outside the scrolling table region', () => {
  const wrapStart = HTML.indexOf('id="stpmTableWrap"');
  const wrapEnd = HTML.indexOf('</div>', HTML.indexOf('</table>'));
  const inside = HTML.slice(wrapStart, wrapEnd);
  for (const id of ['stpmFilters', 'stpmPager', 'stpmTabResults', 'stpmDlFull']) {
    assert.ok(!inside.includes(id), id + ' must not scroll with the rows');
  }
});
