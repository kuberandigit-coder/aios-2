#!/usr/bin/env node
/**
 * Hourly snapshot refresh for the current live month (2026-07).
 *
 * The sales.js handlers already serve from api/data/*-sales-<month>.json
 * whenever that file exists, for ANY month -- including the live one.
 * Historically no file existed for July, so every visitor triggered a slow
 * (30-45s) live Shopify fetch. This script fetches all 15 live tabs once
 * (with ?refresh=1, bypassing any cache) and overwrites their July snapshot
 * files, so visitors get an instant cached response instead. Meant to be
 * run on a schedule (see .github/workflows/hourly-july-snapshot-refresh.yml)
 * -- each run makes July "as fresh as the last run", not truly real-time.
 * The Refresh button on each tab still does a genuine live fetch on demand
 * (unaffected by this script).
 *
 * Usage: node api/scripts/generate-july-snapshots.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.SNAPSHOT_BASE_URL || 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'data');
const MONTH = '2026-07';

// query string -> snapshot filename prefix (must exactly match the
// staticPath naming each handler in api/sales.js already checks for).
const ENDPOINTS = [
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

async function main() {
  console.log(`Refreshing ${MONTH} snapshots for ${ENDPOINTS.length} tabs...`);
  let okCount = 0, failCount = 0;

  for (const { query, snapshotName } of ENDPOINTS) {
    const qs = (query ? query + '&' : '') + `month=${MONTH}&refresh=1`;
    const url = `${BASE_URL}/api/sales?${qs}`;
    process.stdout.write(`  ${snapshotName}: fetching...`);
    const started = Date.now();
    let raw;
    try {
      // Shells out to curl (see api/scripts/generate-snapshots.js for why:
      // node's fetch has been unreliable on slow >30s responses here).
      raw = execFileSync('curl', ['-s', '-m', '150', '--retry', '2', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
    } catch (e) {
      console.log(` FAILED (curl error: ${e.message})`);
      failCount++;
      continue;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.log(` FAILED (non-JSON response, ${raw.length} bytes)`);
      failCount++;
      continue;
    }
    if (!data.success) {
      console.log(` FAILED (${data.error || 'success:false'})`);
      failCount++;
      continue;
    }
    const outPath = path.join(DATA_DIR, `${snapshotName}-sales-${MONTH}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data));
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(` done in ${secs}s -> ${path.basename(outPath)}`);
    okCount++;
  }

  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) process.exitCode = 1;
}

main();
