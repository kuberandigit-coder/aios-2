#!/usr/bin/env node
/**
 * Hourly snapshot refresh for Jefri Req1 (product-status) and Req2
 * (search-terms), both Postgres-backed (google_ads schema). Same reasoning
 * as generate-july-snapshots.js: the in-memory caches on these two
 * handlers reset on every cold start, so the first visitor after a cold
 * start still pays the live-query cost. This script fetches both with
 * ?refresh=1 (bypassing any cache) and overwrites their static snapshot
 * files, which the handlers check before falling back to a live query.
 *
 * Usage: node api/scripts/generate-jefri-snapshots.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.SNAPSHOT_BASE_URL || 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'data');

const ENDPOINTS = [
  { fn: 'jefri-product-status', outFile: 'jefri-product-status-snapshot.json' },
  { fn: 'jefri-search-terms', outFile: 'jefri-search-terms-snapshot.json' },
];

async function main() {
  console.log(`Refreshing ${ENDPOINTS.length} Jefri Postgres snapshots...`);
  let okCount = 0, failCount = 0;

  for (const { fn, outFile } of ENDPOINTS) {
    const url = `${BASE_URL}/api/requirement?fn=${fn}&refresh=1`;
    process.stdout.write(`  ${fn}: fetching...`);
    const started = Date.now();
    let raw;
    try {
      raw = execFileSync('curl', ['-s', '-m', '120', '--retry', '2', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
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
    if (data.success === false || data.error) {
      console.log(` FAILED (${data.error || 'success:false'})`);
      failCount++;
      continue;
    }
    const outPath = path.join(DATA_DIR, outFile);
    fs.writeFileSync(outPath, JSON.stringify(data));
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(` done in ${secs}s -> ${outFile}`);
    okCount++;
  }

  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
  if (failCount > 0) process.exitCode = 1;
}

main();
