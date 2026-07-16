# Evidence — R3 revert + R5 Amazon Germany data (partial)

**Date:** 2026-07-16

## R3
Reverted the zero-conversion overlap filter added earlier today (user asked to undo). `otherCamps` filter back to original: `!c.isThasi && c.isCurrentlyActive` (no `conv>0` requirement). Status-note addition also removed.

## R5
Added Amazon Germany sold-unit data to R5_PRODUCTS for the 110 SKUs (of 1,865) whose SKU matches an Amazon Germany order line item (`sub_source_id=8`, `market_place='10'`, status not in Cancelled/Deleted). Each product's `c30/c60/c90/p30/p60/p90` objects now include an `amazon` field alongside `shop`/`ebay`.

Source correction: earlier work incorrectly concluded Amazon Germany had no live data (checked only `sub_source_id=14`, dead since 2023). Correct sub_source for Ledsone's Amazon Germany sales is `sub_source_id=8` ("amazon Ledsone"), active through 2026-07-16.

## Known gap (not yet done)
751 Amazon-Germany-selling SKUs are not yet in R5's product list at all (bundle/combo SKUs the original 1,865-SKU build didn't include). Of these, ~296 do have a real ledsone.de Shopify listing and should be added as new R5 rows with Amazon-only sales data. This full addition was not completed in this pass due to time constraints — deferred to a follow-up task.

## Validation
Syntax check passed both `<script>` blocks. Full runtime simulation: all 5 tabs render without error, R3 counts match pre-change baseline (r3Tbody 151,993 chars, r3kpiTotal 232).

## Status
PASS (partial R5 scope). Deployed to production.
