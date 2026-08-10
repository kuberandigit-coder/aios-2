# Evidence — New Cost Dashboard Page + Data-Gap Closures (2026-08-07)

**Purpose:** Record of the new `pages/cost.html` build and the supporting data-gap closures made the same day.

## 1. New Cost Dashboard page (`486671f`)
`pages/cost.html`: Sonya/Sajeepan/Kamsi/Dilaksi tabs, showing exactly the cost categories confirmed to have a real data source (following a prior Phase 1 discovery/audit). Product Cost, CSS, Meta Ads Cost, and Subscription Fee explicitly marked N/A — no source exists anywhere in this system for those, per the audit — never estimated or guessed.

## 2. Two data gaps closed to enable it
- `salesuk.js`/`sales25.js` already computed per-order VAT internally but discarded it before returning — now exposed via `combinedSummary.vat`.
- Added a real Transaction Fee source: `accounting.shopify_transactions.fee` (genuine order-linked Shopify Payments processing-fee table, previously unused anywhere in this project), summed per employee's exact attributed order set via `shopify_order_id`, scoped to `sub_source=104` (UK store).

## 3. Product Cost added (`e111579`)
User confirmed explicit business rule: Product Cost = 20% of Gross Sales (before discounts/refunds). Computed client-side from existing Gross Sales figures — moved from N/A to a real, rule-based figure.

## 4. Per-member data caching (`fcd9875`)
Cost Dashboard now caches per-member data client-side so switching tabs doesn't re-fetch from scratch.

## 5. VAT/Transaction Fee backfill (`08b09b5`)
Regenerated all 31 affected snapshot files (Sonya's full 2025, Sajeepan's full 2025 and 2026) with the new VAT/Transaction Fee fields — these months previously showed "verify — see note" on the Cost Dashboard because their snapshots predated the new fields.

## 6. Sales-side completeness bug found and fixed (`c8e9f22`)
While working on Cost Dashboard data, found `sales25.js` (2025) was missing the DM 46 product-owned-order exclusion that `salesuk.js` (2026) already had (added 2026-07-30): every 2025 DM-campaign order containing a Sonya/Sajeepan-owned product was being misattributed to the generic DM-Ad bucket instead of routed to Sonya/Sajeepan directly. Fixed in `sales25.js`.

## Files touched
- `reports/digital-marketing-member-pages/pages/cost.html` (new)
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/api/sales25.js`
- `reports/digital-marketing-member-pages/api/data/salesuk-{sonya,sajeepan}-2025-*.json`, `-2026-*.json`

## Deployment
Deployed to production and verified live (curl against `/api/cost`, `/api/salesuk`, `/api/sales25`).

**Status:** PASS
**Reviewer:** Pending (Sonya/Sajeepan/Kamsi/Dilaksi cost figures should be spot-checked by the business owner before being treated as final).
**Next step:** Consider whether a real source can ever be found for Product Cost accuracy beyond the flat 20% rule, and for CSS/Meta Ads Cost/Subscription Fee (currently N/A by design).
