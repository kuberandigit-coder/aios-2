# Evidence — Sonya Google Ads Tab: Monthly Snapshot Backfill (Jan-Jul)

**Date:** 2026-07-24
**Commits:** `855a190`, `2802162`, `beeaf24`, `533711d`

## Purpose
Complete/refresh Sonya's Google Ads sales-tab snapshots for the full Jan-Jul 2026 range (tab was added 2026-07-22, see `evidence/sales/2026-07-22_sonya-ads-tab-new-uk-staff-evidence.md`).

## What Was Done
- (`855a190`) Refreshed Feb-May snapshots.
- (`2802162`) Refreshed the July (live) snapshot.
- (`beeaf24`) Refreshed the January snapshot.
- (`533711d`) Refreshed the June snapshot — completes Jan-Jul coverage for the Sajeepan/Sonya/DM tab family.
- A new bulk regenerator script, `reports/digital-marketing-member-pages/scripts/bulk-sonya-refresh.js`, was added (uncommitted as of this sync) to run all 7 months sequentially with cooldowns, mirroring `bulk-sajeepan-refresh.js`.

## Files Changed
- `reports/digital-marketing-member-pages/api/data/sonya-uk-ads-sales-2026-0{1,2,3,4,5,6,7}.json`
- `reports/digital-marketing-member-pages/scripts/bulk-sonya-refresh.js` (new, untracked)

## Status
Snapshot commits: committed same day. Bulk-refresh script: present in working tree, not yet committed as of this sync.

## PASS/FAIL
PASS (reconstructed) for the committed snapshot refreshes. UNCOMMITTED for `bulk-sonya-refresh.js` — flag for user decision on whether to commit.

## Next Step
Decide whether to commit `bulk-sonya-refresh.js`.
