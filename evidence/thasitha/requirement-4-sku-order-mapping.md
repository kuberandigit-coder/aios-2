---
title: Thasitha Requirement 4 — SKU/Order Mapping (Join & Grain Proof)
requirement_id: THASITHA-R4
date: 2026-07-16
status: STOPPED (discovery-only) — join path identified, not yet proven duplicate-free at scale
---

## Purpose
Document the identifier chain and join/grain rules per the brief, and
what has/hasn't been proven about duplication risk.

## Preferred identifier chain (per brief)
Google Ads Product Item ID / GMC Offer ID → Shopify Variant ID → SKU →
Shopify Product ID.

## What's actually available
- `google_ads.product_performance.product_item_id` — this IS the offer ID
  (no separate offer_id column exists).
- `google_ads.merchant_products.product_id` — joins to `product_item_id`
  (see [[requirement-4-postgresql-source-map]]), gives title/image/link/price.
- `order_management.order_item_info.variant_id` and `.item_sku`/`.real_sku`
  — the Shopify side of the chain.
- **No direct FK exists between `merchant_products`/`product_performance`
  and `order_item_info`** — the join must go through the SKU string itself
  (`product_item_id` = `real_sku`), not a numeric ID. Spot-checked in this
  session (2026-07-16, prior message): Google Ads `product_item_id` values
  are lowercase (e.g. `enc7397`), Shopify `item_sku`/`real_sku` values are
  mixed-case (e.g. `PHCD1PBRBW+LSCY290BC`, `ENC3862`-style). **A case-
  insensitive join (`LOWER(product_item_id) = LOWER(real_sku)`) will be
  required** — not yet proven this doesn't cause false-positive matches
  for SKUs that differ only by case (unlikely but unverified at full scale).

## Grain rules (per brief) — not yet executed as a query, documented as the intended approach
- Shopify aggregation grain: Reporting Period + SKU + Distinct Order ID
  (i.e. `COUNT(DISTINCT order_id)` grouped by period + `real_sku`).
- Google Ads aggregation grain: Reporting Period + Campaign ID + Product
  Item ID (`SUM(conversions)` grouped by period + `campaign_id` +
  `product_item_id`), then re-aggregated to SKU level (a SKU can appear in
  more than one campaign, per the brief's multi-campaign requirement).
- Campaign mapping grain: SKU/Offer ID + current Campaign ID — reusable
  from R2/R3's per-SKU campaign list logic already built into the page.

## Duplicate-risk proof — NOT YET DONE
The brief requires proving joins do not multiply either side's totals
before any build. This requires running the actual join at scale and
checking row counts before/after against `COUNT(DISTINCT order_id)` and
`SUM(conversions)` baselines — **not attempted this pass**, since the
order-definition blockers in [[requirement-4-order-definition]] must be
resolved first (no point proving a join is duplicate-free against a
metric whose definition isn't yet approved).

## Status
Join path identified and documented; duplication proof deferred until
order definitions are approved (see [[requirement-4-discovery]] blockers
2 and 3).
