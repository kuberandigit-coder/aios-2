---
title: Theekshy + Sonya No-Journey-Data Reassignment Analysis (Google Ads Click Evidence)
date: 2026-07-22
type: daily-doc
status: THEEKSHY REVERTED (pending admin permission) / SONYA NOT IMPLEMENTED (pending user decision)
---

# Summary

Same-day analysis-and-build session (not tied to a git commit — nothing here was ever committed) investigating whether orders sitting in Kamsi's/Dilaksi's "No Journey Data" sales pool actually had real Google Ads click evidence pointing to Theekshy's or Sonya's campaigns instead, using a 90-day pre-purchase attribution window against real Shopify order data.

# Theekshy — built, deployed, then reverted same day

Found **19 real Shopify orders** (Mar–Jun 2026) in Kamsi's/Dilaksi's "No Journey Data" pool with genuine Google Ads click evidence from Theekshy's 2 tightly-scoped campaigns (`Pmax | Theekshy | Shoptimised | THEE_MYSTERY`, `Pmax UK | Theekshy | Shoptimised | THEE_GEMS`). Match rate: 18 of ~380 unattributed orders (~5%) — small and credible, not overlap-by-chance.

Implemented in `reports/digital-marketing-member-pages/api/sales.js`:
- `THEEKSHY_NOJOURNEY_ORDERS` Set (order names) declared above the merged IIFE modules.
- Excluded from `dilaksiHandlerModule`/`kamsiHandlerModule` classification loops.
- Added to Theekshy's handler as a distinct channel: `campaign = 'No Journey Data (Ad-Click Matched)'`.
- `source.scope` text updated to document the reassignment.

Deployed live, then **explicitly rolled back by the user** the same day: *"change the theeksy code for now we will do later with the admin permission."* Reverted via `git checkout --` (change had never been committed), redeployed, all 4 affected static snapshots (Theekshy Mar/Apr/May/Jun) regenerated back to original state and redeployed. Live-verified March back to `matched: 0`, matching pre-fix behavior. Nothing was ever committed to git or synced to the shared `Staff-requirements` repo — revert is clean with zero residue.

**The 19 identified orders:** `#LED49171`, `#54G9BJB7NY` (Mar); `#LED49673`, `#LED51370`, `#LED50369`, `#LED52131` (Apr); `#88A4BB3H5N`, `#LED54430`, `#LED52464`, `#LED52659`, `#LED52950`, `#LED54158`, `#LED54452` (May); `#LED54826`, `#LED56049`, `#PF48QU6BYG`, `#LED56735`, `#BJPX782UAF`, `#KSNPA58D44` (Jun).

# Sonya — analyzed, NOT implemented

Same cross-reference approach applied to Sonya's campaigns. Result: Sonya runs **19 broad PMax/Shopping campaigns** covering **5,759 distinct products with clicks** — nearly the whole store catalog. Match rate: **84 of ~192 unattributed orders (~44%)** — far too high to represent real ad influence; at that campaign breadth almost anything overlaps by chance. Contrast with Theekshy's narrow 2-campaign scope, which produced a credible ~5% rate.

| Month | Dilaksi NJ | Dilaksi Matched | Kamsi NJ | Kamsi Matched |
|---|---|---|---|---|
| Mar | 51 | 11 | 64 | 23 |
| Apr | 48 | 8 | 58 | 16 |
| May | 27 | 7 | 28 | 7 |
| Jun | 41 | 5 | 47 | 14 |

**Not implemented.** Full 84-order list was written only to a non-durable scratch file (`C:\Users\PC\OneDrive\Desktop\theekshy_analysis\sonya_all_matched.json`) — will need re-running if that file is gone when this is picked back up. User said "we will work on tomorrow" without picking one of the options discussed (leave as-is / apply a stricter signal to cut the false-positive rate down / other approach).

# Status
- **Theekshy:** REVERTED — do not re-implement until the "admin permission" question the user referenced is confirmed resolved. Methodology and order list above are still valid and reusable once cleared.
- **Sonya:** NOT IMPLEMENTED — do not implement a blanket reassignment from the current 84-order list; it would very likely misattribute real Kamsi/Dilaksi organic sales to Sonya. Needs a user decision on approach first.

# Linked files
`evidence/sales/2026-07-22_theekshy-sonya-nojourneydata-reassignment-evidence.md`
`validation/sales/2026-07-22_theekshy-sonya-nojourneydata-reassignment-validation.md`
`closure/sales/2026-07-22_theekshy-sonya-nojourneydata-reassignment-closure.md`
