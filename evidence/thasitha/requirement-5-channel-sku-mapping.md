---
title: Thasitha Requirement 5 — Channel-to-Authoritative-SKU Mapping
requirement_id: THASITHA-R5
date: 2026-07-16
status: STOPPED — blocked on SKU scope, mapping method identified but unvalidated
---

## Purpose
Document the intended SKU mapping hierarchy and what's provable today vs. blocked.

## Preferred hierarchy (per brief)
1. Exact normalized SKU
2. Approved marketplace SKU mapping table
3. Shopify Variant ID → SKU
4. eBay Item ID / Variation SKU → authoritative SKU
5. Amazon Seller SKU / Merchant SKU → authoritative SKU

## What's provable today
- Shopify: `listings.shopify_listings.item_id → sku` (or `mapped_sku`) — proven working in Requirement 4 (99.1% resolution rate on that scope).
- eBay/Amazon: `order_item_info.item_sku` / `.real_sku` fields exist in the same shared order table, but **no specific eBay-variation-SKU or Amazon-seller-SKU mapping has been tested this pass** — cannot confirm accuracy without real SKUs to test against.

## Blocked
Cannot validate bundle-SKU handling (`+`-containing SKUs), parent/child Amazon SKU handling, or eBay variation SKU resolution without the actual Requirement 5 SKU list (see [[requirement-5-discovery]] blocker 1). Testing against arbitrary SKUs would not represent this requirement's real scope and risks fabricating a mapping that looks validated but isn't.

## Next step
Once SKU scope is confirmed, spot-check a sample from each channel the same way Requirement 4 did (case-sensitivity check, duplicate-row check, orphan-rate check) before trusting the mapping.
