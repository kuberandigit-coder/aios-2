#!/usr/bin/env node
// Bulk regenerator for DM's snapshots (same pattern as bulk-sajeepan/sonya).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'api', 'data');
const MONTHS = (process.argv[2] ? process.argv[2].split(',') : ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
const LIVE_MONTH = '2026-07';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchMonth(month) {
  const isLive = month === LIVE_MONTH;
  const url = `${BASE_URL}/api/sales?staff=dm-ads&month=${month}&refresh=1`;
  console.log(`[${month}] fetching...`);
  const started = Date.now();
  let raw;
  try {
    raw = execFileSync('curl', ['-s', '-m', '290', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  } catch (e) {
    console.log(`[${month}] FAILED (curl error: ${e.message})`);
    return false;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log(`[${month}] FAILED (non-JSON, ${raw.length} bytes): ${raw.slice(0, 200)}`);
    return false;
  }
  if (data.success === false || data.error) {
    console.log(`[${month}] FAILED (${data.error || 'success:false'})`);
    return false;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const outPath = path.join(DATA_DIR, `dm-uk-ads-sales-${month}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data));
  const s = data.combinedSummary || {};
  console.log(`[${month}] done in ${secs}s -> ${path.basename(outPath)} | orders=${s.ordersCount} net=${s.netSales} ${isLive ? '(live month)' : ''}`);
  return true;
}

async function main() {
  let okCount = 0, failCount = 0;
  for (const month of MONTHS) {
    const ok = await fetchMonth(month);
    if (ok) okCount++; else failCount++;
    console.log(`  cooling down 20s before next month...`);
    await sleep(20000);
  }
  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
}

main();
