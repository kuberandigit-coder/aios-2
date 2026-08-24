#!/usr/bin/env node
'use strict';

// scripts/lens-keywords-migrate.js
//
// REQ-DM-2026-08-SAJE01 — apply the Automation Keyword Finder (Phase 1)
// migration to the Dilaikshan Neon database. Copied in structure from the
// proven precedent, scripts/stpm-migrate.js.
//
// WHY THIS EXISTS
//   lib/lens-keywords/repo.js forbids DDL at request time: a Vercel Function
//   may be frozen, retried or duplicated at any moment, so schema changes
//   must never race inside a request. Migrations are applied here, out of
//   band, by a developer.
//
// TARGET
//   process.env.DILAIKSHAN_NEON_DB and NOTHING ELSE — same app DB as
//   mahima_stpm_*, different table prefix (google_lens_keyword_*). There is
//   deliberately no fallback chain (see lib/lens-keywords/config.js). If the
//   variable is absent this script exits non-zero rather than quietly
//   writing somewhere else.
//
// SAFETY
//   * The connection string is never printed, logged or echoed.
//   * Refuses to run if the target turns out to be the Ledsone operational DB.
//   * The migration itself is additive and re-runnable (IF NOT EXISTS throughout).
//
// USAGE
//   node scripts/lens-keywords-migrate.js            # apply (idempotent)
//   node scripts/lens-keywords-migrate.js --verify   # report state only, apply nothing

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS = [
  path.join(__dirname, '..', 'db', 'migrations', '2026-08-24_006_sajeepan_lens_keywords.sql'),
  path.join(__dirname, '..', 'db', 'migrations', '2026-08-24_007_sajeepan_lens_keywords_full.sql'),
  path.join(__dirname, '..', 'db', 'migrations', '2026-08-24_008_sajeepan_lens_keywords_automation.sql'),
];
const VERIFY_ONLY = process.argv.includes('--verify');

function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (val.length > 1 && val[0] === '"' && val[val.length - 1] === '"') val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const connectionString = process.env.DILAIKSHAN_NEON_DB;
  if (!connectionString) {
    console.error('FAIL: DILAIKSHAN_NEON_DB is not set.');
    console.error('      Run `vercel env pull .env.local --environment=production`');
    console.error('      or export the variable. No other database will be used.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 20000,
  });

  try {
    const who = await pool.query('SELECT current_database() AS db, current_user AS usr');
    console.log(`target database : ${who.rows[0].db}`);
    console.log(`target user     : ${who.rows[0].usr}`);

    const led = await pool.query(
      "SELECT count(*)::int AS c FROM information_schema.schemata WHERE schema_name IN ('google_ads','listings')"
    );
    if (led.rows[0].c > 0) {
      console.error('FAIL: DILAIKSHAN_NEON_DB resolves to the Ledsone operational database.');
      console.error('      Refusing to apply application migrations there.');
      process.exit(2);
    }

    const before = await tableState(pool);
    console.log(`tables before   : ${describe(before)}`);

    if (VERIFY_ONLY) {
      console.log('verify-only: no changes applied.');
      process.exit(before.every(Boolean) ? 0 : 3);
    }

    for (const m of MIGRATIONS) {
      const sql = fs.readFileSync(m, 'utf8');
      await pool.query(sql);
      console.log(`applied         : ${path.basename(m)}`);
    }

    const after = await tableState(pool);
    console.log(`tables after    : ${describe(after)}`);

    if (!after.every(Boolean)) {
      console.error('FAIL: migration ran but not every expected table exists.');
      process.exit(4);
    }

    for (const t of TABLES) {
      const r = await pool.query(`SELECT count(*)::int AS c FROM public.${t}`);
      console.log(`rows ${t.padEnd(34)}: ${r.rows[0].c}`);
    }

    console.log('OK: migration applied and verified.');
  } catch (err) {
    const safe = String(err && err.message ? err.message : err).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, '[redacted]');
    console.error('FAIL: ' + safe);
    process.exit(5);
  } finally {
    await pool.end().catch(() => {});
  }
}

const TABLES = [
  'google_lens_keyword_run',
  'google_lens_keyword_run_product',
  'google_lens_keyword_competitor_result',
  'google_lens_keyword_provider_attempt',
  'google_lens_keyword_quota_snapshot',
  'google_lens_keyword_competitor_review',
  'google_lens_keyword_phase2_result',
  'google_lens_keyword_candidate',
  'google_lens_keyword_planner_suggestion',
  'google_lens_keyword_attribute_validation',
  'google_lens_keyword_final_title',
  'google_lens_keyword_final_alt_text',
  'google_lens_keyword_final_ads_keyword',
  'google_lens_keyword_search_cache',
  'google_lens_keyword_weekly_run',
  'google_lens_keyword_generation',
];

async function tableState(pool) {
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name = ANY($1::text[])`,
    [TABLES]
  );
  const found = new Set(r.rows.map((x) => x.table_name));
  return TABLES.map((t) => found.has(t));
}

function describe(state) {
  return TABLES.map((t, i) => `${t}=${state[i] ? 'present' : 'absent'}`).join(', ');
}

main();
