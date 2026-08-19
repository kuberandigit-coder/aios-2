## Purpose
Document the true root cause of muguntha.html's "loads slow / hangs for minutes" reports, discovered while investigating why Sonya's cost-breakdown popup showed £0.00 Transaction Fee for January 2025.

## Root cause
`reports/digital-marketing-member-pages/scripts/check-repo-sync.js` — the tool that's supposed to catch drift between aios-2 (source repo) and the Staff-requirements worktree (what Vercel actually deploys) — explicitly **skipped the `data/` directory** in its file listing (`if (entry.name === 'data' ... ) continue;`). This meant every session that only touched `api/data/*.json` static snapshot files (which `sales25.js`/`salesuk.js`/`muguntha.js` all read from for fast, non-live months) never got flagged as out-of-sync, even though the checker reported "FULLY IN SYNC" every time.

As a result, the deployed Staff-requirements worktree silently drifted for over 2 weeks:
- **174 snapshot files completely missing** — including `sales25-sonya-2025-07.json` through `-12.json`, all of `muguntha-dilaksi-*`/`muguntha-jefri-*`/`muguntha-kamsi-*` (Kamsi/Dilaksi/Jefri's ad-spend cost snapshots), and others.
- **69 more files present but stale** — including `sales25-sonya-2025-01.json` through `-06.json` and the equivalent Sajeepan files, all missing the `vat`/`transactionFee` fields added 2026-08-07 (they were last synced 2026-07-29, before that feature existed).

Effect: any month whose snapshot file was missing had no fast path — `handleGroup()` in `sales25.js`/`salesuk.js` falls through past the `fs.existsSync(staticPath)` check straight to a live Shopify order-journey scan (the same code path normally reserved for the current live month, documented to take 30-90s+). This is almost certainly the true explanation for the "random month hangs" investigated earlier the same day (2026-08-19) — concurrency tuning (5→3→2→1) and a 12s-timeout/1-retry resilience layer were added as mitigations before this was found, and while those remain reasonable defensive measures, they were treating a symptom, not the actual cause.

## Fix
1. Copied all 243 missing/stale `api/data/*.json` files from aios-2 (source of truth) into the Staff-requirements worktree.
2. Fixed `check-repo-sync.js` to stop skipping the `data/` directory, and to include `.json` files under `api/` generally (not just `.js`/`.html`). Also switched `.json` comparison to a binary-safe byte comparison instead of line-ending-normalized text comparison. File count checked went from 50 to 542.
3. Deployed. Live-verified: Sonya's January 2025 Transaction Fee now correctly shows £466.57 (was £0.00), and all 6 previously-hanging months (2025-07 through 2025-12) now respond in ~2s (was 15-30s+ hangs/timeouts).

## Files changed
- `reports/digital-marketing-member-pages/api/data/*.json` (243 files)
- `reports/digital-marketing-member-pages/scripts/check-repo-sync.js`

## Evidence
- Live-verified before/after: `/api/sales25?group=sonya&month=2025-01` — `transactionFee` went from absent (undefined → shown as £0.00 in the popup) to `466.57`.
- Live-verified all 6 previously-hanging months (2025-07 to 2025-12) now respond in 1.7-2.2s each.
- `check-repo-sync.js` re-run after the fix: "Files checked: 542 ... FULLY IN SYNC" (was 50 files checked before this fix, always reporting sync even when 243 files differed).
- Committed and pushed to both repos: Staff-requirements (commits 9fc031e, 09e2c09), aios-2 (commit 0cb3747, plus the checker fix).
- Deployed to production, verified live.

## Status
PASS — root cause found, fixed, and verified live. The checker gap that allowed this is also closed.

## Reviewer
Kuberan

## Next step
This same drift class could affect other snapshot-backed pages beyond muguntha.html/sales25.html (any page using the same static-snapshot pattern) — worth running `check-repo-sync.js` again after any future session that touches `api/data/` to confirm it stays caught going forward, since it's now covered.
