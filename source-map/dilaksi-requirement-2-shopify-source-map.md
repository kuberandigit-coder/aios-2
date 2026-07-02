# Source Map — Requirement 2: Product Priority Guidance (Shopify fields)

**Title:** Field-by-field source mapping for Requirement 2 Shopify data
**Purpose:** Single reference for where each report field comes from.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?

| Report field | System | Object / query | Field | Notes |
|---|---|---|---|---|
| Category | Shopify Admin GraphQL | collectionByHandle | collection.title (handle = filter) | 5 handles verified with GIDs |
| Product Title | Shopify Admin GraphQL | collection.products | title | |
| Product ID | Shopify Admin GraphQL | collection.products | legacyResourceId | join key to ShopifyQL product_id |
| Variant ID | Shopify Admin GraphQL | product.variants | legacyResourceId | |
| SKU | Shopify Admin GraphQL | product.variants | sku | |
| Vendor | Shopify Admin GraphQL | collection.products | vendor | |
| Status | Shopify Admin GraphQL | collection.products | status | ACTIVE/DRAFT/ARCHIVED |
| Total Sales (£) | ShopifyQL Analytics | FROM sales … SINCE -30d UNTIL today | total_sales GROUP BY product_id, product_variant_sku | correct col names: product_variant_sku, quantity_ordered (NOT sku/net_quantity) |
| Units Sold | ShopifyQL Analytics | same | quantity_ordered | |
| Last Order Date | ShopifyQL Analytics | FROM sales … GROUP BY product_id, day | max(day) | alt: Admin orders search |
| Collection | Shopify Admin GraphQL | collectionByHandle | handle | product may belong to several |
| Profit Margin / Demand / Organic Sessions / SEO Priority | NOT Shopify | pending Option B pipeline | — | see requirement-2 PostgreSQL evidence |

**Join:** GraphQL products.legacyResourceId ⟷ ShopifyQL product_id (verified: product 8015418720506 / SKU ENC4449 in both).
**Period:** Last 30 Days = `SINCE -30d UNTIL today` (BST) — from requirement text, not invented.
**PostgreSQL:** no Shopify sync tables exist (checked).

**Objects checked / Collections checked / Files created / Validation:** see evidence file `evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md`
**Status:** ACTIVE reference · **PASS/FAIL:** PASS
