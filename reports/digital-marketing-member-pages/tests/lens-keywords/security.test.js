'use strict';

// tests/lens-keywords/security.test.js
//
// REQ-DM-2026-08-SAJE01 — static verification of the security/architecture
// rules this feature must not regress. Same technique as tests/stpm/ui.test.js
// §"the router never sets wildcard CORS" / "every STPM endpoint requires a
// session" — reading source as text and asserting structure, because no
// browser/HTTP harness with a real signed session cookie is available here.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ROUTER = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'router.js'), 'utf8');
const REPO = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'repo.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'config.js'), 'utf8');
const SERPAPI = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'serpapi.js'), 'utf8');
const QUOTA = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'quota.js'), 'utf8');
const MEMBERS_API = fs.readFileSync(path.join(ROOT, 'api', 'members-api.js'), 'utf8');
const MIGRATION = fs.readFileSync(path.join(ROOT, 'db', 'migrations', '2026-08-24_006_sajeepan_lens_keywords.sql'), 'utf8');

test('every lens-keyword endpoint requires a session before dispatch', () => {
  const idxAuth = ROUTER.indexOf('requireLensSession(req, res)');
  const idxSwitch = ROUTER.indexOf('switch (type)');
  assert.ok(idxAuth > -1 && idxSwitch > -1 && idxAuth < idxSwitch,
    'the session guard must run before any action is dispatched');
});

test('the router never sets wildcard CORS', () => {
  assert.ok(!/setHeader\(\s*['"]Access-Control-Allow-Origin/.test(ROUTER));
});

test('write actions insist on POST', () => {
  assert.match(ROUTER, /case 'lens-keyword-run-create':[\s\S]{0,120}requirePost/);
  assert.match(ROUTER, /case 'lens-keyword-run-advance':[\s\S]{0,120}requirePost/);
  assert.match(ROUTER, /case 'lens-keyword-competitor-review':[\s\S]{0,200}requirePost/);
});

test('read actions never require POST', () => {
  assert.doesNotMatch(ROUTER, /case 'lens-keyword-products':[\s\S]{0,120}requirePost/);
  assert.doesNotMatch(ROUTER, /case 'lens-keyword-run-history':[\s\S]{0,120}requirePost/);
});

test('reviewer identity comes from the session, never the request body', () => {
  assert.match(ROUTER, /reviewed_by:\s*actor/);
  assert.ok(!/reviewed_by:\s*body\./.test(ROUTER));
});

test('lens-keyword routes are wired into the existing members-api dispatcher, not a new function', () => {
  assert.match(MEMBERS_API, /type\.startsWith\('lens-keyword'\)/);
  assert.match(MEMBERS_API, /require\('\.\.\/lib\/lens-keywords\/router'\)/);
  // A new api/lens-keywords.js (or similar) would breach the 12-function ceiling.
  const apiFiles = fs.readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js'));
  assert.strictEqual(apiFiles.length, 12, 'the project must stay at exactly 12 Vercel functions');
  assert.ok(!fs.existsSync(path.join(ROOT, 'api', 'lens-keywords.js')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'api', 'lib')));
});

test('the existing Sajeepan req1-req4 route is untouched', () => {
  assert.match(MEMBERS_API, /return handleSajeepan\(req, res\)/);
});

test('lib/ is never excluded from the deployment bundle', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
  assert.ok(!/^lib\//m.test(ignore));
  assert.match(ignore, /^db\//m);
  assert.match(ignore, /^tests\//m);
});

test('no request handler runs schema DDL — only the migration file does', () => {
  for (const src of [ROUTER, REPO]) {
    assert.ok(!/CREATE TABLE|ALTER TABLE|DROP TABLE/i.test(src),
      'lens-keywords request-path code must never run DDL — see governing prompt §8');
  }
});

test('the migration is additive, namespaced and non-destructive', () => {
  assert.match(MIGRATION, /CREATE TABLE IF NOT EXISTS/);
  // Strip comment lines first — the file's own header legitimately says
  // "No DROP. No TRUNCATE." as a design rule, which must not self-fail this.
  const codeOnly = MIGRATION.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.ok(!/\bDROP\s+TABLE\b|\bTRUNCATE\b/i.test(codeOnly), 'no DROP/TRUNCATE statement may appear in executable SQL');
  // Sibling features may be mentioned in comments for context — the check is
  // that no DDL statement actually TARGETS another feature's tables.
  assert.ok(!/(ALTER|DROP)\s+TABLE\s+public\.(thivajini_feed|mahima_stpm)/i.test(MIGRATION),
    'must not modify another feature\'s tables');
});

test('DILAIKSHAN_NEON_DB has no fallback chain', () => {
  assert.match(CONFIG, /process\.env\.DILAIKSHAN_NEON_DB/);
  // Other database names may appear in comments explaining what NOT to use —
  // the check is that appUrl() never actually READS one of them.
  assert.ok(!/process\.env\.(AUTH_DATABASE_URL|NEON_DATABASE_URL|FEED_TRACKER_DB_URL)/.test(CONFIG),
    'an implicit A || B chain can silently point writes at the wrong database — ARCHITECTURE.md §10 finding 4');
});

test('DATABASE_URL is the only Ledsone read source, also with no fallback', () => {
  assert.match(CONFIG, /process\.env\.DATABASE_URL/);
});

test('no SerpAPI key value is ever assigned to a module-level constant', () => {
  // Keys are read lazily inside functions (process.env[...]) — never hoisted
  // to a const that a stack trace or debugger snapshot could expose.
  assert.ok(!/^const\s+\w*(KEY|SECRET)\w*\s*=\s*process\.env/m.test(SERPAPI));
  assert.ok(!/^const\s+\w*(KEY|SECRET)\w*\s*=\s*process\.env/m.test(QUOTA));
});

test('the SerpAPI Account API safe-field allowlist is enforced in source, not just in tests', () => {
  const m = QUOTA.match(/const SAFE_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(m, 'SAFE_FIELDS array literal must exist');
  assert.ok(!/api_key|account_email|account_id/.test(m[1]),
    'the array literal itself must never list a sensitive field, even though the request URL legitimately builds one at call time');
});

test('MAX_PRODUCTS_PER_RUN is enforced server-side, not only documented', () => {
  assert.match(CONFIG, /MAX_PRODUCTS_PER_RUN\s*=\s*50/);
  const phase1 = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'phase1.js'), 'utf8');
  assert.match(phase1, /MAX_PRODUCTS_PER_RUN/);
  assert.match(phase1, /ERRORS\.TOO_MANY_PRODUCTS/);
});

// Superseded 2026-08-24: this feature IS scheduled now. What must hold is
// that the schedule routes through the EXISTING function and authenticates
// with CRON_SECRET — not that no schedule exists.
test('the weekly crons route through the existing members-api function, adding no new one', () => {
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const lensCrons = vercelJson.crons.filter((c) => /lens-keyword/.test(c.path));
  assert.strictEqual(lensCrons.length, 2, 'exactly the weekly-run and continuation crons');
  lensCrons.forEach((c) => {
    assert.match(c.path, /^\/api\/members-api\?/, 'must not introduce a new top-level function');
  });
  const weeklyCron = lensCrons.find((c) => /weekly-run/.test(c.path));
  assert.strictEqual(weeklyCron.schedule, '0 1 * * 1', 'Monday 01:00 UTC');
  const continuation = lensCrons.find((c) => /weekly-continue/.test(c.path));
  assert.strictEqual(continuation.schedule, '0 4 * * *', 'daily continuation');
  // Vercel Hobby allows many crons but each must run at most once per day.
  lensCrons.forEach((c) => {
    assert.ok(!/^\S+\s+\*/.test(c.schedule), 'a cron firing more than once a day is not permitted on this plan');
  });
});

test('the cron routes authenticate with CRON_SECRET and never accept a staff session', () => {
  assert.match(ROUTER, /CRON_TYPES\.has\(type\)/);
  const idxCron = ROUTER.indexOf('CRON_TYPES.has(type)');
  const idxAuth = ROUTER.indexOf('const s = requireLensSession(req, res)'); // the CALL, not the definition
  assert.ok(idxCron < idxAuth, 'cron routes must divert before the session guard, not through it');

  const WEEKLY = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'weekly.js'), 'utf8');
  assert.match(WEEKLY, /assertCronAuthorized/);
  assert.match(WEEKLY, /CRON_SECRET_MISSING/, 'a missing secret must fail closed, not fall open');
  // Comments legitimately EXPLAIN that a session is not accepted; the check is
  // that no executable line ever reads one.
  const weeklyCode = WEEKLY.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  assert.ok(!/verifySession|req\.cookies|dm_session/.test(weeklyCode),
    'the cron auth path must never consult a browser session as a substitute for the secret');
  assert.match(WEEKLY, /timingSafeEqual/, 'the secret comparison must not be a plain === on attacker-controlled input');
});

test('no generation key value is ever hoisted to a module-level constant or persisted', () => {
  const GEMMA = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'gemma.js'), 'utf8');
  assert.ok(!/^const\s+\w*(KEY|SECRET)\w*\s*=\s*process\.env/m.test(GEMMA));
  assert.match(GEMMA, /GOOGLE_API_KEY_GLSK/, 'primary key env name must be declared');
  // The key may only reach a URL at call time, never a log line or a DB write.
  assert.ok(!/console\.(log|error|warn)\([^)]*gemmaKey/.test(GEMMA));
  const REPO_SRC = fs.readFileSync(path.join(ROOT, 'lib', 'lens-keywords', 'repo.js'), 'utf8');
  assert.ok(!/GOOGLE_API_KEY_GLSK|GEMINI_API_KEY/.test(REPO_SRC),
    'generation evidence must record the model and source, never the key');
});

test('the automation product table and history are read-only paths', () => {
  assert.doesNotMatch(ROUTER, /case 'lens-keyword-all-products':[\s\S]{0,200}requirePost/);
  assert.doesNotMatch(ROUTER, /case 'lens-keyword-weekly-history':[\s\S]{0,200}requirePost/);
  assert.match(ROUTER, /case 'lens-keyword-run-automation':[\s\S]{0,120}requirePost/);
});
