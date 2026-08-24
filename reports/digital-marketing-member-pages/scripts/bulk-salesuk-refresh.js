#!/usr/bin/env node
// Bulk regenerator for salesuk.js group snapshots, one month at a time.
// Usage: node scripts/bulk-salesuk-refresh.js <month> [group1,group2,...]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'api', 'data');
const ALL_GROUPS = ['dm-ad', 'meta', 'sonya', 'sajeepan', 'sukirtha', 'direct', 'organic', 'cppc', 'thishoban', 'theekshy', 'thanishtika', 'not-assigned'];
const month = process.argv[2] || '2026-02';
const groups = process.argv[3] ? process.argv[3].split(',') : ALL_GROUPS;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchGroup(group) {
  const url = `${BASE_URL}/api/salesuk?group=${group}&month=${month}&refresh=1`;
  console.log(`[${group}] fetching...`);
  const started = Date.now();
  let raw;
  try {
    raw = execFileSync('curl', ['-s', '-m', '290', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  } catch (e) {
    console.log(`[${group}] FAILED (curl error: ${e.message})`);
    return false;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log(`[${group}] FAILED (non-JSON, ${raw.length} bytes): ${raw.slice(0, 200)}`);
    return false;
  }
  if (data.success === false || data.error) {
    console.log(`[${group}] FAILED (${data.error || 'success:false'})`);
    return false;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const outPath = path.join(DATA_DIR, `salesuk-${group}-${month}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data));
  const s = data.combinedSummary || {};
  console.log(`[${group}] done in ${secs}s -> ${path.basename(outPath)} | orders=${s.ordersCount} net=${s.netSales}`);
  return true;
}

async function main() {
  let okCount = 0, failCount = 0;
  for (const group of groups) {
    const ok = await fetchGroup(group);
    if (ok) okCount++; else failCount++;
    console.log(`  cooling down 15s before next group...`);
    await sleep(15000);
  }
  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
}

main();
