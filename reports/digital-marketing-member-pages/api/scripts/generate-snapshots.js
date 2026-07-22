#!/usr/bin/env node
/**
 * Permanent snapshot-generation tool for sales.html staff tabs.
 *
 * Every closed-month tab (Kamsi, Sukirtha, Mahima, Jeffri, Hetheesha,
 * Thivagini, Thasitha, Sajeepan, ...) is slow on first live fetch because
 * the API re-pulls every order in the whole store for that month. The fix
 * used everywhere on this page is a static snapshot JSON file per closed
 * month, served instead of a live Shopify fetch (see the `staticPath`
 * checks in api/sales.js).
 *
 * Instead of hand-running curl commands per month whenever a new staff
 * member is added, run this once:
 *
 *   node api/scripts/generate-snapshots.js <staff> [months...]
 *
 * Examples:
 *   node api/scripts/generate-snapshots.js sajeepan-ads
 *     -> generates all CLOSED months (skips the live month automatically)
 *   node api/scripts/generate-snapshots.js sajeepan-ads 2026-03 2026-04
 *     -> generates just those two months
 *
 * <staff> must match one of the `staff=` query values the API already
 * understands (thasitha-ads, sajeepan-ads, hetheesha-organic, etc.) —
 * this script does not add new attribution logic, only automates
 * snapshot generation for whatever staff modes already exist.
 *
 * Lives in api/scripts/ (not api/) and is excluded via .vercelignore so
 * Vercel never tries to deploy it as a serverless function — it has no
 * module.exports handler and is only ever run manually via `node`.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.SNAPSHOT_BASE_URL || 'https://digital-marketing-member-pages.vercel.app';
const DATA_DIR = path.join(__dirname, '..', 'data');

// Mirrors SUPPORTED_MONTHS / CURRENT_LIVE_MONTHS in api/sales-sukirtha-de.js.
// Update this one place when a new month opens — every future snapshot run
// (for any staff member) then automatically skips the new live month.
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

async function main() {
  const [, , staff, ...monthArgs] = process.argv;
  if (!staff) {
    console.error('Usage: node scripts/generate-snapshots.js <staff> [months...]');
    console.error('Known staff values:', Object.keys(SNAPSHOT_NAME_BY_STAFF).join(', '));
    process.exit(1);
  }
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
    process.stdout.write(`  ${month}: fetching...`);
    const started = Date.now();
    // Shells out to curl rather than using node's built-in fetch: on this
    // Windows environment, node's undici fetch reliably drops these slow
    // (40-90s) responses with ECONNRESET before they complete, while curl
    // handles the same request/TLS-renegotiation fine.
    let raw;
    try {
      raw = execFileSync('curl', ['-s', '-m', '150', '--retry', '2', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
    } catch (e) {
      console.log(` FAILED (curl error: ${e.message})`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.log(` FAILED (non-JSON response, ${raw.length} bytes)`);
      continue;
    }
    if (!data.success) {
      console.log(` FAILED (${data.error || 'success:false'})`);
      continue;
    }
    const outPath = path.join(DATA_DIR, `${snapshotName}-sales-${month}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data));
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(` done in ${secs}s -> ${path.basename(outPath)} (${data.meta.matchedOrders ?? data.meta.fullyOrganicOrders ?? '?'} matched orders)`);
  }
  console.log('Done. Redeploy (vercel --prod) so the new snapshot files are served.');
}

main();
