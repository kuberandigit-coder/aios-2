// scripts/check-repo-sync.js — compares every api/*.js, pages/*.html, and
// api/data/*.json file between this repo (aios-2) and the Staff-requirements
// worktree, byte for byte (ignoring line-ending style). Vercel deploys from
// Staff-requirements, not aios-2, so any file that's edited in one repo and
// not pushed to the other silently breaks production while looking fine in
// local dev/aios-2.
//
// This exact bug has recurred FOUR times now (Jefri Req4 handler, hourly
// snapshot cron, Jefri Req5 handler, and — the worst instance, 2026-08-19 —
// 243 api/data/*.json static snapshot files that had silently drifted for
// over 2 weeks because this checker used to explicitly skip the `data/`
// directory entirely, meaning every previous "FULLY IN SYNC" result was
// wrong for any session that only touched snapshot data. 174 snapshot files
// were completely missing from the deployed worktree (forcing live-query
// fallbacks that intermittently hung — this is almost certainly what caused
// the "random month" performance hangs investigated the same day), 69 more
// had stale content. Run this after any session that touches api/, pages/,
// or api/data/ files, before considering the work "done":
//
//   node scripts/check-repo-sync.js [path-to-staff-requirements-worktree]
//
// Defaults to C:/Users/PC/OneDrive/Desktop/staff-req-sync3 if no path given.
// Exits with a non-zero code if anything is missing or mismatched, so it
// can also be used as a pre-flight check.

const fs = require('fs');
const path = require('path');

const A = path.join(__dirname, '..'); // this repo's digital-marketing-member-pages folder
const B = process.argv[2] || 'C:/Users/PC/OneDrive/Desktop/staff-req-sync3';

if (!fs.existsSync(B)) {
  console.error('Staff-requirements worktree not found at: ' + B);
  console.error('Pass the correct path as an argument.');
  process.exit(2);
}

function listFiles(dir, base) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) out = out.concat(listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

const apiFiles = listFiles(path.join(A, 'api'), 'api').filter((f) => f.endsWith('.js') || f.endsWith('.json'));
const pageFiles = listFiles(path.join(A, 'pages'), 'pages').filter((f) => f.endsWith('.html'));
const allFiles = [...apiFiles, ...pageFiles];

const mismatches = [];
const missingInB = [];
for (const rel of allFiles) {
  const pA = path.join(A, rel);
  const pB = path.join(B, rel);
  if (!fs.existsSync(pB)) { missingInB.push(rel); continue; }
  const bufA = fs.readFileSync(pA);
  const bufB = fs.readFileSync(pB);
  // Binary-safe comparison for .json (line-ending normalization would
  // corrupt any \r\n that's meaningfully part of a JSON string value,
  // however unlikely) — only normalize line endings for .js/.html.
  if (rel.endsWith('.json')) {
    if (!bufA.equals(bufB)) mismatches.push(rel);
  } else {
    const cA = bufA.toString('utf8').replace(/\r\n/g, '\n');
    const cB = bufB.toString('utf8').replace(/\r\n/g, '\n');
    if (cA !== cB) mismatches.push(rel);
  }
}

console.log('aios-2 vs Staff-requirements — repo sync check');
console.log('Files checked: ' + allFiles.length);
console.log('Missing in Staff-requirements: ' + missingInB.length);
missingInB.forEach((f) => console.log('  MISSING: ' + f));
console.log('Content mismatches: ' + mismatches.length);
mismatches.forEach((f) => console.log('  DIFF: ' + f));

if (missingInB.length === 0 && mismatches.length === 0) {
  console.log('FULLY IN SYNC');
  process.exit(0);
} else {
  console.log('OUT OF SYNC — copy the files above from aios-2 into the Staff-requirements worktree, commit, and push before ending the session.');
  process.exit(1);
}
