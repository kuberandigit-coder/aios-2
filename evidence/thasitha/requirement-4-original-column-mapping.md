---
title: Thasitha Requirement 4 — Original Column Mapping
requirement_id: THASITHA-R4
date: 2026-07-16
status: STOPPED — no authoritative CSV, chat-confirmed structure only
---

## Purpose
Record the exact column headers as confirmed, and the source they came from.

## Source
**Not a CSV** (none exists — see [[requirement-4-discovery]] blocker 1).
Source is the user's direct chat message on 2026-07-16, which stated:

> "SKU  Selling Price  Orders (Shopify) past 30 days  Orders (Ads) past 30 days
> Orders (Shopify) past 60 days  Orders (ADs) past 60 days  Orders (Shopify)
> past 90 days  Orders (Ads) past 90 days  Campaign name/names"

Sample rows given with this header were explicitly confirmed by the user
afterward to be **dummy/placeholder SKUs**, not real data — quote: "that
table sku are examples dummy".

## Exact original headers (as given, including inconsistent capitalization
"Ads" vs "ADs" in the user's own text — preserved verbatim, not corrected)
1. SKU
2. Selling Price
3. Orders (Shopify) past 30 days
4. Orders (Ads) past 30 days
5. Orders (Shopify) past 60 days
6. Orders (ADs) past 60 days
7. Orders (Shopify) past 90 days
8. Orders (Ads) past 90 days
9. Campaign name/names

## Confirmed reporting periods
Three rolling windows: **past 30 days, past 60 days, past 90 days** —
applied identically to both Shopify Orders and Ads Orders. This matches
the earlier screenshot the user shared (Table 7, same 30/60/90 structure,
also confirmed dummy).

## What is NOT confirmed
- Whether "past N days" is rolling-from-today or rolling-from-the-latest-
  common-data-date across both Shopify and Ads (see Date Logic blocker
  in [[requirement-4-discovery]]).
- Whether "Orders" means distinct order count or unit quantity (brief
  prefers distinct order count "unless the authoritative requirement...
  says units" — no authoritative requirement doc exists to check this
  against beyond the user's use of the word "Orders").

## Status
Chat-confirmed structure recorded here as the best-available source. Not
a substitute for the CSV the brief mandates — flagged to user/GPT as
blocker 1 in [[requirement-4-discovery]].
