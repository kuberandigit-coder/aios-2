# Evidence — New Standalone `salesuk.html` / `api/salesuk.js` (Order-Level UK Review)

**Date:** 2026-07-27
**Commits:** `c672b86`, `9fc73c1`, `a8412e0`, `c78ac16`, `beeb4d3`

## Purpose
After discovering the main dashboard's per-staff UK tabs (Kamsi/Dilaksi/Sajeepan/Sonya/DM) can double-count the same order under overlapping definitions (48% overlap found in January), the user asked for a clean, separate page — deliberately **not** reusing `api/sales.js` — where every order is reviewed and assigned exactly once, by hand, with full order-level detail and session history.

## What Was Done
- (`c672b86`) New `pages/salesuk.html` + new `api/salesuk.js` (self-contained backend, own Shopify GraphQL query, own London-timezone month resolver, own order-level row builder — no shared code/state with `api/sales.js`). January tab → DM-Ad group tab: every order matching campaign `Shop_DM_PMax-46_AguAsset` or `Shop_DM_PMax-25`. Order-level rows (no per-product breakdown), expandable "Sessions" panel showing every session Shopify recorded (not just first-session). Nav link added to `home.html` only (not `index.html`, per explicit instruction).
- (`9fc73c1`) Performance fix: live scans were taking 90s+ and timing out. Bumped GraphQL page size 50→100 and added a static-snapshot fast path (same pattern as every other historical-month tab) — cut cold response from timeout to ~35s first-generation, ~2s once snapshotted.
- (`a8412e0`) DM-Ad January snapshot generated and committed (962 orders / £23,092.53 net; 819 from `Shop_DM_PMax-46_AguAsset` + 143 from `Shop_DM_PMax-25`).
- (`c78ac16`) Added a second group, "Meta" — refactored the single hardcoded DM-Ad handler into a `GROUPS` array checked in a **fixed priority order** (DM-Ad first, then Meta), so an order can never be assigned to more than one group's tab on this page by construction, not by convention. Meta matches campaigns "Sales Ads" / "Sales Ads – Copy" / "Sales Ads | Retargeting | Add to Cart" OR sources Facebook/Instagram/`android-app://m.facebook.com/` (case-insensitive), per the user's explicit list. Frontend generalized: header/labels/matching-rule text/CSV filename are now driven by the API response instead of hardcoded to DM-Ad.
- (`beeb4d3`) Meta January snapshot generated and committed (342 orders / £6,198.41 net).

## Files Changed
- `reports/digital-marketing-member-pages/api/salesuk.js` (new file)
- `reports/digital-marketing-member-pages/pages/salesuk.html` (new file)
- `reports/digital-marketing-member-pages/home.html` (nav link)
- `reports/digital-marketing-member-pages/vercel.json` (`api/salesuk.js` maxDuration: 300)
- `reports/digital-marketing-member-pages/api/data/salesuk-dm-ad-2026-01.json`, `salesuk-meta-2026-01.json` (new snapshots)

## Status
Deployed live and verified. Only January is wired up (per explicit scope); DM-Ad and Meta groups both live with fast static-snapshot loads. Feb-Jul not yet built for this page.

## PASS/FAIL
PASS — both groups verified live with correct order counts/net sales, and confirmed mutually exclusive by code construction (priority-ordered `GROUPS` array, first match wins).

## Next Step
Extend `SUPPORTED_MONTHS` in `api/salesuk.js` to Feb-Jul if the user wants the same standalone review for other months. Continue processing the remaining January groups from the first-session split (Direct, Organic Search, Referral, Email, "No Journey Data", etc.) into further tabs on this page as the user assigns them.
