#!/usr/bin/env node
/**
 * Unified snapshot-generation tool. Merges what used to be three separate
 * scripts (generate-snapshots.js, generate-july-snapshots.js,
 * generate-jefri-snapshots.js) into one, since they all did the same
 * curl-and-overwrite-a-json-file thing against different endpoints.
 *
 * Usage:
 *   node api/scripts/generate-snapshots.js postgres
 *     -> refreshes the api/requirement.js Postgres-backed tabs (Jefri
 *        Req1/Req2, Mahima Req1). Their in-memory caches reset on every
 *        cold start, so this is meant to run hourly (see
 *        .github/workflows/hourly-july-snapshot-refresh.yml or similar).
 *
 *   node api/scripts/generate-snapshots.js july
 *     -> refreshes the current live month (2026-07) tabs on sales.html,
 *        which otherwise trigger a slow 30-45s live Shopify fetch for
 *        every visitor. Meant to run hourly too.
 *
 *   node api/scripts/generate-snapshots.js <staff> [months...]
 *     -> one-off generator for a CLOSED month of a sales.html staff tab
 *        (e.g. sajeepan-ads, thasitha-ads). Omit months to generate every
 *        closed month at once.
 *
 * All three modes shell out to curl instead of node's fetch: on this
 * Windows environment, undici's fetch reliably drops slow (40-90s)
 * responses with ECONNRESET before they complete, while curl handles the
 * same request/TLS-renegotiation fine.
 *
 * Lives in api/scripts/ (not api/) and is excluded via .vercelignore so
 * Vercel never tries to deploy it as a serverless function.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.SNAPSHOT_BASE_URL || 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'data');

function fetchJson(url, label) {
  process.stdout.write(`  ${label}: fetching...`);
  const started = Date.now();
  let raw;
  try {
    raw = execFileSync('curl', ['-s', '-m', '150', '--retry', '2', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  } catch (e) {
    console.log(` FAILED (curl error: ${e.message})`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log(` FAILED (non-JSON response, ${raw.length} bytes)`);
    return null;
  }
  if (data.success === false || data.error) {
    console.log(` FAILED (${data.error || 'success:false'})`);
    return null;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(` done in ${secs}s`);
  return data;
}

// ===== mode: postgres (requirement.js, hourly) =====
// query string -> snapshot filename (must match the staticPath each
// handler in api/requirement.js checks for).
const POSTGRES_ENDPOINTS = [
  { fn: 'jefri-product-status', outFile: 'jefri-product-status-snapshot.json' },
  { fn: 'jefri-search-terms', outFile: 'jefri-search-terms-snapshot.json' },
  { fn: 'mahima-req1', outFile: 'mahima-req1-snapshot.json' },
  { fn: 'mahima-req2', outFile: 'mahima-req2-snapshot.json' },
];

function runPostgres() {
  console.log(`Refreshing ${POSTGRES_ENDPOINTS.length} Postgres-backed snapshots (api/requirement.js)...`);
  let okCount = 0, failCount = 0;
  for (const { fn, outFile } of POSTGRES_ENDPOINTS) {
    const url = `${BASE_URL}/api/requirement?fn=${fn}&refresh=1`;
    const data = fetchJson(url, fn);
    if (!data) { failCount++; continue; }
    fs.writeFileSync(path.join(DATA_DIR, outFile), JSON.stringify(data));
    console.log(`    -> ${outFile}`);
    okCount++;
  }
  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) process.exitCode = 1;
}

// ===== mode: july (sales.js, hourly, live month) =====
const JULY_MONTH = '2026-07';
const JULY_ENDPOINTS = [
  { query: 'entity=kamsi', snapshotName: 'kamsi' },
  { query: 'entity=dilaksi', snapshotName: 'dilaksi' },
  { query: 'entity=sukirtha-uk', snapshotName: 'sukirtha-uk' },
  { query: 'staff=mahima', snapshotName: 'mahima-de-organic' },
  { query: 'staff=mahima-ads-term', snapshotName: 'mahima-de-ads-term' },
  { query: 'staff=jeffri-ads', snapshotName: 'jeffri-de-ads' },
  { query: 'staff=jeffri-meta', snapshotName: 'jeffri-meta' },
  { query: 'staff=hetheesha-organic', snapshotName: 'hetheesha-fr-organic' },
  { query: 'staff=thivagini-ads', snapshotName: 'thivagini-fr-ads' },
  { query: 'staff=thasitha-ads', snapshotName: 'thasitha-de-ads' },
  { query: 'staff=sajeepan-ads', snapshotName: 'sajeepan-uk-ads' },
  { query: 'staff=theekshy-ads', snapshotName: 'theekshy-uk-ads' },
  { query: 'staff=sonya-ads', snapshotName: 'sonya-uk-ads' },
  { query: '', snapshotName: 'sukirtha-de-organic' },
  { query: 'type=email', snapshotName: 'sukirtha-de-email' },
];

function runJuly() {
  console.log(`Refreshing ${JULY_MONTH} snapshots for ${JULY_ENDPOINTS.length} tabs...`);
  let okCount = 0, failCount = 0;
  for (const { query, snapshotName } of JULY_ENDPOINTS) {
    const qs = (query ? query + '&' : '') + `month=${JULY_MONTH}&refresh=1`;
    const url = `${BASE_URL}/api/sales?${qs}`;
    const data = fetchJson(url, snapshotName);
    if (!data) { failCount++; continue; }
    const outPath = path.join(DATA_DIR, `${snapshotName}-sales-${JULY_MONTH}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data));
    console.log(`    -> ${path.basename(outPath)}`);
    okCount++;
  }
  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) process.exitCode = 1;
}

// ===== mode: <staff> [months...] (sales-sukirtha-de.js, one-off, closed months) =====
// Mirrors SUPPORTED_MONTHS / CURRENT_LIVE_MONTHS in api/sales-sukirtha-de.js.
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const CURRENT_LIVE_MONTHS = ['2026-07'];

// staff query value -> snapshot filename prefix (must match the
// `snapshotName` switch in handleOrganic() in api/sales-sukirtha-de.js,
// or the fixed 'sukirtha-de-email'/'sukirtha-uk-email' names for the
// other two handlers).
const SNAPSHOT_NAME_BY_STAFF = {
  'mahima': 'mahima-de-organic',
  'mahima-ads': 'mahima-de-ads',
  'jeffri-ads': 'jeffri-de-ads',
  'mahima-total': 'mahima-de-total',
  'mahima-ads-term': 'mahima-de-ads-term',
  'hetheesha-organic': 'hetheesha-fr-organic',
  'thivagini-ads': 'thivagini-fr-ads',
  'thasitha-ads': 'thasitha-de-ads',
  'sajeepan-ads': 'sajeepan-uk-ads',
  'theekshy-ads': 'theekshy-uk-ads',
  'sonya-ads': 'sonya-uk-ads',
  'sukirtha': 'sukirtha-de-organic',
};

function runStaffMonths(staff, monthArgs) {
  const snapshotName = SNAPSHOT_NAME_BY_STAFF[staff];
  if (!snapshotName) {
    console.error(`Unknown staff "${staff}". Add it to SNAPSHOT_NAME_BY_STAFF in this script first`
      + ' (must match the snapshotName mapping in api/sales-sukirtha-de.js).');
    process.exit(1);
  }
  const months = monthArgs.length ? monthArgs : SUPPORTED_MONTHS.filter(m => !CURRENT_LIVE_MONTHS.includes(m));
  console.log(`Generating snapshots for staff="${staff}" (${snapshotName}), months: ${months.join(', ')}`);

  for (const month of months) {
    if (CURRENT_LIVE_MONTHS.includes(month)) {
      console.log(`  ${month}: skipped (live month, never snapshotted)`);
      continue;
    }
    const url = `${BASE_URL}/api/sales-sukirtha-de?staff=${encodeURIComponent(staff)}&month=${encodeURIComponent(month)}&refresh=1`;
    const data = fetchJson(url, month);
    if (!data) continue;
    const outPath = path.join(DATA_DIR, `${snapshotName}-sales-${month}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data));
    console.log(`    -> ${path.basename(outPath)} (${data.meta.matchedOrders ?? data.meta.fullyOrganicOrders ?? '?'} matched orders)`);
  }
  console.log('Done. Redeploy (vercel --prod) so the new snapshot files are served.');
}

function main() {
  const [, , mode, ...rest] = process.argv;
  if (mode === 'postgres') return runPostgres();
  if (mode === 'july') return runJuly();
  if (mode) return runStaffMonths(mode, rest);
  console.error('Usage:');
  console.error('  node api/scripts/generate-snapshots.js postgres');
  console.error('  node api/scripts/generate-snapshots.js july');
  console.error('  node api/scripts/generate-snapshots.js <staff> [months...]');
  console.error('Known staff values:', Object.keys(SNAPSHOT_NAME_BY_STAFF).join(', '));
  process.exit(1);
}

main();
