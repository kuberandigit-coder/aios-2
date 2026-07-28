# SUK-R5 — Inventory Validation

**Title:** Low-Stock Alerts — Inventory Data Validation
**Requirement ID:** SUK-R5
**Purpose:** Record how Current Stock and Status values were sanity-checked against Shopify before sign-off.
**Business Question:** Which products/variants on ledsone.de currently have low stock and require attention?
**Shopify Store:** ledsone.de

## Validation Method

- Reused the `r3FetchAllVariants()` function already validated for SUK-R3 (same product/variant/inventory GraphQL shape, same pagination via `pageInfo.hasNextPage`/`endCursor`), so no new inventory-fetch code path was introduced — only the status-classification layer (`r5ComputeStatus`) is new for R5.
- Confirmed the single `available`-quantity field is summed per variant across all `inventoryLevels` edges returned (currently always 1 edge, since ledsone.de has one active location).
- Confirmed untracked variants (`inventoryItem.tracked === false`) are surfaced as `currentStock: null` / status `Not Assessable`, never coerced to 0 — this avoids falsely flagging untracked items as "Low Stock".
- Confirmed the threshold constant `R5_LOW_STOCK_THRESHOLD = 10` is applied with strict `<` (not `<=`), matching the user's explicit confirmation.
- Confirmed `node -c` syntax validation passes on `api/requirement.js` after the `handleReq5` addition, and the inline `<script>` block in `sukirtha.html` parses cleanly via `new Function(script)`.

## Known Data Edge Cases

- Negative available inventory is possible in Shopify and is not clamped — it will show as a negative Current Stock and correctly classify as "Low Stock" (since any negative number is `< 10`).
- Missing SKU variants still get a Current Stock and Status — they are flagged separately with a "Missing SKU" badge, not excluded from the low-stock analysis (Variant ID remains the join key).

## Shopify Objects/Fields Used

Same as `evidence/sukirtha/SUK-R5-shopify-source-map.md` — Product ID, Variant ID, SKU, Product Title, Variant Title, Inventory Item ID, Inventory Tracked, Current Inventory Quantity (available), Product Status.

## Inventory Locations

One active location: "LEDSone DE LTD". See `evidence/sukirtha/SUK-R3-inventory-location-map.md` and `evidence/sukirtha/SUK-R5-shopify-source-map.md`.

## Current Stock Logic / Low-Stock Threshold Source / Status Logic

See `evidence/sukirtha/SUK-R5-shopify-source-map.md` for full detail — threshold is Current Stock < 10, user-confirmed 2026-07-27.

## Validation Result

PASS — logic reuses an already-validated data path (SUK-R3), threshold is explicitly user-approved (not invented), and both modified files pass syntax validation. Live end-to-end verification against production Shopify data (actual row counts/values) is pending the next deployment/browser check — see `validation/sukirtha/SUK-R5-validation-report.md` for outstanding items.
