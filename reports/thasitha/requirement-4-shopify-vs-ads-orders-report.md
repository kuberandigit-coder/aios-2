---
title: Thasitha Requirement 4 — Shopify Orders vs Google Ads Orders by SKU — Report
requirement_id: THASITHA-R4
date: 2026-07-16
status: BUILT — AMBER
---

## Purpose
Final data totals for Requirement 4, pulled live from PostgreSQL per the
user's explicit instruction to proceed using DB data only.

## Business question
For each SKU in Thasitha's Google Ads scope: how many Shopify orders, how
many Google-Ads-attributed orders, across past 30/60/90 days, and which
campaign(s) contain that SKU.

## Team member / Department / Store
Thasitha / Google Ads / ledsone.de

## Scope
572 unique SKUs — every product with performance history in Thasitha's 2
ENABLED PMax campaigns (`23791285134` "MT", `23765634627` "THT"),
account `9031058245`.

## Reporting periods and boundaries
Past 30 / 60 / 90 days, all calculated back from the common comparison
end date **2026-07-15** (Google Ads' latest available date — earlier than
Shopify's latest date of 2026-07-16, so used as the shared cutoff to keep
both sides aligned).

## Totals

| Period | Total Shopify Orders | Total Ads Orders (fractional) | Difference |
|---|---|---|---|
| Past 30 days | 42 | 16.17 | 25.83 |
| Past 60 days | 80 | 41.68 | 38.32 |
| Past 90 days | 116 | 52.94 | 63.06 |

## Match status breakdown (past 30 days, primary period)
- Matched: 5
- Ads Lower: 25
- Ads Higher: 11
- No Orders (both zero): 531
- Data Check Required: included within the above where Shopify=0/Ads>0 or duplicate-SKU mapping (14 SKUs across 7 SKU groups flagged as duplicate mappings — likely bundle SKUs listed under two different Google Ads item IDs)

## Data coverage
- SKU/offer-ID resolution: 567/572 (99.1%) resolved to a real Shopify SKU via `shopify_listings.item_id`; 5 unresolved (same 5 orphaned SKUs already documented in Requirement 2).
- Product title: 567/572 (99.1%)
- Selling price: 492/572 (86.0%) — 80 SKUs shown as N/A

## Known limitations (see [[requirement-4-order-definition]] for detail)
- Shopify order status filter (`NOT IN ('Cancelled','Deleted')`) is a working default, not a signed-off company rule.
- Ads `conversions` metric cannot be confirmed as purchase-only — no conversion-action dimension exists in the database to verify this.
- Selling Price is current price, not historical order-line price.

## Files created/modified
- `reports/digital-marketing-member-pages/pages/thasitha.html` — added Requirement 4 tab (HTML + CSS + JS), R1/R2/R3 untouched.
- This report, [[requirement-4-validation]], [[requirement-4-discovery]], [[requirement-4-order-definition]], [[requirement-4-postgresql-source-map]], [[requirement-4-sku-order-mapping]], [[requirement-4-original-column-mapping]], [[requirement-4-handover]], [[requirement-4-deployment-readiness]].

## Status
Built. **NOT deployed, NOT pushed** — per explicit instruction not to deploy/push without separate approval.
