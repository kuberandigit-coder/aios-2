---
title: Thasitha Requirement 5 — Date-Window Mapping
requirement_id: THASITHA-R5
date: 2026-07-16
status: STOPPED — cannot compute until common end date and SKU scope are confirmed
---

## Purpose
Document the intended date-window logic per the brief, and why exact boundaries aren't computed yet.

## Method specified by the brief
- Common comparison end date = latest complete date shared across Shopify, eBay, Amazon.
- Current 30/60/90d = rolling windows ending on that common date.
- Previous-year periods = identical calendar dates shifted back exactly one year (not "same day-of-week", not month-aligned).

## Why this isn't computed yet
Computing the true "latest complete common date" requires querying `MAX(order_date)` per channel for the **actual Requirement 5 SKU scope** (not all of ledsone.de) — since a date could be "complete" account-wide but have no data for the specific approved SKUs yet on that day. Running this against an unconfirmed SKU set would produce numbers that don't represent the real requirement.

## What's known so far (from Requirement 4, Shopify-only, ALL Thasitha SKUs, not R5's scope)
- Shopify latest order date: 2026-07-16
- Google Ads latest date: 2026-07-15/16
These are NOT yet confirmed to be the same for eBay/Amazon or for R5's actual SKU list.

## Next step
Once SKU scope is confirmed, run `MAX(order_date)` per channel scoped to those SKUs, take the earliest of the three as the common end date, then compute the 6 exact date ranges (current/previous × 30/60/90d) and document them here.
