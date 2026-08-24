// tests/feed/dbboundary.test.js
//
// REQ5 DATABASE BOUNDARY — regression tests.
//
//   Req5 operational reads  → DATABASE_URL       → Ledsone DB
//   Req5 workflow/history   → AUTH_DATABASE_URL  → application Neon DB
//
// CORRECTED 2026-08-20: an earlier revision targeted NEON_DATABASE_URL. That is
// the SEMrush/GEO database (ARCHITECTURE.md §8.1), not Req5's. See
// 06_VALIDATION/…_CONTINUATION-VALIDATION.md Addendum 3.
//
// The point of these tests is that neither side may EVER silently fall back to
// the other, or to the historical `FEED_TRACKER_DB_URL || AUTH_DATABASE_URL`
// chain. ARCHITECTURE.md §10 finding 4 records that overlapping fallbacks are
// how a feature ends up pointed at the wrong database without anyone noticing.
//
//   node --test tests/feed/dbboundary.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const LIB = path.join(ROOT, 'lib', 'feed');

/** Run fn with a temporary env, always restoring afterwards. */
function withEnv(overrides, fn) {
  const saved = {};
  for (const k of Object.keys(overrides)) {
    saved[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try { return fn(); } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

/** Fresh module instance so the memoised pool never leaks between tests. */
function freshRepo() {
  delete require.cache[require.resolve(path.join(LIB, 'repo'))];
  return require(path.join(LIB, 'repo'));
}

// ═══════════ 1. operational reads use DATABASE_URL ════════════════════════
/**
 * Strip comments and string literals so these tests inspect CODE, not prose.
 * Without this, an error MESSAGE that names a variable ("will NOT fall back to
 * NEON_DATABASE_URL") would be mistaken for the code reading that variable.
 */
function codeOnly(src) {
  const BS = String.fromCharCode(92); // backslash, written this way on purpose
  const sq = new RegExp("'(?:[^'" + BS + BS + "]|" + BS + BS + ".)*'", 'g');
  const dq = new RegExp('"(?:[^"' + BS + BS + ']|' + BS + BS + '.)*"', 'g');
  const tq = new RegExp('`(?:[^`' + BS + BS + ']|' + BS + BS + '.)*`', 'g');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/^\s*\/\/.*$/gm, '')       // line comments
    .replace(sq, "''")
    .replace(dq, '""')
    .replace(tq, '``');
}

test('Req5 operational reads resolve to DATABASE_URL', () => {
  const src = fs.readFileSync(path.join(LIB, 'req5.js'), 'utf8');
  const fn = codeOnly(src.slice(src.indexOf('function ledsoneClient()'),
    src.indexOf('function err(res, e)')));
  assert.ok(fn.includes('process.env.DATABASE_URL'), 'must read DATABASE_URL');
  // The error MESSAGE legitimately names the Neon variable; the CODE must not
  // read it. Comments and strings are stripped above so this is exact.
  assert.ok(!fn.includes('process.env.NEON_DATABASE_URL'), 'must not read the Neon variable');
  assert.ok(!fn.includes('process.env.AUTH_DATABASE_URL'), 'must not borrow the app DB');
  assert.ok(!fn.includes('process.env.FEED_TRACKER_DB_URL'));
  assert.ok(!fn.includes('process.env.NEON_DATABASE_URL'));
});

// ═══════════ 2. workflow history uses AUTH_DATABASE_URL ═══════════════════
test('Req5 workflow/history resolves to AUTH_DATABASE_URL', () => {
  const repo = freshRepo();
  withEnv({
    AUTH_DATABASE_URL: 'postgres://unit-test/auth',
    NEON_DATABASE_URL: 'postgres://unit-test/semrush',
    FEED_TRACKER_DB_URL: 'postgres://unit-test/tracker',
    DATABASE_URL: 'postgres://unit-test/ledsone',
  }, () => {
    assert.equal(repo.connectionString(), 'postgres://unit-test/auth');
  });
});

test('Req5 NEVER reads NEON_DATABASE_URL anywhere in lib/feed', () => {
  for (const f of fs.readdirSync(LIB).filter((n) => n.endsWith('.js'))) {
    const code = codeOnly(fs.readFileSync(path.join(LIB, f), 'utf8'));
    assert.ok(!code.includes('process.env.NEON_DATABASE_URL'),
      f + ' must not read NEON_DATABASE_URL - that is the SEMrush/GEO database');
  }
});

// ═══════════ 3. missing DATABASE_URL never falls back to Neon ═════════════
test('missing DATABASE_URL fails loudly and never reaches Neon', () => {
  const req5 = require(path.join(LIB, 'req5'));
  const src = fs.readFileSync(path.join(LIB, 'req5.js'), 'utf8');
  assert.ok(src.includes('REQ5_LEDSONE_DATABASE_URL_MISSING'),
    'must raise the documented error code');
  // even with a Neon URL configured, the Ledsone side must not borrow it
  const fn = src.slice(src.indexOf('function ledsoneClient()'),
    src.indexOf('function err(res, e)'));
  assert.ok(!/\|\|/.test(fn.split('const cs =')[1].split(';')[0]),
    'no `||` fallback chain on the Ledsone connection string');
  assert.ok(req5.READ_TYPES.size > 0);
});

// ═══════════ 4. missing AUTH_DATABASE_URL never falls back to Ledsone ═════
test('missing AUTH_DATABASE_URL fails loudly and never reaches Ledsone', () => {
  const repo = freshRepo();
  withEnv({
    AUTH_DATABASE_URL: undefined,
    NEON_DATABASE_URL: 'postgres://unit-test/semrush',
    FEED_TRACKER_DB_URL: 'postgres://unit-test/tracker',
    DATABASE_URL: 'postgres://unit-test/ledsone',
  }, () => {
    assert.equal(repo.connectionString(), null,
      'must not borrow NEON_DATABASE_URL, FEED_TRACKER_DB_URL or DATABASE_URL');
    assert.throws(() => repo.getPool(), (e) => {
      assert.equal(e.code, 'REQ5_APP_DATABASE_URL_MISSING');
      assert.match(e.message, /will NOT fall back/i);
      return true;
    });
  });
});

test('the historical fallback chain is absent from Req5 app-DB resolution', () => {
  const src = fs.readFileSync(path.join(LIB, 'repo.js'), 'utf8');
  const fn = src.slice(src.indexOf('function connectionString()'),
    src.indexOf('function wrapDbError'));
  // The old names may appear in the explanatory comment, but never as a value.
  const code = codeOnly(fn);
  assert.ok(code.includes('process.env.AUTH_DATABASE_URL'), 'reads the app DB variable');
  assert.ok(!code.includes('process.env.NEON_DATABASE_URL'), 'no SEMrush/GEO fallback in code');
  assert.ok(!code.includes('process.env.FEED_TRACKER_DB_URL'), 'no FEED_TRACKER fallback in code');
  assert.ok(!code.includes('process.env.DATABASE_URL'), 'no Ledsone fallback in code');
});

// ═══════════ 5. no secret URL is ever returned to the frontend ════════════
test('no connection string can reach the browser', () => {
  const src = fs.readFileSync(path.join(LIB, 'req5.js'), 'utf8');
  // A payload may carry a BOOLEAN (`!!process.env.X`) but never the value.
  // Find every `process.env.X` read that is NOT immediately preceded by `!!`.
  const code = codeOnly(src);
  const rawReads = [...code.matchAll(/(!!\s*)?process\.env\.([A-Z_][A-Z0-9_]*)/g)]
    .filter((m) => !m[1])
    .map((m) => m[2]);
  const SECRET_VARS = ['DATABASE_URL', 'NEON_DATABASE_URL', 'AUTH_DATABASE_URL',
    'FEED_TRACKER_DB_URL', 'SESSION_SECRET', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2',
    'LOCAL_LLM_API'];
  // Reading a secret is fine (we must connect); serialising it is not.
  // `connectionString:` is the pg driver's own option name, so it is only
  // legitimate immediately inside `new Client({...})` / `new Pool({...})`.
  const driverOptions = (code.match(/new\s+(?:Client|Pool)\s*\(\s*\{\s*connectionString\s*:/g) || []).length;
  const allUses = (code.match(/connectionString\s*:/g) || []).length;
  assert.equal(allUses, driverOptions,
    'connectionString: may only appear as a pg driver option, never in a response payload');
  assert.ok(!code.includes('connection_string'), 'must not serialise connection_string');
  SECRET_VARS.forEach((v) => {
    const BS = String.fromCharCode(92);
    // matches  someKey: process.env.SECRET   (i.e. putting the VALUE in a payload)
    const serialised = new RegExp(
      '[a-z_]+' + BS + 's*:' + BS + 's*process' + BS + '.env' + BS + '.' + v + BS + 'b', 'i');
    assert.ok(!serialised.test(code), `req5.js must not put ${v} into a response object`);
  });
  assert.ok(rawReads.includes('DATABASE_URL'), 'DATABASE_URL is read for connecting (expected)');

  // Telemetry exposes presence BOOLEANS only.
  assert.ok(src.includes('present: !!process.env.DATABASE_URL'));
  assert.ok(src.includes('present: !!process.env.AUTH_DATABASE_URL'));
  assert.ok(src.includes('DATABASE_URL: !!process.env.DATABASE_URL'));

  const repoSrc = fs.readFileSync(path.join(LIB, 'repo.js'), 'utf8');
  assert.ok(!/return\s+\{[^}]*connectionString\(\)/.test(repoSrc),
    'repo must not return the connection string in a payload');
});

test('the UI never references a database variable', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages', 'thivajini.html'), 'utf8');
  ['DATABASE_URL', 'NEON_DATABASE_URL', 'AUTH_DATABASE_URL', 'FEED_TRACKER_DB_URL',
    'GEMINI_API_KEY', 'LOCAL_LLM_API', 'SESSION_SECRET'].forEach((v) => {
    assert.ok(!html.includes(v), `thivajini.html must not mention ${v}`);
  });
});

// ═══════════ 6. legacy dashboard routes are unaffected ════════════════════
test('legacy modules keep their own database variables untouched', () => {
  // intel-api owns the SEMrush/GEO chain. Req5 must not have rewritten it.
  const intel = fs.readFileSync(path.join(ROOT, 'api', 'intel-api.js'), 'utf8');
  assert.ok(intel.includes('process.env.semrush || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL'),
    'intel-api SEMrush chain must be unchanged');

  // members-api tracker code keeps FEED_TRACKER_DB_URL || AUTH_DATABASE_URL.
  const members = fs.readFileSync(path.join(ROOT, 'api', 'members-api.js'), 'utf8');
  assert.ok(members.includes('process.env.FEED_TRACKER_DB_URL || process.env.AUTH_DATABASE_URL'),
    "Sajeepan/Hetheesha tracker chain must be unchanged");

  // requirement.js keeps its own resolution too.
  const req = fs.readFileSync(path.join(ROOT, 'api', 'requirement.js'), 'utf8');
  assert.ok(req.includes('AUTH_DATABASE_URL'), 'requirement.js untouched');
});

test('members-api routes Req5 without altering the other members', () => {
  const members = fs.readFileSync(path.join(ROOT, 'api', 'members-api.js'), 'utf8');
  assert.ok(members.includes("type.startsWith('req5')"), 'Req5 branch present');
  assert.ok(members.includes('return handleThivajini(req, res);'), 'Req1-4 still reachable');
  ['hetheesha', 'jakshan', 'sajeepan', 'sonya', 'theekshy', 'monitor'].forEach((m) => {
    assert.ok(members.includes(`member === '${m}'`), `${m} route intact`);
  });
});

// ═══════════ guard: the Ledsone DB can never become the workflow DB ═══════
test('repo refuses an app-DB target that is actually the Ledsone database', () => {
  const src = fs.readFileSync(path.join(LIB, 'repo.js'), 'utf8');
  assert.ok(src.includes('REQ5_APP_TARGET_IS_LEDSONE'));
  assert.ok(src.includes("to_regclass('google_ads.product_performance')"),
    'must probe for a Ledsone-only object');
  assert.ok(src.includes("to_regclass('listings.shopify_listings')"));
});

test('config errors surface as 503, not a generic 500', () => {
  const src = fs.readFileSync(path.join(LIB, 'req5.js'), 'utf8');
  ['MIGRATION_NOT_APPLIED', 'REQ5_APP_DATABASE_URL_MISSING',
    'REQ5_LEDSONE_DATABASE_URL_MISSING', 'REQ5_APP_TARGET_IS_LEDSONE'].forEach((c) => {
    assert.ok(src.includes(c), `${c} must be treated as a configuration error`);
  });
});

test('migrationStatus reports the reached database so the target is provable at runtime', () => {
  const src = fs.readFileSync(path.join(LIB, 'repo.js'), 'utf8');
  assert.ok(src.includes('current_database() AS db'));
  assert.ok(src.includes("variable: 'AUTH_DATABASE_URL'"));
  assert.ok(src.includes('other_public_tables'),
    'neighbouring tables identify WHICH database was reached');
});

test('migrationStatus expects all 14 Req5 tables (migrations 001 + 002 + 003)', () => {
  const src = fs.readFileSync(path.join(LIB, 'repo.js'), 'utf8');
  const at = src.indexOf('const expected = [');
  const block = src.slice(at, src.indexOf('];', at));
  const found = block.match(/'thivajini_feed_[a-z_]+'/g) || [];
  assert.equal(found.length, 14, 'expected 14 Req5 tables, found ' + found.length);
  ['thivajini_feed_export', 'thivajini_feed_monitoring', 'thivajini_feed_push']
    .forEach((t) => assert.ok(block.includes(t), t + ' (migration 002) must be expected'));
  ['thivajini_feed_cycle', 'thivajini_feed_cycle_product', 'thivajini_feed_cycle_event']
    .forEach((t) => assert.ok(block.includes(t), t + ' (migration 003) must be expected'));
});

// ═══════════ 7. staff never see a raw setup error ═════════════════════════
test('setup failures show a staff message, not a technical code', () => {
  const req5 = require(path.join(LIB, 'req5'));
  const seen = [];
  const res = {
    status(c) { this._c = c; return this; },
    json(o) { seen.push([this._c, o]); return this; },
  };
  const e = new Error('Feed Optimization tables are missing in the application database (AUTH_DATABASE_URL).');
  e.code = 'MIGRATION_NOT_APPLIED';
  req5.__err(res, e);
  const [status, payload] = seen[0];
  assert.equal(status, 503);
  assert.equal(payload.error,
    'Feed Optimization setup is unavailable. Please contact the technical team.');
  assert.equal(payload.setup_issue, true);
  assert.ok(!payload.error.includes('MIGRATION_NOT_APPLIED'), 'no raw code for staff');
  assert.ok(!payload.error.includes('AUTH_DATABASE_URL'), 'no variable name for staff');
  assert.ok(payload.detail.includes('AUTH_DATABASE_URL'), 'technical detail kept separately');
});
