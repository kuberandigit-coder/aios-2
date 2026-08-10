# Daily Work Log — 2026-08-07

## Summary
Built a new "Cost Dashboard" page showing only verified-available cost data (no estimates for categories with no real source), closed two data gaps (VAT and Transaction Fee) to support it, backfilled affected 2025 snapshots, and fixed a Sales-side data-completeness bug for 2025 discovered while working on the Cost Dashboard. Also added SEO tool-cost share to `muguntha.html` for Kamsi/Dilaksi.

## Tasks Completed

1. **New Cost Dashboard page** (`pages/cost.html`, commit `486671f`): Sonya/Sajeepan/Kamsi/Dilaksi tabs showing exactly the cost categories confirmed to have a real data source. Product Cost, CSS, Meta Ads Cost, and Subscription Fee explicitly marked N/A per a prior Phase 1 audit finding that no real source exists for them anywhere in the system — never estimated.

2. **Two data gaps closed to enable the dashboard**:
   - `salesuk.js`/`sales25.js` already computed per-order VAT internally but discarded it before returning — now exposed via `combinedSummary.vat`.
   - Added a genuine Transaction Fee source: `accounting.shopify_transactions.fee` (a real order-linked Shopify Payments processing-fee table, previously unused anywhere in this project), summed per employee's exact attributed order set via `shopify_order_id`, scoped to `sub_source=104` (UK store).

3. **Product Cost added** (`e111579`): previously N/A; user confirmed an explicit business rule — Product Cost = 20% of Gross Sales (before discounts/refunds) — computed client-side from existing Gross Sales figures.

4. **Cost Dashboard caching fix** (`fcd9875`): per-member data is now cached client-side so switching tabs doesn't re-fetch from scratch.

5. **VAT/Transaction Fee backfill** (`08b09b5`): regenerated all 31 affected snapshot files (Sonya's full 2025, Sajeepan's full 2025 and 2026) with the new VAT/Transaction Fee fields — these months previously showed "verify — see note" on the Cost Dashboard because their snapshots predated the new fields.

6. **Sales-side bug fix** (`c8e9f22`): `sales25.js` (2025) was missing the same DM 46 product-owned-order exclusion that `salesuk.js` (2026) already had (added 2026-07-30) — every 2025 DM-campaign order containing a Sonya/Sajeepan-owned product was being misattributed to the generic DM-Ad bucket instead of to Sonya/Sajeepan. Fixed and presumably re-backfilled alongside the VAT/fee regen.

7. **`muguntha.html` SEO tool-cost share** (`219e1da`, `b300cfc`): added Semrush/Arrow AI tool-cost share to Kamsi and Dilaksi's cost figures (both SEO/Organic roles with £0 ad spend, so tool cost is their only real cost line); updated their dashboard headers/footnotes to describe the new cost basis.

## Files Touched
- `reports/digital-marketing-member-pages/pages/cost.html` (new)
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/api/sales25.js`
- `reports/digital-marketing-member-pages/pages/muguntha.html`
- `reports/digital-marketing-member-pages/api/data/salesuk-{sonya,sajeepan}-2025-*.json`, `salesuk-{sonya,sajeepan}-2026-*.json` (VAT/fee backfill)

## Status
All changes deployed to production and verified live (curl against `/api/cost`, `/api/salesuk`, `/api/sales25`), consistent with this project's deploy-then-verify workflow.

## Outstanding
- No open items called out in commit messages for this date.
