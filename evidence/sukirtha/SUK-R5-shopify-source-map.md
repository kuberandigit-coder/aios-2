# SUK-R5 — Shopify Source Map

**Title:** Low-Stock Alerts — Shopify Data Source Map
**Requirement ID:** SUK-R5
**Purpose:** Document exactly which Shopify Admin API objects/fields feed Requirement 5, and how Current Stock and Status are derived.
**Business Question:** Which products/variants on ledsone.de currently have low stock and require attention?
**Shopify Store:** ledsone.de (`ledsone-de.myshopify.com`, Admin API version `2024-10`)

## Shopify Objects/Fields Used

Query: `products(first: 50, after: $after)` → for each product: `id, title, handle, status, productType, updatedAt`; for each variant: `id, title, sku, price, inventoryItem { id tracked inventoryLevels(first: 5) { edges { node { location { id name } quantities(names: ["available"]) { name quantity } } } } }`.

This is the exact same query already used by SUK-R3 (`R3_PRODUCTS_QUERY` in `api/requirement.js`) — reused via the shared `r3FetchAllVariants()` function rather than duplicated, since Requirement 5 needs the identical product/variant/inventory shape and no orders data.

- **Product ID** → `product.id` (Shopify GID, e.g. `gid://shopify/Product/...`)
- **Variant ID** → `variant.id` — the internal unique key for every row. SKU is never used as the join key.
- **SKU** → `variant.sku` (raw, trimmed for blank-detection only; displayed as-is)
- **Product Title / Variant Title** → `product.title` / `variant.title` (available in row detail expand)
- **Inventory Item ID / Inventory Tracked** → `variant.inventoryItem.id` / `variant.inventoryItem.tracked`
- **Current Inventory Quantity** → `inventoryLevels.edges[].node.quantities` filtered to `name: "available"`
- **Product Status** → `product.status` (ACTIVE / DRAFT / ARCHIVED)

## Inventory Locations

ledsone.de has exactly **one active, order-fulfilling location**: "LEDSone DE LTD" (`gid://shopify/Location/48953295015`), `isActive:true`, `fulfillsOnlineOrders:true`. Confirmed previously in `evidence/sukirtha/SUK-R3-inventory-location-map.md` via a `locations(first:10)` query returning a single edge. No other locations exist to combine or exclude, so Current Stock = the `available` quantity at this one location, summed defensively in code in case additional locations are added later.

## Current Stock Logic

```
Current Stock =
  IF variant.inventoryItem.tracked === false → null ("Not Tracked")
  ELSE SUM(inventoryLevel.quantities["available"].quantity across all returned locations)
```

Negative inventory values are not clamped to zero (Shopify allows negative available stock; this is surfaced as-is, matching SUK-R3's precedent).

## Low-Stock Threshold Source

No approved threshold existed anywhere in Sukirtha/AIOS assets (prompts/evidence/validation/handover/reports) or in Shopify (no metafield/config found for a low-stock threshold on ledsone.de). This was reported as BLOCKED to the user per the requirement's explicit stop condition. The user then explicitly confirmed: **Current Stock < 10 → Low Stock, else OK** (2026-07-27, in-conversation confirmation, applies to `<` not `<=`).

## Status Logic

```
IF NOT inventoryTracked OR currentStock === null → "Not Assessable"
ELSE IF currentStock < 10 → "Low Stock"
ELSE → "OK"
```

## Governance

Shopify is the sole authoritative source. All calls are read-only GraphQL queries (`products`, no mutations). No product, variant, price, or inventory record is created, changed, or modified by this page or its backend.
