---
title: Thasitha Requirement 2 — PMax Product Zero-Performance & Root-Cause — Discovery Evidence
requirement_id: THASITHA-R2
date: 2026-07-15
---

## Purpose
Discovery evidence for building a product-level PMax zero-performance and
root-cause dashboard for Thasitha (Google Ads, ledsone.de).

## Scope confirmed
Two PMax campaigns owned by Thasitha (`group_name = 'Thasi'`, `account_id = 9031058245`):
- `23765634627` — Pmax | Thasi | Shoptimised | THT | NewProduct | MCV -20/04
- `23791285134` — Pmax | Thasi | Shoptimised | MT | Metal Product | MCV -27/04

## GMC Approval Status — confirmed unavailable, column removed by explicit user instruction
Live schema check on 2026-07-15 against PostgreSQL:
- `raw_data.gmc_product_diagnostics_daily` — no longer exists (previously existed empty, per Mahima's 2026-07-09 investigation).
- No table matching `%diagnostic%`, `%disapprov%`, `%eligib%` anywhere in the database.
- `google_ads.ad_group_products.status` (ELIGIBLE/DISAPPROVED/PENDING) exists but is explicitly documented as **Shopping/Search/Display only** — "Never join `ad_group_products` to a PMax campaign — PMax has no ad groups."
- `google_ads.asset_group_listing_group_filters` (PMax's targeting-tree equivalent) only records UNIT_INCLUDED/UNIT_EXCLUDED targeting rules, not GMC approval status — a different concept.
- `google_ads.merchant_products` (482,448 rows, live) carries feed content (title/price/availability/brand) but zero approval/diagnostic columns.

**Conclusion:** GMC per-product approval status is structurally unavailable for PMax specifically (Google's API doesn't expose it at the PMax asset-group level). User instructed: remove the GMC Status column entirely and continue with the rest of the report.

## Data sources used
- `google_ads.product_performance` — Date × Campaign × Product granularity for PMax (10.1M rows). Used for Impressions/Clicks/Spend/Conversions (30d) and Date Added to Campaign (`MIN(date)` per campaign × product, proxy — Google Ads API does not expose a literal "date added" per product).
- `google_ads.merchant_products` — joined on `product_id = product_item_id`, deduped via `DISTINCT ON (product_id)` preferring `lan='de'` rows (feed has ~15x fan-out per product across languages/countries, a known pre-existing gotcha documented in Mahima's Requirement 1 evidence). Supplies title, image_link, link, availability.
- `availability` field used as "Shopify Stock Status" (in stock / out of stock) — sourced from the Merchant Center feed, itself synced from Shopify.

## Match rate
831 total product rows across both campaigns (406 + 425). 361 of 831 (43%) have no `merchant_products` match — shown as "Unknown" stock status and a `Product <ID>` fallback title. This mirrors the ~18.7%–56% documented match-rate gap from Mahima's prior Requirement 1 product-level work — a known, pre-existing limitation, not introduced by this report.

## Zero-Flag logic (as specified by user)
- New + 0 Imp: Days Live ≤ 30 AND Impressions = 0
- 0 Impressions: Days Live > 30 AND Impressions = 0
- 0 Clicks: Impressions > 0 AND Clicks = 0
- 0 Conv (30d): Clicks > 0 AND Spend > 0 AND Conversions = 0
- Healthy: Impressions > 0 AND Clicks > 0 AND Conversions > 0

Verified against live data: zeroconv=203, zeroclick=330, zeroimp=277, healthy=21, new=0 (sum=831, matches total row count).

## Root Cause Check / Action columns
Left blank per explicit user instruction — for manual entry by Thasitha.

## Owner
Kuberan (AIOS) / Claude Code session — execution worker role only.
