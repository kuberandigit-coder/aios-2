#!/usr/bin/env node
'use strict';

// scripts/stpm-migrate.js
//
// REQ-DM-2026-08-MAHI01 — apply the Mahima Search Term -> Product Mapping (STPM)
// migration to the Dilaikshan Neon database.
//
// WHY THIS EXISTS
//   ARCHITECTURE.md and lib/stpm/repo.js both forbid DDL at request time: a Vercel
//   Function may be frozen, retried or duplicated at any moment, so schema changes
//   must never race inside a request. Migrations are therefore applied here, out of
//   band, by a developer.
//
// TARGET
//   process.env.DILAIKSHAN_NEON_DB and NOTHING ELSE. There is deliberately no
//   fallback chain (see lib/stpm/config.js for the reasoning). If the variable is
//   absent this script exits non-zero rather than quietly writing somewhere else.
//
// SAFETY
//   * The connection string is never printed, logged or echoed.
//   * Refuses to run if the target turns out to be the Ledsone operational DB.
//   * The migration itself is additive and re-runnable (IF NOT EXISTS throughout).
//
// USAGE
//   node scripts/stpm-migrate.js            # apply (idempotent)
//   node scripts/stpm-migrate.js --verify   # report state only, apply nothing

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION = path.join(__dirname, '..', 'db', 'migrations', '2026-08-21_005_mahima_stpm.sql');
const VERIFY_ONLY = process.argv.includes('--verify');

// Load .env.local when present so the script works the same way `vercel dev` does.
// Values are read into process.env and never printed.
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

    // Guard: this must never be the Ledsone operational database.
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

    const sql = fs.readFileSync(MIGRATION, 'utf8');
    await pool.query(sql);
    console.log(`applied         : ${path.basename(MIGRATION)}`);

    const after = await tableState(pool);
    console.log(`tables after    : ${describe(after)}`);

    if (!after.every(Boolean)) {
      console.error('FAIL: migration ran but not every expected table exists.');
      process.exit(4);
    }

    // Report row counts so a re-run is visibly non-destructive.
    for (const t of TABLES) {
      const r = await pool.query(`SELECT count(*)::int AS c FROM public.${t}`);
      console.log(`rows ${t.padEnd(22)}: ${r.rows[0].c}`);
    }

    console.log('OK: migration applied and verified.');
  } catch (err) {
    // Never surface the connection string; pg errors can embed it in some cases.
    const safe = String(err && err.message ? err.message : err).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, '[redacted]');
    console.error('FAIL: ' + safe);
    process.exit(5);
  } finally {
    await pool.end().catch(() => {});
  }
}

const TABLES = ['mahima_stpm_run', 'mahima_stpm_result', 'mahima_stpm_review'];

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
