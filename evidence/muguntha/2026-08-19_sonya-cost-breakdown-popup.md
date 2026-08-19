## Purpose
Add a clickable cost breakdown popup on Sonya's muguntha.html Total Cost cells, per Kuberan: "need to do cost pop up for sonya vat, product cost 20%, transection fee, Discount, refund, Subscription fee /4 in 2025 and /5 in 2026".

## Clarified requirements (via AskUserQuestion)
- Popup is additional detail on the EXISTING Total Cost cell (not a replacement formula).
- Product Cost = 20% of that month's Net Sales.
- VAT/Discount/Refund sourced from the same Shopify order data already used for the Sales column.
- Subscription fee = actual LEDSone UK Shopify platform subscription (Advanced plan), found via Shopify's Settings > Plan page (Admin API does not expose billing amounts) = **$399 USD/month**, converted to GBP at the mid-market rate on 2026-08-19 (1 USD = 0.7389 GBP, via XE/Wise) = **£294.82/month**, split £73.71/person (÷4, 2025) and £58.96/person (÷5, 2026).

## Implementation
1. `pages/muguntha.html`:
   - New `.cb-*` CSS classes for a modal overlay (`#cbOverlay`).
   - New `openCostPopup(member, year, month, monthLabel)` function: fetches `/api/sales25` or `/api/salesuk` (same endpoint/cache the table already uses — a repeat call for an on-screen month is a cache hit, near-instant) for `group=<member>&month=<month>`, reads `combinedSummary.{vat, discounts, refunds, transactionFee, netSales}` (all already computed server-side, previously discarded by the table's `fetchGroupSales()` which only kept `netSales`), computes Product Cost = 20% × netSales, looks up the Shopify subscription split by year, and renders all 6 line items + a total.
   - `renderTable()`'s Total Cost cells (`costCell()` helper) are now clickable (`.cost-clickable`, dotted underline) only when `member === 'sonya'` — every other staff tab is unaffected.

## Evidence
- Confirmed `combinedSummary` already includes `vat`, `discounts`, `refunds`, `transactionFee` via live API test (`/api/sales25?group=sonya&month=2025-06`) — no backend changes needed.
- Syntax-checked all 5 inline `<script>` blocks in muguntha.html (`new Function()`) — no errors.
- Deployed to production (dpl_233D2nKENMZvbWaPpuPRzSWdLrsa, READY).
- Confirmed live HTML contains `openCostPopup` and `SHOPIFY_SUBSCRIPTION_GBP`.
- Pushed to both repos: Staff-requirements (commit c0cc05e), aios-2 (commit 801af3d).

## Status
PASS — deployed live. Not yet manually click-tested in browser by Kuberan.

## Reviewer
Kuberan

## Next step
Kuberan to click a Total Cost value on Sonya's tab and confirm the popup renders correctly with real numbers. Extend to other members' tabs if wanted later — the `costPopupEnabled` check in `renderTable()` just needs the member added.
