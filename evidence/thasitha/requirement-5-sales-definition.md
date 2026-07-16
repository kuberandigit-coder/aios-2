---
title: Thasitha Requirement 5 — Sales Metric Definition (Units vs. Orders)
requirement_id: THASITHA-R5
date: 2026-07-16
status: STOPPED — genuinely unconfirmed, per the brief's own stop condition
---

## Purpose
Resolve whether Requirement 5's per-SKU-per-channel figures mean units sold or distinct order count.

## What was checked
- No Requirement 5 CSV or source document exists (see [[requirement-5-discovery]]).
- No prior AIOS asset defines this for any multichannel report.
- The brief itself states: "The screenshot shows numeric values... but does not explicitly confirm whether these values mean distinct orders, units sold, line-item quantity, or another sales metric" — and instructs to stop if unclear.

## Precedent from this project
Requirement 4 (Shopify only) ended up using **units sold** (`SUM(item_quantity)`) after the user explicitly clarified this in chat — not orders. That clarification was specific to Requirement 4 and Shopify only; it hasn't been re-confirmed for Requirement 5's three-channel scope, and eBay/Amazon may have different natural conventions (e.g., Amazon Seller Central typically reports "units ordered" by default, not orders).

## Status
Unconfirmed. Per the brief's explicit instruction, this must be confirmed before implementation — not assumed from the Requirement 4 precedent, since the brief covers three channels and could differ per channel.

## Next step
Ask the user directly: same "units sold" convention as Requirement 4 for Shopify, and equivalent for eBay/Amazon, or something else?
