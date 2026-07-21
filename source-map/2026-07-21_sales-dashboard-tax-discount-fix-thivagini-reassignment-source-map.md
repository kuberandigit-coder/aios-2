---
title: Source map — Gross Sales tax/discount fix, No-Journey-Data reassignment
date: 2026-07-21
type: source-map
---

# Purpose
Map of exactly which files/functions were touched for this block, for fast future navigation.

# Backend — `reports/digital-marketing-member-pages/api/sales-sukirtha-de.js`
- `reconcileOrderDiscounts(items, order)` — new function. Converts `order.currentTotalDiscountsSet` to the same ex-tax basis as line-item gross (using each order's blended tax rate: `totalTax / totalGrossExTax`), then allocates any shortfall vs. the sum of per-item discounts proportionally by gross share (last item takes the rounding remainder).
- `buildSukirthaOrderRow()` and `buildSukirthaOrderRowEmail()` (both row-builder functions, used by every tab) — each line item now computes `tax` from `li.taxLines`, subtracts it from `grossInclTax` to get the reported `grossSales` (ex-tax), converts the per-item discount to ex-tax using that item's own rate, and calls `reconcileOrderDiscounts()` before returning.
- `ORDERS_QUERY` — added `taxLines { priceSet { shopMoney { amount currencyCode } } rate title }` to the `lineItems` selection.
- `summarizeRows()` — added `orderTotalSum` (sum of each row's `orderTotal`, i.e. `order.currentTotalPriceSet`, independent of the gross/net calculation above).
- `HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS` — new constant, a hardcoded `Set` of 41 order names (Jan–Jul), module-level, near `MAHIMA_EXCLUDED_PRODUCT_IDS`.
- Hetheesha's `heNoJourneyRows` filter — added `&& !HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS.has(r.orderName)`.
- Thivagini's `isHetheeshaOrganicGroup(row, journey)` — added an early `if (HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS.has(row.orderName)) return false;` so these orders fall through to her tab; her row-building loop then relabels `row.channel = 'No Journey Data (Ad-Click Matched)'` for these specific orders only.
- Temporary diagnostic branches added (all opt-in via query flags, not used by any deployed tab): `debugOrderRaw` (dumps one raw order by name), `debugFetch` (raw fetch page/edge counts before date filtering), `debugRawNoFilter` (fetches with no date query at all), `debugConfig` (dumps which store/token/API-version a request resolved to, without exposing the token itself).

# Frontend — `reports/digital-marketing-member-pages/pages/sales.html`
- Hetheesha's card grid (`#heCardsCombined`) — new card `#hekOrderTotal`, populated in `heRenderAll()`.
- Thivagini's card grid (`#tvCardsCombined`) — new card `#tvkOrderTotal`, populated in `tvRenderAll()`.
- Both tabs got an explanatory `<div class="sub">` note distinguishing Gross/Net Sales (product-only) from Order Total (incl. tax + shipping).

# Static data — `reports/digital-marketing-member-pages/api/data/`
- New: `hetheesha-fr-organic-sales-2026-0{1-6}.json`, `thivagini-fr-ads-sales-2026-0{1-6}.json` (first snapshots ever generated for these two tabs).
- Regenerated: `thasitha-de-ads-sales-2026-0{1-4}.json` (with the tax/discount fix); new: `2026-05`, `2026-06`.

# Bug root-cause evidence (for future reference)
Order `LSFR1366` (ledsone.fr, May 2026): `originalUnitPriceSet=127.80 × 2 = 255.60`; `discountedTotalSet` incorrectly also showed `255.60` (no discount reflected); real `order.currentTotalDiscountsSet=25.56`; line item's real `taxLines` showed `FR TVA` rate `0.2`, amount `38.34`. Verified: `(255.60 − 25.56 − 38.34) = 191.70` net-ex-tax, and `191.70 × 1.2 = 230.04 = (255.60 − 25.56)`, confirming prices are VAT-inclusive and the order-level discount (not the line-item field) is the reliable source.
