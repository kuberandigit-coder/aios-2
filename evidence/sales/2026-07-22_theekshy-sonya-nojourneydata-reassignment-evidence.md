# Evidence — Theekshy + Sonya No-Journey-Data Reassignment Analysis

**Date:** 2026-07-22
**Mode:** Investigation + same-day build/deploy/revert for Theekshy; investigation only for Sonya. Nothing here was ever committed to git.

## Method (both staff)
Cross-referenced Kamsi's/Dilaksi's "No Journey Data" orders (Mar–Jun 2026) against real Google Ads product-click evidence for each staff member's campaigns, using a 90-day pre-purchase attribution window per order — same class of method already used and trusted elsewhere in this dashboard (e.g. Thivagini's channel-balance fix, per `docs/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment.md`).

## Theekshy — implementation detail
- Campaigns checked: `Pmax | Theekshy | Shoptimised | THEE_MYSTERY`, `Pmax UK | Theekshy | Shoptimised | THEE_GEMS` (2 campaigns, 93–386 distinct products with clicks per month window — narrow scope).
- Match: 18 of ~380 unattributed Kamsi/Dilaksi orders (~5%) had real click evidence from these campaigns within 90 days pre-purchase.
- Code change (in `reports/digital-marketing-member-pages/api/sales.js`, never committed):
  - `THEEKSHY_NOJOURNEY_ORDERS` Set of order names, declared above the merged IIFE modules.
  - `if (THEEKSHY_NOJOURNEY_ORDERS.has(order.name)) continue;` added to `dilaksiHandlerModule` and `kamsiHandlerModule` classification loops.
  - Theekshy's handler (`staff === 'theekshy-ads'`) given a new distinct channel: `campaign = 'No Journey Data (Ad-Click Matched)'`.
  - `source.scope` text updated to describe the reassignment.
- Deployed live, then reverted the same day per explicit user instruction: *"change the theeksy code for now we will do later with the admin permission."*
- Revert method: `git checkout --` on the file (change had never been committed, so this cleanly restored the pre-change version). All 4 static snapshots (`api/data/theekshy-uk-ads-sales-2026-0{3,4,5,6}.json`) regenerated back to original values and redeployed.
- Live-verified post-revert: March back to `matched: 0`, matching original pre-fix behavior exactly.
- Confirmed zero residue: nothing committed to git, nothing synced to the shared `Staff-requirements` repo, Kamsi's/Dilaksi's own snapshots untouched (exclusion logic reverted before their snapshots needed regenerating).

## The 19 orders identified for Theekshy (Mar–Jun 2026)
`#LED49171`, `#54G9BJB7NY` (March); `#LED49673`, `#LED51370`, `#LED50369`, `#LED52131` (April); `#88A4BB3H5N`, `#LED54430`, `#LED52464`, `#LED52659`, `#LED52950`, `#LED54158`, `#LED54452` (May); `#LED54826`, `#LED56049`, `#PF48QU6BYG`, `#LED56735`, `#BJPX782UAF`, `#KSNPA58D44` (June).

## Sonya — analysis only, not implemented
- Campaigns checked: 19 broad PMax/Shopping campaigns, covering 5,759 distinct products with clicks in the window — near-full store catalog breadth.
- Match: 84 of ~192 unattributed Kamsi/Dilaksi orders (~44%) had some click evidence — rejected as not credible, since at this campaign breadth almost any order will overlap by chance.
- Raw month-by-month counts:

| Month | Dilaksi NJ | Dilaksi Matched | Kamsi NJ | Kamsi Matched |
|---|---|---|---|---|
| Mar | 51 | 11 | 64 | 23 |
| Apr | 48 | 8 | 58 | 16 |
| May | 27 | 7 | 28 | 7 |
| Jun | 41 | 5 | 47 | 14 |

- Full 84-order list exists only in a non-durable scratch file: `C:\Users\PC\OneDrive\Desktop\theekshy_analysis\sonya_all_matched.json` — not copied into this repo's AIOS folders, will need re-running if that scratch file is unavailable when the work resumes.
- No code was written or deployed for Sonya. Options discussed but not decided: (1) leave as-is, (2) apply a stricter signal (e.g. only her most product-specific campaigns, or require multiple corroborating clicks near the order date) to bring the false-positive rate down toward Theekshy's ~5%, (3) another approach. User: "we will work on tomorrow."

## Status
Theekshy: REVERTED, PENDING admin permission before re-applying.
Sonya: NOT IMPLEMENTED, PENDING user decision on approach.
