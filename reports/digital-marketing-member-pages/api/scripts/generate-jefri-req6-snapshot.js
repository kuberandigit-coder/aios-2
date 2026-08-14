#!/usr/bin/env node
/**
 * Generates api/data/jefri-req6-snapshot.json — every Jefri listing's
 * Image Update Date (fetched live from Shopify), Total Sales Since Update,
 * Pre-Update Baseline Sales, % Change, and Trend, precomputed.
 *
 * Why this exists (2026-08-14): Req6's table originally computed each
 * row's data on demand as it scrolled into view (IntersectionObserver ->
 * fn=jefri-req6&listingId=... per row). That worked, but re-did the same
 * Shopify + Postgres lookup every time anyone happened to scroll past a
 * listing. Kuberan asked for a snapshot instead — this script builds the
 * whole table's data ONCE on a schedule (see
 * .github/workflows/jefri-req6-snapshot-refresh.yml), and
 * api/requirement.js's jefri-req6-list handler serves the finished file
 * directly (same static-file-first pattern already used for
 * jefri-req4-mapping, mahima-req1, etc.).
 *
 * Grouped by parent Shopify PRODUCT, not by listing: all of one product's
 * variants share the same images (and therefore the same Image Update
 * Date) — one Shopify Admin API call per PRODUCT, not per listing. Of
 * ~8,127 Jefri listings, only ~1,220 unique parent products exist, so
 * this is the real unit of work.
 *
 * Talks to the live api/requirement.js?fn=jefri-req6-snapshot-batch
 * endpoint in a cursor loop (same "shell out to curl against the deployed
 * API" pattern as generate-snapshots.js, not a direct DB/Shopify
 * connection from this script) — each call processes a bounded batch of
 * parent products server-side, safely inside Vercel's 300s function
 * limit, and returns a `nextCursor` to continue from. Loops until
 * `nextCursor` is null, accumulating rows, then writes the file once at
 * the end (never a partial/half-built snapshot).
 *
 * Usage: node api/scripts/generate-jefri-req6-snapshot.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// NOTE: the raw digital-marketing-member-pages.vercel.app domain (used as
// the default elsewhere in this repo's other snapshot scripts) currently
// returns DEPLOYMENT_NOT_FOUND — confirmed live 2026-08-14. Defaulting to
// the working custom domain instead; the other hourly snapshot workflows
// may be silently failing for the same reason and are worth checking.
const BASE_URL = process.env.SNAPSHOT_BASE_URL || 'https://dm-dashboard.vintageinterior.co.uk';
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'jefri-req6-snapshot.json');
const BATCH_LIMIT = 80; // parent products per call — see handleJefriReq6SnapshotBatch's own comment for the 300s budget reasoning

function fetchJson(url, label) {
  process.stdout.write(`  ${label}: fetching...`);
  const started = Date.now();
  let raw;
  try {
    raw = execFileSync('curl', ['-s', '-m', '280', '--retry', '2', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
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
  if (data.error) {
    console.log(` FAILED (${data.error})`);
    return null;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(` done in ${secs}s (${(data.rows || []).length} rows, nextCursor=${data.nextCursor})`);
  return data;
}

function main() {
  console.log('Generating Jefri Req6 snapshot...');
  const allRows = [];
  let cursor = 0;
  let totalParents = null;
  let batchNum = 0;

  while (cursor !== null) {
    batchNum++;
    const url = `${BASE_URL}/api/requirement?fn=jefri-req6-snapshot-batch&cursor=${cursor}&limit=${BATCH_LIMIT}`;
    const data = fetchJson(url, `batch ${batchNum} (cursor=${cursor})`);
    if (!data) {
      console.error(`\nFailed at batch ${batchNum} (cursor=${cursor}) — aborting without writing a partial file.`);
      process.exitCode = 1;
      return;
    }
    allRows.push(...(data.rows || []));
    totalParents = data.totalParents;
    cursor = data.nextCursor;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    rows: allRows,
    meta: { total: allRows.length, totalParentProducts: totalParents },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`\nDone. ${allRows.length} rows across ${totalParents} parent products -> ${OUT_PATH}`);
}

main();
