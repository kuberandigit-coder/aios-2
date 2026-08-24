#!/usr/bin/env node
// scripts/feed-ops.js
//
// Local operator tool for the Thivajini Req5 Feed Optimization feature.
// Dev-only. Excluded from the Vercel bundle by .vercelignore (scripts/ is not
// under api/, so it never becomes a Function either).
//
// Loads .env.local (produced by `vercel env pull`) WITHOUT printing any value.
//
//   node scripts/feed-ops.js precheck        # Neon pre-apply checks (read only)
//   node scripts/feed-ops.js migrate         # apply pending migrations
//   node scripts/feed-ops.js migrate-status  # which tables exist
//   node scripts/feed-ops.js providers       # provider discovery (no generation)
//   node scripts/feed-ops.js smoke           # tiny structured-output smoke test
//   node scripts/feed-ops.js candidates      # Ledsone candidate read (read only)
//
// NOTHING here writes to Ledsone. Nothing prints a secret.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── load .env.local without echoing anything ───────────────────────────────
(function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) {
    console.error('.env.local not found — run:  vercel env pull .env.local --environment=production');
    process.exit(1);
  }
  const txt = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, '\n');
    // Skip EMPTY values. Vercel returns "" for variables marked Sensitive, and
    // an empty string would otherwise shadow a real value the operator exported
    // in their own shell.
    if (v === '') continue;
    if (!process.env[k]) { process.env[k] = v; n++; }
  }
  console.log(`[env] loaded ${n} non-empty variables from .env.local (values never printed)`);
})();

const { Client } = require('pg');

/**
 * REQ5 BOUNDARY: the workflow/history database is AUTH_DATABASE_URL.
 *
 * CORRECTED 2026-08-20. NEON_DATABASE_URL is the SEMrush/GEO database
 * (ARCHITECTURE.md section 8.1) and is not Req5s. AUTH_DATABASE_URL is the
 * dedicated Neon database for authentication and application-owned trackers,
 * and already holds all 11 thivajini_feed_* tables.
 *
 * There is NO implicit fallback. An operator may override the variable NAME
 * explicitly with --db-env=NAME; it is never chosen automatically.
 */
function appDbUrl() {
  const flag = process.argv.find((a) => a.startsWith('--db-env='));
  const name = flag ? flag.split('=')[1] : 'AUTH_DATABASE_URL';
  const url = process.env[name];
  if (!url) {
    if (name === 'AUTH_DATABASE_URL') {
      throw new Error(
        'REQ5_APP_DATABASE_URL_MISSING - AUTH_DATABASE_URL is not set. Run ' +
        '`vercel env pull .env.local` first, or export it in this shell.');
    }
    throw new Error(name + ' is not set');
  }
  if (flag) {
    console.log('[warn] EXPLICIT OVERRIDE: using ' + name + ' instead of AUTH_DATABASE_URL');
  }
  return { url, which: name };
}

async function withClient(url, fn) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  try { return await fn(c); } finally { await c.end().catch(() => {}); }
}

// ─── commands ───────────────────────────────────────────────────────────────

async function precheck() {
  const { url, which } = appDbUrl();
  console.log(`[target] using ${which}`);
  await withClient(url, async (c) => {
    const id = await c.query('SELECT current_database() AS db, current_user AS usr');
    console.log('  current_database :', id.rows[0].db);
    console.log('  current_user     :', id.rows[0].usr);

    const app = await c.query(`SELECT to_regclass('public.users') IS NOT NULL AS looks_like_app_db`);
    console.log('  looks_like_app_db:', app.rows[0].looks_like_app_db);

    // Guard: the application DB must NOT be the Ledsone operational database.
    const led = await c.query(`
      SELECT to_regclass('google_ads.product_performance') IS NOT NULL AS has_google_ads,
             to_regclass('listings.shopify_listings')      IS NOT NULL AS has_listings`);
    console.log('  has google_ads schema (MUST be false):', led.rows[0].has_google_ads);
    console.log('  has listings schema   (MUST be false):', led.rows[0].has_listings);
    if (led.rows[0].has_google_ads || led.rows[0].has_listings) {
      throw new Error('REFUSING: this looks like the Ledsone operational DB, not the application DB');
    }

    const mine = await c.query(`
      SELECT tablename FROM pg_tables
       WHERE schemaname='public' AND tablename LIKE 'thivajini_feed%' ORDER BY 1`);
    console.log('  thivajini_feed_* tables present:', mine.rows.length
      ? mine.rows.map((r) => r.tablename).join(', ') : '(none)');

    const others = await c.query(`
      SELECT tablename FROM pg_tables
       WHERE schemaname='public' AND tablename IN
       ('users','feed_optimization_tracker','hetheesha_fix_tracker','hetheesha_fix_tracker_r2',
        'jefri_req6_tracker','staff_order_attribution') ORDER BY 1`);
    console.log('  existing app tables (must be untouched):', others.rows.map((r) => r.tablename).join(', ') || '(none)');

    const sj = await c.query(`SELECT COUNT(*)::int AS n FROM public.feed_optimization_tracker`).catch(() => ({ rows: [{ n: null }] }));
    console.log("  Sajeepan's feed_optimization_tracker row count (baseline):", sj.rows[0].n);
  });
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

async function migrateStatus() {
  const { url, which } = appDbUrl();
  console.log(`[target] ${which}`);
  await withClient(url, async (c) => {
    const { rows } = await c.query(`
      SELECT tablename FROM pg_tables
       WHERE schemaname='public' AND tablename LIKE 'thivajini_feed%' ORDER BY 1`);
    const present = rows.map((r) => r.tablename);
    console.log('  files   :', migrationFiles().join(', '));
    console.log('  tables  :', present.length ? present.join(', ') : '(none)');
    for (const t of present) {
      const cnt = await c.query(`SELECT COUNT(*)::int n FROM public.${t}`);
      console.log(`    ${t}: ${cnt.rows[0].n} rows`);
    }
  });
}

async function migrate() {
  const { url, which } = appDbUrl();
  console.log(`[target] ${which}`);
  await withClient(url, async (c) => {
    // Same refusal guard as precheck.
    const led = await c.query(`SELECT to_regclass('google_ads.product_performance') IS NOT NULL AS g`);
    if (led.rows[0].g) throw new Error('REFUSING: target looks like the Ledsone operational DB');

    for (const f of migrationFiles()) {
      const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      process.stdout.write(`  applying ${f} … `);
      try {
        await c.query(sqlText);
        console.log('OK');
      } catch (e) {
        console.log('FAILED');
        console.error('   ', e.message);
        throw e;
      }
    }
  });
  console.log('[done] migrations applied');
  await migrateStatus();
}

async function providers() {
  const P = require('../lib/feed/providers');
  const strip = (d) => {
    const o = { ...d };
    o.models_available = (o.models_available || []).slice(0, 12);
    return o;
  };
  console.log('\n--- local ---');
  console.log(JSON.stringify(strip(await P.discoverLocal()), null, 2));
  for (const alias of ['gemini_key_1', 'gemini_key_2']) {
    console.log(`\n--- ${alias} ---`);
    console.log(JSON.stringify(strip(await P.discoverGemini(alias)), null, 2));
  }
}

async function candidates() {
  const sql = require('../lib/feed/sql');
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 20000, statement_timeout: 120000,
  });
  await c.connect();
  try {
    const cutoffs = await sql.getSourceCutoffs(c);
    console.log('source cutoffs:', cutoffs);
    const to = cutoffs.ads_perf;
    const from = sql.addDays(to, -29);
    let rows = await sql.getCandidates(c, { from, to, limit: 40 });
    rows = await sql.attachSpecs(c, rows);
    rows = await sql.attachStock(c, rows);
    rows = await sql.attachShopifyConversions(c, rows, { from, to });
    console.log(`window ${from} → ${to}, ${rows.length} candidates`);
    rows.slice(0, 10).forEach((r) => {
      console.log(` - ${r.item_id} | ${(r.current_title || '(no title)').slice(0, 48)} | type=${r.product_type} | specs=${r.specs.length} | eligible=${r.feed_eligible.status} | impr=${r.perf_30d.impressions}`);
    });
  } finally { await c.end().catch(() => {}); }
}

/**
 * STEP 1 verification — proves WHICH database AUTH_DATABASE_URL reaches,
 * read-only, without printing the connection string.
 */
async function verify() {
  const { url, which } = appDbUrl();
  console.log(`[target] ${which}`);
  await withClient(url, async (c) => {
    const id = await c.query('SELECT current_database() AS db, current_user AS usr, current_schema() AS sch');
    console.log('  current_database :', id.rows[0].db);
    console.log('  current_user     :', id.rows[0].usr);
    console.log('  current_schema   :', id.rows[0].sch);

    // Is this the Ledsone operational DB by mistake?
    const led = await c.query(`
      SELECT to_regclass('google_ads.product_performance') AS google_ads,
             to_regclass('listings.shopify_listings')      AS listings`);
    const isLedsone = !!(led.rows[0].google_ads || led.rows[0].listings);
    console.log('  google_ads.product_performance :', led.rows[0].google_ads || 'absent');
    console.log('  listings.shopify_listings      :', led.rows[0].listings || 'absent');
    if (isLedsone) {
      console.log('\n  *** REQ5_APP_TARGET_IS_LEDSONE ***');
      console.log('  This is the Ledsone OPERATIONAL database. Req5 must NOT store workflow');
      console.log('  history here. Stopping — do not apply the migration.');
      throw new Error('REQ5_APP_TARGET_IS_LEDSONE');
    }
    console.log('  NOT the Ledsone operational DB :  confirmed');

    const mine = await c.query(`
      SELECT tablename FROM pg_tables
       WHERE schemaname='public' AND tablename LIKE 'thivajini_feed%' ORDER BY 1`);
    console.log(`  thivajini_feed_* tables        : ${mine.rows.length}`);
    mine.rows.forEach((r) => console.log('      -', r.tablename));

    const known = await c.query(`
      SELECT to_regclass('public.users') AS users_table,
             to_regclass('public.feed_optimization_tracker') AS existing_tracker`);
    console.log('  public.users                   :', known.rows[0].users_table || 'absent');
    console.log("  Sajeepan's feed_optimization_tracker :", known.rows[0].existing_tracker || 'absent');

    const others = await c.query(`
      SELECT tablename FROM pg_tables
       WHERE schemaname='public' AND tablename NOT LIKE 'thivajini_feed%' ORDER BY 1 LIMIT 30`);
    console.log('  other public tables            :',
      others.rows.length ? others.rows.map((r) => r.tablename).join(', ') : '(none)');
  });
}

const CMDS = { verify, precheck, migrate, 'migrate-status': migrateStatus, providers, candidates };

(async () => {
  const cmd = process.argv[2];
  if (!CMDS[cmd]) {
    console.error('usage: node scripts/feed-ops.js <' + Object.keys(CMDS).join('|') + '>');
    process.exit(1);
  }
  try { await CMDS[cmd](); } catch (e) {
    console.error('\n[ERROR]', e.message);
    process.exit(1);
  }
})();
