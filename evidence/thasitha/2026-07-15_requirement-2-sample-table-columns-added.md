---
title: Thasitha Requirement 2 — Missing Columns Added Per Her Sample Table
requirement_id: THASITHA-R2
date: 2026-07-15
status: BUILT, NOT DEPLOYED (per explicit instruction)
---

## Purpose
Thasitha shared a sample table for the Requirement 2 dashboard, showing
columns beyond what was originally built. This adds the genuinely
missing data columns while keeping the earlier GMC Status limitation
honest (not fabricated from her sample's illustrative values).

## Columns added
- **Stock Inventory** (numeric) — `listings.shopify_listings.quantity`
  WHERE `site = 'Germany'`, joined on the same product/variant ID
  (`item_id`) used throughout the rest of the table. 815 of 831 rows
  (98%) resolved; remainder shown as N/A.
- **Budget (€/day)** — `google_ads.campaigns.budget` for Thasitha's two
  campaigns (THT NewProduct = €5.00/day, MT Metal Product = €12.00/day).
- **CTR %** = Clicks ÷ Impressions × 100.
- **Avg CPC (€)** = Cost ÷ Clicks.
- **Conversion Value (30d)** — newly pulled `SUM(conversion_value)` from
  `google_ads.product_performance` (was not previously queried; only
  `conversions` count existed before).
- **Conversion Rate** = Conversions ÷ Clicks × 100.
- **ROAS (%)** = Conversion Value ÷ Cost × 100.

All four calculated ratios use the same aggregate 30-day totals already
shown in the table (not pre-averaged daily figures), matching the
correct aggregation rule established earlier this session.

## Column reordered to match her sample sheet
Product Title, Item ID, Image, Link to Listing, Stock Inventory,
Campaign, Budget (€/day), Date Added to Campaign, Days Live,
Impressions, Clicks, CTR %, Avg CPC (€), Cost (€), Conversion Value,
Conv., Conversion Rate, ROAS (%), GMC Status, Shopify Stock Status,
Zero Flag, Root Cause Check, Action.

## What was NOT changed
Her sample sheet's screenshot showed example GMC Status values
(Approved/Disapproved/Under Review) and detailed pre-written Action
text. Both remain as before — **GMC Status: Not Available** (the
underlying data genuinely does not exist, confirmed exhaustively
earlier this session) and **Root Cause Check / Action: blank** for
manual entry. Her sample values for those two columns appear to be
illustrative/example data for the template, not something resolvable
from our current data sources — did not fabricate them.

## Data pipeline
1. Reused the existing 831-product SKU list and campaign scope from the
   original Requirement 2 build.
2. New query added `SUM(conversion_value)` to the existing 30-day
   aggregate pull (previously missing).
3. New join: `listings.shopify_listings` on `item_id = product_item_id`,
   `site = 'Germany'`, deduped via `DISTINCT ON (item_id)` ordered by
   most recently updated.
4. Budget pulled statically from the known campaign records (already
   confirmed in Requirement 1's data).
5. All four ratio metrics computed client-side in JS from the raw
   aggregates, not server-side pre-averaged.

## Files modified
- `reports/digital-marketing-member-pages/pages/thasitha.html` (Requirement 2 tab only; Requirement 1 and 3 tabs untouched — verified via div-depth balance check and JS syntax check, both pass).

## Validation
- Header column count (23) matches row cell count (23) — no misalignment.
- Spot-checked one row's CTR/Avg CPC/Conversion Rate/ROAS against raw
  numbers by hand — all four formulas correct.
- Budget values confirmed against the two known campaign IDs.

## Deployment status
**NOT DEPLOYED** — per explicit instruction this turn. Committed locally only.

## Owner
Kuberan (AIOS) / Claude Code session.
