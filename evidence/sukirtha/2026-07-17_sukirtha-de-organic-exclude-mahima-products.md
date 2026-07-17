# Sukirtha — DE Organic: Exclude Mahima-owned product IDs

**Date:** 2026-07-17
**Purpose:** Sukirtha's DE Organic sales tab (`ledsone.de`, store-wide, no product filter) was counting sales for ~656 product IDs that are actually owned by Mahima (a different team member), not Sukirtha. User supplied the exact ID list to exclude.

## What was built
### `reports/digital-marketing-member-pages/api/sales-sukirtha-de-organic.js`
- Added `MAHIMA_EXCLUDED_PRODUCT_IDS` (Set of 656 numeric product IDs, as supplied by user).
- In `buildSukirthaOrderRow`, each line item's `productId` (`li.variant.product.legacyResourceId`) is checked against the set — matching line items are skipped entirely (excluded at line-item level, not order level, so an order with a mix of Sukirtha and Mahima products still counts its non-Mahima items).
- Orders left with zero remaining line items after exclusion are dropped (existing `if (!items.length) return null` behavior, unchanged).
- Applies to the live-fetch path (used for July 2026, the current live month) automatically — no extra code needed beyond the line-item filter.

### Static snapshots (Jan–Jun 2026)
- `api/data/sukirtha-de-organic-sales-2026-0{1..6}.json` are served as-is by the handler (no recomputation), so they needed to be reprocessed directly.
- Ran a one-off script (created and deleted after use) that: filtered `matchedItems` on each cached order to drop Mahima product IDs, dropped orders left empty, and recomputed every summary (`summary`, `firstSessionOrganicSummary`, `combinedSummary`, `directSummary`, `referralSummary`, `noJourneySummary`, `aiSummary`) using the exact same `summarizeRows` logic as the live handler.
- Added `meta.mahimaExclusionApplied: true` and `meta.mahimaExcludedLineItems: <count>` to each snapshot for traceability.

## Verification performed (production)
- Deployed via `vercel --prod --yes`.
- Confirmed `sales-sukirtha-de-organic?month=2026-01` (static snapshot) on prod returns `meta.mahimaExcludedLineItems: 170` and the recomputed `summary`.
- Confirmed `sales-sukirtha-de-organic?month=2026-07&refresh=1` (live Shopify fetch) on prod returns 0 Mahima product IDs present anywhere in `allSukirthaOrders[*].matchedItems`.

## Line items removed per month (static snapshots)
| Month | Line items removed | Orders remaining |
|-------|--------------------|-------------------|
| 2026-01 | 170 | 131 |
| 2026-02 | 129 | 131 |
| 2026-03 | 137 | 178 |
| 2026-04 | 93 | 145 |
| 2026-05 | 91 | 111 |
| 2026-06 | 75 | 91 |

## Files modified
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de-organic.js`
- `reports/digital-marketing-member-pages/api/data/sukirtha-de-organic-sales-2026-01.json` through `-06.json`
- `evidence/sukirtha/2026-07-17_sukirtha-de-organic-exclude-mahima-products.md` (this file)

## Status: PASS
- Mahima's ~656 product IDs are excluded from Sukirtha's Organic sales at the line-item level, for both historical months (static snapshots, recomputed) and the live July month (recomputed on every request).
- Verified directly against the production API after deploy — not just claimed.

**Reviewer:** self-verified via live production curl checks.
**Next step:** none — exclusion is live. If Mahima's product list changes in future, update `MAHIMA_EXCLUDED_PRODUCT_IDS` in `sales-sukirtha-de-organic.js` and re-run the snapshot reprocessing for closed months.
