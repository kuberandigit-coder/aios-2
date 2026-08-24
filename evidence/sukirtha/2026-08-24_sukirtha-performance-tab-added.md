## Purpose
Build a full Performance tab for Sukirtha on `pages/muguntha.html`, matching Sonya/Sajeepan/Kamsi/Dilaksi/Jefri's UX, then fix its load speed.

## Business Question
Kuberan: "create for mahima perferomance pahe she is also in ledsone.de" — redirected mid-investigation to "not for mahima do for sukirtha for now for mahima tommrrow".

## Investigation
- Confirmed via direct DB query (`ledsone-db-mcp`) that no Google Ads campaign group exists for Sukirtha in either account (`group_name ILIKE '%suki%'` → 0 rows) — she has zero ad spend, same shape as Kamsi/Dilaksi.
- Confirmed her existing Sales attribution already lives in `salesde25.js`/`sales.js` as the DE store's default/catch-all organic handler (`?staff=sukirtha`, department "Organic Search (SEO)") — no new attribution logic needed.
- Confirmed the tool-cost split (`getToolCost()`, Semrush+Arrow, ÷4) already anticipated her as a recipient in its original design documentation (Dilaksi panel's footnote: "...split 3-way between Kamsi/Dilaksi/Sukirtha...only Kamsi's and Dilaksi's shares appear on this dashboard, Sukirtha...has no cost row here yet") — she was always intended, just never built.

## Fix
- `api/muguntha.js`: added `EMPLOYEES.sukirtha` (groupName '', toolCost: true, hasDm: false — identical shape to Kamsi/Dilaksi).
- `pages/muguntha.html`: new nav entry (already existed in `MEMBER_NAMES`, just never in `BUILT_MEMBERS`), full panel (cards, table, footnotes), generalized the previously Jefri-only DE-routing (`fetchGroupSales`/`openCostPopup`) into a `DE_STAFF_ROUTING` map covering both Jefri and Sukirtha, with Sukirtha using `netSales` (organic-role convention) instead of Jefri's `orderTotalSum`.
- Cost popup: Sukirtha follows the Kamsi/Dilaksi "AI Tools Cost" branch (no ad spend) plus her real Discount/Refund from her DE orders — same DE-only cost-component treatment as Jefri (no Transaction Fee, no Shopify Subscription Fee).

## Performance fix (same day, follow-up)
User reported the new tab was slow. Root cause: no static snapshot files existed yet for Sukirtha (unlike the other 5 members), so every load hit a live 30-90s+ Shopify DE order scan. Generated 19 months of sales snapshots (`api/data/sukirtha-de-organic-sales-*.json`) and 19 months of cost snapshots (`api/data/muguntha-sukirtha-*.json`), Jan 2025 through Jul 2026, matching Jefri's exact file-naming convention.

## Files Modified
- `api/muguntha.js`, `pages/muguntha.html`

## Files Created
- 19x `api/data/sukirtha-de-organic-sales-YYYY-MM.json`
- 19x `api/data/muguntha-sukirtha-YYYY-MM.json`

## Status
PASS — live-verified real data (143 orders, €3,128.01 netSales for March 2025), response time confirmed ~1.9s after snapshot fix (down from 30-90s+).

## Reviewer
Kuberan

## Next step
Mahima's equivalent Performance tab (also DE store) queued for a following day, per Kuberan's explicit "for mahima tommrrow".
