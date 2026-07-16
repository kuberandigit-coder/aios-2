---
title: Thasitha Requirement 4 — PostgreSQL Source Map
requirement_id: THASITHA-R4
date: 2026-07-16
status: STOPPED (discovery-only)
---

## Purpose
Record every candidate PostgreSQL object inspected for Requirement 4, per
the brief's mandatory field checklist. Read-only inspection only — no
DDL/DML executed.

| Field | Object | Column | Notes |
|---|---|---|---|
| Shopify Order ID | `order_management.orders` | `id`, `order_id` | `id` bigint PK; `order_id` varchar external ref |
| Shopify Line Item ID | `order_management.order_item_info` | `line_item_id`, `id` | platform line item ID + internal PK |
| Product ID | `order_management.order_item_info` | `product_id` | varchar, platform product ID |
| Variant ID | `order_management.order_item_info` | `variant_id` | varchar, Shopify variant ID |
| SKU | `order_management.order_item_info` | `item_sku`, `real_sku` | `real_sku` = resolved inventory SKU after mapping |
| Quantity | `order_management.order_item_info` | `item_quantity`, `real_qty` | varchar-typed (not int) |
| Order status | `order_management.orders` | `status` | 7 distinct values confirmed live: Cancelled, Completed, Deleted, Hold, Inprogress, New, Refunded |
| Financial/refund status | — | **not present** | `orders` has no separate financial_status; `Refunded` is a `status` value with no partial/full distinction column found |
| Selling Price | `google_ads.merchant_products.price` or `listings.shopify_listings` | `price` | current price, not historical order-line price (no historical price column found on order_item_info beyond `item_price`/`real_price` at time of order) |
| Google Ads Campaign ID | `google_ads.product_performance` | `campaign_id` | join to `google_ads.campaigns.campaign_id` |
| Google Ads Campaign Name | `google_ads.campaigns` | `campaign_name` | via campaign_id join |
| Google Ads Product Item ID | `google_ads.product_performance` | `product_item_id` | Merchant Center offer ID, varchar |
| Offer ID | same as above | `product_item_id` | no separate "offer_id" column — this field IS the offer ID |
| Conversion Action | — | **not present anywhere** | Confirmed zero tables matching `%conversion%` pattern in the whole database; `product_performance.conversions` is a single aggregate numeric column with no per-conversion-action breakdown |
| Conversions | `google_ads.product_performance` | `conversions` | numeric(10,2), can be fractional (attribution modelling) |
| Reporting Date | `order_management.orders.order_date` / `google_ads.product_performance.date` | — | both present; alignment not yet verified for latest-common-date (see Date Logic blocker) |
| Duplicate risk | `product_performance` unique key `(date, campaign_id, ad_group_id, product_item_id)` — verified no duplicates. `order_item_info` has no unique constraint confirmed in this pass (not checked — would need to check before final build) |
| Suitability decision | See below |

## Suitability decision
- **Shopify orders**: `order_management.orders` joined to `order_item_info`
  is suitable in principle, but the exact valid-order status filter is
  unresolved (blocker 3 in [[requirement-4-discovery]]).
- **Google Ads orders**: `google_ads.product_performance.conversions` is
  the only candidate column, but cannot be proven to represent purchase-
  only conversions (blocker 2 in [[requirement-4-discovery]]) — no
  conversion-action table/dimension exists anywhere to filter it against.

## Do not select a source only because its name looks suitable
Explicitly checked and rejected as insufficient on its own:
- `product_performance.conversions` — name suggests "orders" but has no
  action-type filter to confirm it excludes non-purchase conversions.
- `orders.status = 'Completed'` — plausible default but not confirmed as
  an approved company definition; "Hold" and "Inprogress" statuses are
  ambiguous (could be legitimate pending orders or could be excluded).

## Status
Discovery-only. No build performed pending resolution of blockers.
