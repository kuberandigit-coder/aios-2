// scripts/check-live-deploy.js
//
// Why this exists (2026-08-14): the "code is right on GitHub but wrong on
// the live site" bug. All 4 commits pushed to Staff-requirements during a
// session were confirmed synced between aios-2 and Staff-requirements
// (check-repo-sync.js said FULLY IN SYNC every time) and confirmed present
// in the git history of the `staff` remote — yet dm-dashboard.vintageinterior.co.uk
// kept serving an old version of pages/kuberan.html missing every change.
//
// Root cause: this Vercel project *is* connected to the Staff-requirements
// GitHub repo, but ANY successful `vercel --prod` deploy (CLI, from anyone's
// local checkout, however stale) immediately re-aliases the production
// domain — it does not check whether the CLI deploy's content is newer than
// the current git-triggered deployment. A stray/repeated manual `vercel
// --prod` from an outdated local copy silently overwrites correct,
// already-pushed-and-synced code on the live site with no error, no commit,
// and no trace in `git log`. check-repo-sync.js cannot catch this class of
// bug because it only compares the two *local* repos to each other, never
// to what's actually live.
//
// This script closes that gap: it fetches a handful of known "canary"
// strings from the live pages/*.html files served at
// dm-dashboard.vintageinterior.co.uk and diffs them against the same files
// in the local Staff-requirements worktree. Run it after every push that
// touches api/ or pages/ files, and again a minute later once the deploy
// has had time to land. If it reports MISMATCH, immediately run
// `vercel --prod` from a known-good, up-to-date worktree (see
// staff-req-sync3) to re-assert the correct content — do not assume a
// GitHub push alone is enough.
//
// IMPORTANT — this cuts both ways (learned the hard way same day, 2026-08-14):
// "known-good" means "matches git HEAD", NOT "definitely the most complete
// version". Piranav has deployed features (Staff ID Performance's
// Jackson/Sajeepan/Sonya tabs) straight to production via `vercel --prod`
// from his own local files WITHOUT ever committing them to GitHub. My first
// fix for this exact bug — redeploying from a clean git-tracked worktree —
// silently reverted his uncommitted feature back down to a 2-tab version,
// because git had no record of it. Before redeploying "the correct code",
// diff production's CURRENT content against git HEAD for every canary
// below, not just the one you're actively fixing — a MISMATCH can mean
// production has something newer that git is missing, not just something
// stale. If suspected, recover the live file via `vercel api
// /v6/deployments/<id>/files` + `/v7/.../files/<uid>` (base64-decode the
// `data` field) before overwriting it, and commit the recovered version to
// git so this can't happen again for that feature specifically.

const https = require('https');
const fs = require('fs');
const path = require('path');

const LIVE_BASE = 'https://dm-dashboard.vintageinterior.co.uk';
const REPO_ROOT = path.join(__dirname, '..');

// Add a canary string here any time you ship a change you want this script
// to be able to detect on the live site. Keep old entries — they're free
// regression checks for prior fixes.
const CANARIES = [
  { file: 'pages/kuberan.html', mustContain: 'EOD Admin' },
  { file: 'pages/kuberan.html', mustContain: 'Performance Analysis' },
  { file: 'pages/piranav.html', mustContain: 'Blog Tool' },
  { file: 'pages/muguntha.html', mustContain: "mg-embed" },
  { file: 'pages/staff-id-performance.html', mustContain: 'data-staff="sonya"' },
  { file: 'pages/staff-id-performance.html', mustContain: 'data-staff="sajeepan"' },
  { file: 'pages/staff-id-performance.html', mustContain: 'data-staff="jackson"' },
];

function fetchLive(urlPath) {
  return new Promise((resolve, reject) => {
    https.get(LIVE_BASE + '/' + urlPath, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Live deploy check —', LIVE_BASE);
  let anyFail = false;

  for (const c of CANARIES) {
    const localPath = path.join(REPO_ROOT, c.file);
    if (!fs.existsSync(localPath)) {
      console.log('  SKIP (no local file):', c.file);
      continue;
    }
    const localContent = fs.readFileSync(localPath, 'utf8');
    if (!localContent.includes(c.mustContain)) {
      console.log('  WARN local file no longer contains canary — update CANARIES:', c.file, '/', c.mustContain);
      continue;
    }
    const liveContent = await fetchLive(c.file);
    const ok = liveContent.includes(c.mustContain);
    console.log(' ', ok ? 'OK  ' : 'FAIL', c.file, '—', c.mustContain);
    if (!ok) anyFail = true;
  }

  if (anyFail) {
    console.log('\nMISMATCH — live site does not match the local/pushed code.');
    console.log('Fix: cd into a known-good, up-to-date Staff-requirements checkout and run `vercel --prod`.');
    process.exit(1);
  }
  console.log('\nLIVE SITE MATCHES LOCAL CODE.');
}

main().catch((e) => { console.error(e); process.exit(1); });
