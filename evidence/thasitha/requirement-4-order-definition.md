---
title: Thasitha Requirement 4 — Order Definition (Shopify + Google Ads)
requirement_id: THASITHA-R4
date: 2026-07-16
status: STOPPED — neither definition can be proven from available data
---

## Purpose
Resolve, per the brief's mandatory rules, exactly what counts as a
"Shopify Order" and an "Ads Order" for this comparison. Neither could be
fully resolved this pass — both are documented as open blockers.

## Shopify Order Definition
**Requested:** distinct order count (brief's stated preference) unless an
approved source says otherwise — no approved source found either way.

**Available field:** `order_management.orders.status`, live distinct values
confirmed via query: `Cancelled`, `Completed`, `Deleted`, `Hold`,
`Inprogress`, `New`, `Refunded`.

**Unresolved:**
- No AIOS document anywhere defines which of these 7 statuses should count
  as a "valid" order for this kind of comparison report.
- No partial-vs-full refund distinction exists on this table — `Refunded`
  is a single bucket.
- Test/duplicate-import order handling not documented anywhere.

**Formula that WOULD be used, pending sign-off on the status filter:**
```sql
COUNT(DISTINCT oi.order_id)
FROM order_management.order_item_info oi
JOIN order_management.orders o ON o.id = oi.order_id
JOIN order_management.sub_source ss ON ss.id = o.sub_source_id
JOIN order_management.source s ON s.id = ss.source_id
WHERE s.source_name = 'SHOPIFY'
  AND oi.real_sku = :sku
  AND o.order_date >= :period_start
  AND o.status IN (/* needs sign-off, e.g. 'Completed' only, or 'Completed'+'Inprogress' */)
```

## Google Ads Order Definition
**Requested:** confirm the exact conversion measure represents valid
ecommerce orders, not add-to-cart/begin-checkout/other actions.

**Available field:** `google_ads.product_performance.conversions` —
numeric(10,2), can be fractional due to Google's attribution modelling.

**Unresolved (hard blocker):** There is no conversion-action dimension or
lookup table anywhere in this database (confirmed: zero tables matching
`%conversion%` in a full schema search). This means `conversions` is
whatever the Google Ads account's default/primary conversion action(s)
are configured to count — which could be purely "Purchase", or could
include other configured goals (e.g. "Contact form", "Phone call"). This
cannot be verified from data in this database; it would require checking
directly in the Google Ads UI/API which conversion actions are marked
"Primary" and included in this reported `conversions` metric for this
account (`9031058245`).

**Formula that WOULD be used, pending confirmation this metric is
purchase-only:**
```sql
SUM(pp.conversions)
FROM google_ads.product_performance pp
JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
WHERE pp.product_item_id = :offer_id
  AND pp.date >= :period_start
  AND c.account_id = 9031058245
```
Displayed to 2 decimal places, not rounded to integer, per the brief.

## Status
Both definitions are blocked pending explicit sign-off:
1. Which `orders.status` values count as valid Shopify orders.
2. Confirmation (from Google Ads account config, not this database) that
   `product_performance.conversions` reflects purchase-only conversions
   for account 9031058245.
