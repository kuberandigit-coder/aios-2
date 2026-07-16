---
title: Thasitha Requirement 5 — ledsone-mcp (live DB) Source Map
requirement_id: THASITHA-R5
date: 2026-07-16
status: STOPPED (discovery-only) — sources confirmed reachable, scope/metric still blocked
---

## Purpose
Document every candidate PostgreSQL object inspected live for Requirement 5, per the brief's checklist. Read-only, no writes.

| Field | Object | Notes |
|---|---|---|
| Order ID / order-line ID | `order_management.orders` / `order_management.order_item_info` | Same tables used for Shopify in R4 — also carries eBay/Amazon rows, distinguished by `sub_source_id` |
| Product ID / SKU | `order_item_info.item_sku`, `.real_sku` | Confirmed usable for Shopify (R4); not yet spot-checked for eBay/Amazon-specific SKU formatting quirks (parent/child, variation SKUs) |
| Marketplace item ID | `order_item_info.item_id` | "eBay item ID / Shopify product ID" per column docs — Amazon uses `item_asin` separately |
| Order status | `orders.status` | Same 7 values as R4 (Cancelled/Completed/Deleted/Hold/Inprogress/New/Refunded) — applies across all platforms in this shared table, not channel-specific |
| Store/account filter — Shopify | `sub_source_id = 108` (`ledsone-de`) | Reused from R4, already validated |
| Store/account filter — eBay | `sub_source_id = 27` (`ledsonede`) | **Newly identified this pass** — not yet validated against real R5 SKUs (no scope confirmed yet to test against) |
| Store/account filter — Amazon | `sub_source_id = 14` (`amazon Ledsonede`) | **Newly identified this pass** — same caveat; note a second Amazon sub_source (`id=8`, "amazon Ledsone") exists and must NOT be confused with the Germany-specific one |
| Latest date per channel | Not yet queried | Blocked pending SKU scope — querying `MAX(order_date)` per channel is trivial once real SKUs are known, but running it against "all SKUs" would not represent Requirement 5's actual scope |

## Duplicate risk
Not yet assessed for eBay/Amazon specifically — R4 already found and fixed a real duplicate-fan-out bug in `merchant_products` for Shopify; eBay/Amazon order tables have not been checked for equivalent issues (e.g. `order_combo` merged-shipment rows, Amazon FBA order/item tables potentially double-counting).

## Suitability decision
Sources exist and are reachable (this is NOT a blocker) — but validating them meaningfully requires the actual SKU scope, which is blocked (see [[requirement-5-discovery]]).
