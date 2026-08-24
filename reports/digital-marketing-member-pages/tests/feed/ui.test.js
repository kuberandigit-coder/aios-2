// tests/feed/ui.test.js
//
// REQ5 STAFF WORKFLOW — UI contract.
//
// The workspace is a small set of static files, so these tests parse them and
// assert the structural promises the requirement makes:
//   * the member dashboard carries a CARD, not the whole application
//   * the workspace shows exactly ONE view at a time (setup / running / report)
//   * staff never see "UNKNOWN", a raw field name, or a raw error code
//   * a download is not a go-live, and monitoring only starts on purpose
//
//   node --test tests/feed/ui.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const FO_DIR = path.join(ROOT, 'pages', 'thivajini', 'feed-optimization');

const read = (f) => fs.readFileSync(path.join(FO_DIR, f), 'utf8');

const DASH = fs.readFileSync(path.join(ROOT, 'pages', 'thivajini.html'), 'utf8');
const INDEX = read('index.html');
const WORK = read('workspace.js');
const SHARED = read('feed.js');
const CSS = read('feed.css');
const CYCLE = read('cycle.html');
const MON = read('monitoring.html');
const HIST = read('history.html');

const ALL_UI = [INDEX, WORK, SHARED, CYCLE, MON, HIST, DASH].join('\n');

// ═══════════ 1. workspace files exist and the dashboard only links to them ══

test('the workspace lives in its own directory, not inside thivajini.html', () => {
  ['index.html', 'cycle.html', 'monitoring.html', 'history.html', 'feed.css', 'feed.js', 'workspace.js']
    .forEach((f) => assert.ok(fs.existsSync(path.join(FO_DIR, f)), `${f} must exist`));
});

test('the member dashboard carries a CARD, and the giant Req5 panel is gone', () => {
  assert.ok(DASH.includes('Generate conversion-informed Merchant titles and descriptions'),
    'the card description is present');
  assert.ok(DASH.includes('/pages/thivajini/feed-optimization/'), 'it links to the workspace');
  assert.ok(DASH.includes('Open Feed Optimization'), 'primary link');
  assert.ok(DASH.includes('View Active Monitoring'), 'secondary link');
  // The in-page workflow and its tables must be gone.
  ['r5-cand-tbl', 'r5-terms-tbl', 'r5-appr-tbl', 'r5-mon-tbl', 'r5-csv-modal', 'r5-drawer',
   'Start batch', 'r5-step-tab'].forEach((gone) => {
    assert.equal(DASH.indexOf(gone), -1, `thivajini.html must no longer contain ${gone}`);
  });
});

test('Req1-Req4 stay intact on the member dashboard', () => {
  ['panel-1', 'panel-2', 'panel-3', 'panel-4'].forEach((p) => {
    assert.ok(DASH.includes('id="' + p + '"'), `${p} still present`);
  });
  ['tvLoadReq2', 'tvLoadReq3', 'tvLoadReq4'].forEach((fn) => {
    assert.ok(DASH.includes(fn), `${fn} still wired`);
  });
});

test('the dashboard page shrank rather than grew', () => {
  // It held the whole application before; a card is a fraction of that.
  assert.ok(DASH.length < 150000,
    'thivajini.html should be well under 150 KB, is ' + DASH.length);
});

// ═══════════ 2. one view at a time ══════════════════════════════════════════

test('the workspace declares exactly three views and shows one', () => {
  ['fo-view-setup', 'fo-view-run', 'fo-view-report'].forEach((v) => {
    assert.ok(INDEX.includes('id="' + v + '"'), v + ' exists');
  });
  const sections = INDEX.match(/<section id="fo-view-[a-z]+"[^>]*>/g) || [];
  assert.equal(sections.length, 3);
  const visible = sections.filter((t) => !/\bhidden\b/.test(t));
  assert.equal(visible.length, 1, 'exactly one view starts visible');
  assert.ok(visible[0].includes('fo-view-setup'), 'setup is the entry view');
});

test('view() hides the other two — it never appends a second one', () => {
  const fn = WORK.slice(WORK.indexOf('function view('), WORK.indexOf('// ═══════════ 1. SETUP'));
  assert.ok(fn.includes('el.hidden = (v !== name)'), 'views are toggled by the hidden attribute');
  assert.ok(!/appendChild/.test(fn), 'no view stacking');
});

test('no 200-row candidate table is rendered anywhere in the workspace', () => {
  assert.ok(!INDEX.includes('id="fo-candidates"'), 'no permanent candidate table');
  // The run view shows a compact list, not a table.
  assert.ok(INDEX.includes('id="fo-run-products"'), 'compact product list exists');
  assert.ok(CSS.includes('.fo-plist'), 'and it is styled as a list');
});

// ═══════════ 3. one primary action ══════════════════════════════════════════

test('there is ONE primary call to action and no separate Start Batch', () => {
  assert.ok(INDEX.includes('>Run Optimization Cycle<'), 'the CTA exists');
  ['Load candidates', 'Start batch', 'Search-term review', 'Approved variants', 'Export history']
    .forEach((old) => assert.equal(INDEX.indexOf(old), -1,
      `"${old}" must not be a workflow button any more`));
});

test('the setup screen shows the four status cards', () => {
  ['Products available', 'Data readiness', 'Active cycle', 'Active monitoring tests']
    .forEach((k) => assert.ok(INDEX.includes(k), `status card "${k}"`));
});

test('cycle settings stay simple and expose no technical API knobs', () => {
  assert.ok(INDEX.includes('id="fo-set-count"'), 'product count');
  assert.ok(INDEX.includes('value="10"'), 'default is the written workflow count of 10');
  assert.ok(INDEX.includes('id="fo-set-priority"'), 'priority filter');
  ['temperature', 'max_tokens', 'model', 'endpoint', 'api'].forEach((k) => {
    assert.ok(!new RegExp('id="fo-set-' + k + '"').test(INDEX), `no ${k} setting exposed`);
  });
});

// ═══════════ 4. run view ════════════════════════════════════════════════════

test('the run view is a stepper plus a compact per-product list', () => {
  ['Preparing products', 'Checking feed gates', 'Loading search evidence',
   'Generating A/B variants', 'Validating', 'Building report']
    .forEach((s) => assert.ok(WORK.includes(s), `step "${s}"`));
  assert.ok(INDEX.includes('id="fo-run-bar"'), 'progress bar');
  assert.ok(WORK.includes("' of ' + c.total + ' products processed'"), 'x of y products');
  assert.ok(INDEX.includes('aria-live="polite"'), 'progress is announced to assistive tech');
});

test('product rows show a state, never a raw enum', () => {
  const fn = WORK.slice(WORK.indexOf('function productStateBadge('), WORK.indexOf('// ═══════════ 3. REPORT'));
  ['Generated', 'Check Required', 'Skipped', 'Generating', 'Waiting']
    .forEach((s) => assert.ok(fn.includes(s), `state "${s}" has staff wording`));
});

// ═══════════ 5. Feed Gate — no UNKNOWN anywhere ═════════════════════════════

test('the string UNKNOWN appears nowhere a staff member can see it', () => {
  [['thivajini.html', DASH], ['index.html', INDEX], ['workspace.js', WORK],
   ['feed.js', SHARED], ['cycle.html', CYCLE], ['monitoring.html', MON], ['history.html', HIST]]
    .forEach(([name, src]) => {
      assert.equal(src.indexOf('UNKNOWN'), -1, `${name} must not contain UNKNOWN`);
    });
});

test('the three Feed Gate states map to the agreed staff wording', () => {
  assert.ok(SHARED.includes("ELIGIBLE: 'Eligible'"));
  assert.ok(SHARED.includes("CHECK: 'Check Required'"));
  assert.ok(SHARED.includes("NOT_ELIGIBLE: 'Not Eligible'"));
  assert.ok(SHARED.includes("ELIGIBLE: 'green'") && SHARED.includes("CHECK: 'amber'") &&
            SHARED.includes("NOT_ELIGIBLE: 'red'"), 'each state has its own tone');
});

test('the browser cannot promote Check Required to Eligible', () => {
  const fn = SHARED.slice(SHARED.indexOf('FO.gateBadge ='), SHARED.indexOf('FO.qualityBadge ='));
  // The only thing the browser does is look the server's status up in a table.
  assert.ok(fn.includes('FO.GATE_LABEL[st]'), 'wording comes from a lookup');
  assert.ok(!/=\s*['"]ELIGIBLE['"]/.test(fn), 'the browser never assigns ELIGIBLE');
  assert.ok(fn.includes("|| 'CHECK'"), 'an absent state falls back to CHECK, never to Eligible');
});

test('an unverified gate still explains itself', () => {
  assert.ok(SHARED.includes('Merchant eligibility status is not available from the current Ledsone DB'),
    'the reason is carried as a tooltip');
});

// ═══════════ 6. data quality wording ════════════════════════════════════════

test('data quality uses Ready / Review / Blocked, never a raw level', () => {
  const fn = SHARED.slice(SHARED.indexOf('FO.qualityBadge ='), SHARED.indexOf('FO.RESULT_TONE'));
  ['Ready', 'Review', 'Blocked'].forEach((l) => assert.ok(fn.includes("'" + l + "'"), `level "${l}"`));
  assert.ok(fn.includes('q.summary'), 'the sentence from the server is shown');
});

test('no raw internal field name is printed to staff', () => {
  ['verified_technical_specs', 'google_product_category unavailable', 'missing_evidence.join']
    .forEach((raw) => assert.equal(ALL_UI.indexOf(raw), -1, `${raw} must not reach the UI`));
});

// ═══════════ 7. report + variant decision ═══════════════════════════════════

test('the final report carries the agreed columns and stays under 10', () => {
  const head = INDEX.slice(INDEX.indexOf('id="fo-rep-tbl"'), INDEX.indexOf('</thead>', INDEX.indexOf('id="fo-rep-tbl"')));
  ['Product', 'Item ID / SKU', 'Feed Gate', 'Current Title', 'Variant A', 'Variant B',
   'Search Evidence', 'Data Quality', 'Result', 'Choice']
    .forEach((c) => assert.ok(head.includes(c), `report column "${c}"`));
  // <th[\s>] so the opening <thead> tag is not counted as a column.
  const ths = (head.match(/<th[\s>]/g) || []).length;
  assert.ok(ths <= 10, 'the report table stays at 10 columns or fewer, has ' + ths);
});

test('full descriptions are behind View, not inline in the table', () => {
  assert.ok(WORK.includes('function openCompare('), 'a comparison drawer exists');
  assert.ok(INDEX.includes('id="fo-compare"') && INDEX.includes('role="dialog"'), 'it is a real dialog');
  const cell = WORK.slice(WORK.indexOf('function variantCell('), WORK.indexOf('function choiceCell('));
  assert.ok(!cell.includes('description_fr'), 'the table never prints a description');
  assert.ok(cell.includes('trunc'), 'long titles are truncated in the table');
});

test('staff can select A, select B, leave unselected, or exclude', () => {
  assert.ok(WORK.includes("'Select Variant '"), 'select a variant');
  assert.ok(WORK.includes('Leave unselected'), 'leave unselected');
  assert.ok(WORK.includes('fo-cmp-exclude'), 'exclude from export');
  assert.ok(WORK.includes("FO.post('req5-cycle-select'"), 'the choice is saved server-side');
});

test('a variant that failed validation cannot be selected', () => {
  assert.ok(WORK.includes('did not pass validation and cannot be selected'),
    'the reason is shown instead of a button');
});

// ═══════════ 8. download is not a go-live ═══════════════════════════════════

test('downloading never starts monitoring', () => {
  const fn = WORK.slice(WORK.indexOf('function doDownload('), WORK.indexOf('// ═══════════ 5.'));
  assert.ok(fn.includes("monitoring_start_mode: 'DEFERRED'"),
    'the export explicitly defers monitoring');
  assert.ok(!fn.includes('req5-monitoring-start'), 'download must not call monitoring-start');
  assert.ok(fn.includes('Nothing is live yet.'), 'and it says so');
});

test('Start Monitoring is a separate, explicit action with a go-live question', () => {
  assert.ok(INDEX.includes('>Start Monitoring<'), 'the button exists');
  assert.ok(INDEX.includes('Have the selected feed changes been uploaded and gone live?'),
    'the confirmation question is asked verbatim');
  ['Yes &mdash; live today', 'Yes &mdash; live on another date', 'Not yet']
    .forEach((o) => assert.ok(INDEX.includes(o), `option "${o}"`));
  const fn = WORK.slice(WORK.indexOf('function confirmMonitoring('), WORK.indexOf('// ═══════════ 6.'));
  assert.ok(fn.includes("document.getElementById('fo-mon-not').checked"), 'Not yet is handled');
  assert.ok(fn.includes('Monitoring was not started'), 'and it starts nothing');
  assert.ok(fn.includes("FO.post('req5-monitoring-start'"), 'otherwise it starts monitoring');
});

test('the custom go-live date is offered and used', () => {
  assert.ok(INDEX.includes('id="fo-mon-date"'), 'a date input exists');
  const fn = WORK.slice(WORK.indexOf('function confirmMonitoring('), WORK.indexOf('// ═══════════ 6.'));
  assert.ok(fn.includes("document.getElementById('fo-mon-other').checked"), 'custom date branch');
  assert.ok(fn.includes("new Date().toISOString().slice(0, 10)"), 'today branch');
});

test('the export modal offers products and customizable columns', () => {
  assert.ok(INDEX.includes('>Customize &amp; Download<'), 'the primary action');
  assert.ok(INDEX.includes('id="fo-dl-products"'), 'per-product include/exclude');
  assert.ok(INDEX.includes('id="fo-col-groups"'), 'column groups');
  ['fo-col-rec', 'fo-col-all', 'fo-col-none'].forEach((id) =>
    assert.ok(INDEX.includes('id="' + id + '"'), id));
});

// ═══════════ 9. idempotency + double click ══════════════════════════════════

test('the Run button cannot fire twice', () => {
  const fn = WORK.slice(WORK.indexOf('function startCycle('), WORK.indexOf('function pump('));
  assert.ok(fn.includes("FO.isBusy('fo-run') || S.running"), 'a second click is dropped');
  assert.ok(fn.includes('S.runKey = FO.newKey()'), 'an idempotency key is generated');
  assert.ok(fn.includes('idempotency_key: S.runKey'), 'and sent with the create request');
  assert.ok(fn.includes('if (!S.runKey)'), 'the SAME key is reused on a retry');
});

test('the cycle advances one product per request, never a burst', () => {
  const fn = WORK.slice(WORK.indexOf('function tick('), WORK.indexOf('function renderRun('));
  assert.ok(fn.includes("FO.post('req5-cycle-advance'"), 'one advance call');
  assert.ok(fn.includes('setTimeout(tick'), 'strictly sequential');
  assert.ok(!/Promise\.all/.test(fn), 'no parallel fan-out of product work');
});

test('a dropped connection keeps the cycle resumable rather than restarting it', () => {
  assert.ok(WORK.includes('The cycle is saved'), 'the user is told it survived');
  assert.ok(INDEX.includes('id="fo-resume-btn"'), 'a Resume control exists');
});

// ═══════════ 10. states, accessibility, responsive ══════════════════════════

test('every screen has a written empty state', () => {
  assert.ok(HIST.includes('No optimization cycles yet.'), 'history');
  assert.ok(MON.includes('No live tests are being monitored.'), 'monitoring');
  assert.ok(CYCLE.includes('No cycle selected.'), 'cycle detail');
  assert.ok(WORK.includes('This cycle produced no rows.'), 'report');
  assert.ok(WORK.includes('No variants were generated for this product.'), 'comparison');
});

test('loading states exist for every long operation', () => {
  ['Loading monitored tests…', 'Loading cycles…', 'Loading cycle detail…', 'Loading diagnostics…',
   'Preparing file…', 'Starting…']
    .forEach((s) => assert.ok(ALL_UI.includes(s), `loading state "${s}"`));
  assert.ok(SHARED.includes('FO.skelRows'), 'tables show a skeleton');
  // The overview loads into skeleton stat cards rather than a text line.
  assert.ok(INDEX.includes('class="skel"'), 'the overview shows skeletons while loading');
  assert.ok(CSS.includes('.spin'), 'a spinner exists');
});

test('modals and drawers manage focus and close on Escape', () => {
  assert.ok(SHARED.includes('lastFocus = document.activeElement'), 'focus is remembered');
  assert.ok(SHARED.includes('if (lastFocus && lastFocus.focus) lastFocus.focus()'), 'and restored');
  assert.ok(SHARED.includes("e.key !== 'Escape'"), 'Escape closes the top layer');
  assert.ok(INDEX.includes('aria-modal="true"'), 'dialogs are marked modal');
});

test('status is readable without relying on colour alone', () => {
  // Every badge carries words, not just a tone.
  assert.ok(SHARED.includes('FO.badge = function (kind, text, title)'), 'badges always take text');
  assert.ok(MON.includes('Too Early — Keep Testing'), 'monitoring states are words');
});

test('tables scroll and secondary columns collapse on a laptop', () => {
  assert.ok(CSS.includes('.fo-scroll{overflow-x:auto'), 'horizontal overflow is contained');
  assert.ok(CSS.includes('@media (max-width:1120px){ .col-opt{display:none;} }'),
    'optional columns collapse');
  assert.ok(INDEX.includes('class="col-opt"'), 'the report marks its optional columns');
});

test('no raw backend error code can reach the screen', () => {
  ['MIGRATION_NOT_APPLIED', 'REQ5_APP_DATABASE_URL_MISSING', 'REQ5_LEDSONE_DATABASE_URL_MISSING',
   'CYCLE_NOT_FOUND', '42P01'].forEach((c) => {
    assert.equal(ALL_UI.indexOf(c), -1, `the UI must never mention ${c}`);
  });
  assert.ok(SHARED.includes('Your session has expired. Please sign in again.'), 'expired session handled');
});

test('the UI never references a database variable or a secret', () => {
  ['DATABASE_URL', 'NEON_DATABASE_URL', 'AUTH_DATABASE_URL', 'FEED_TRACKER_DB_URL',
   'GEMINI_API_KEY', 'LOCAL_LLM_API', 'SESSION_SECRET'].forEach((v) => {
    assert.equal(ALL_UI.indexOf(v), -1, `the UI must not mention ${v}`);
  });
});

// ═══════════ 11. diagnostics, limitations, Merchant push ════════════════════

test('technical detail lives in Diagnostics, not in the workflow', () => {
  assert.ok(INDEX.includes('id="fo-diag"'), 'a diagnostics drawer exists');
  const fn = WORK.slice(WORK.indexOf('function openDiagnostics('), WORK.indexOf('// ═══════════ wiring'));
  ['Database', 'Providers', 'Environment', 'Merchant API Push']
    .forEach((s) => assert.ok(fn.includes(s), `diagnostics section "${s}"`));
  assert.ok(fn.includes('Values are never read by the browser.'));
  // and NOT on the main flow
  const setup = INDEX.slice(INDEX.indexOf('id="fo-view-setup"'), INDEX.indexOf('id="fo-view-run"'));
  ['token', 'latency', 'RPM', 'context'].forEach((t) =>
    assert.ok(!new RegExp(t, 'i').test(setup), `${t} must not appear on the setup screen`));
});

test('Merchant push is documented as future and never performed', () => {
  assert.ok(WORK.includes('Future — not enabled'), 'labelled as future');
  assert.ok(WORK.includes('No Merchant write is performed.'));
  assert.ok(!WORK.includes('req5-push-execute'), 'the workspace never calls push-execute');
});

test('data limitations are one small collapsed panel, not a banner', () => {
  const at = INDEX.indexOf('class="fo-lim"');
  assert.ok(at > 0, 'the panel exists');
  const tag = INDEX.slice(INDEX.lastIndexOf('<', at), at + 30);
  assert.ok(tag.startsWith('<details'), 'collapsible');
  assert.ok(!tag.includes('open'), 'and starts collapsed');
  assert.ok(INDEX.includes('These are limitations of the available data, not application errors.'));
  ['Authoritative France Feed Eligible source is unavailable', 'Keyword Planner',
   'intent classification'].forEach((s) => assert.ok(INDEX.includes(s), `limitation "${s}"`));
});

// ═══════════ 12. cycle detail + history ═════════════════════════════════════

test('the full cycle detail page is an audit trail', () => {
  ['Timeline', 'Per-product detail', 'Evidence snapshot', 'Feed Gate', 'Data gaps',
   'Provider attempts', 'Variants'].forEach((s) =>
    assert.ok(CYCLE.includes(s), `cycle detail section "${s}"`));
  assert.ok(CYCLE.includes('This is not the operating screen.'), 'it says what it is for');
  assert.ok(CYCLE.includes("FO.get('req5-cycle-detail'"), 'it reads the detail endpoint');
});

test('history lists cycles as cards with the four actions', () => {
  ['View Report', 'View Full Details', 'Open Monitoring'].forEach((a) =>
    assert.ok(HIST.includes(a), `history action "${a}"`));
  assert.ok(!HIST.includes('<table'), 'history uses cards, not a giant nested table');
});

test('monitoring groups tests into Active / Ready for Review / Completed', () => {
  ['Active', 'Ready for Review', 'Completed'].forEach((t) =>
    assert.ok(MON.includes('>' + t + '<'), `monitoring tab "${t}"`));
  assert.ok(MON.includes('role="tablist"') && MON.includes('aria-selected'), 'real tabs');
  assert.ok(MON.includes('ArrowRight') && MON.includes('ArrowLeft'), 'keyboard navigation');
  assert.ok(MON.includes('attribution-adjusted verdict is <b>not implemented</b>'),
    'the limitation is a footnote');
});
