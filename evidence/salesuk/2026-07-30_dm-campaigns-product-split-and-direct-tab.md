# Evidence — DM Campaigns Product-ID Split (Sajeepan/Sonya) + Direct Tab Split

**Date:** 2026-07-30
**Files:** `reports/digital-marketing-member-pages/api/salesuk.js`, `pages/salesuk.html`, `api/assign-order.js`, `scripts/bulk-salesuk-refresh.js`, `api/data/salesuk-{dm-ad,sonya,sajeepan,organic,direct}-*.json`

## Purpose
Two separate but related requests from the user in the same session:
1. Sajeepan and Sonya (UK Ads team) each own specific Shopify product IDs. Orders for their products were landing in the "DM Campaigns" (DM-Ad) tab whenever the click also carried a DM-Ad campaign tag — the user wanted those split out by product ownership, same pattern as Mahima's DE product-scoping.
2. The Organic tab was catching "Direct" channel orders (no referrer, no UTM) — user wanted Direct broken out into its own tab.

## What Was Done

### Sajeepan/Sonya product-ID split
- Added `SAJEEPAN_PRODUCT_IDS_UK` (1,337 unique IDs) and `SONYA_PRODUCT_IDS_UK` (1,750 unique IDs) as `Set`s, plus `orderHasSajeepanProduct()`/`orderHasSonyaProduct()` helpers checking `lineItems[].variant.product.legacyResourceId`.
- Extended the Shopify GraphQL `ORDERS_QUERY` to fetch `variant { product { legacyResourceId } }` per line item (wasn't fetched before).
- `dm-ad`'s match rule now excludes any order containing a Sajeepan or Sonya product; `sajeepan`/`sonya`'s match rules gained an OR-clause: "would have matched DM-Ad's campaign rule AND contains my product."
- Real bug found: after the code deploy, live-tested and got 0 orders moved — traced to the dashboard's static-snapshot fast path (`api/data/salesuk-<group>-<month>.json`), which bypasses the live `GROUPS` logic entirely unless `?refresh=1`. Fixed by regenerating the `dm-ad`, `sonya`, `sajeepan` snapshots for all 7 months via `scripts/bulk-salesuk-refresh.js`.
- 3 product IDs appear in both lists as given by the user (`5359897903265`, `4417270055008`, `14927886680450`) — resolved by Sonya's priority position in `GROUPS` (checked before Sajeepan), flagged to user, not yet confirmed correct.

### Direct tab split
- `isOrganicMatch()` no longer treats channel `Direct` as Organic.
- New `direct` group added to `GROUPS`, checked before `organic`, matching `deriveChannelLabel(journey) === 'Direct'`.
- Initially built as a standalone page (`salesuk-direct.html`) with a `sales.html` nav link — user corrected this: removed the standalone page and nav link, added "Direct" as a group tab directly inside `salesuk.html` instead (all group tabs there already render dynamically from the API response, so no extra frontend work was needed beyond the tab button itself).
- Regenerated `organic` and `direct` snapshots for all 7 months.

## Verification (live curl, post-deploy)

**Sajeepan/Sonya split**, all 7 months, zero overlap between dm-ad/sonya/sajeepan:
```
2026-07 | dm-ad: 245 sonya: 667 sajeepan: 533 | overlaps dm/sy: 0 dm/sj: 0 sy/sj: 0 | moved->sonya: 253 moved->sajeepan: 138
```
(full 7-month table verified, all showing 0 overlap)

**Direct/Organic split**, all 7 months, zero overlap:
```
2026-07 | organic: 289 | direct: 380 | overlap: 0
```
(full 7-month table verified, all showing 0 overlap)

**Final placement check**:
```
salesuk.html (Direct tab embedded) http:200
salesuk-direct.html (should be gone) http:404
```

## Status
Live and verified. Pushed to both `staff/main` (via `staff-sync29` worktree) and `aios-2`.

## PASS/FAIL
PASS — zero duplication/overlap confirmed by construction and by live verification across all group pairs and all 7 months.

## Next Step
Resolve the Sajeepan/Sonya product-ID overlap (3 IDs) if the user disagrees with Sonya-wins. No other open items.
