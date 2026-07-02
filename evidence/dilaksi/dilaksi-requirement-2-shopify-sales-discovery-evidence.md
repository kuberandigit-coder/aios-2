# Evidence — Requirement 2 Shopify Sales Discovery (Category / SKU / Sales £)

**Title:** Shopify data-source discovery for Product Priority Guidance
**Purpose:** Verify where Category, SKU, and Sales (£) come from before building Requirement 2.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance — Sample (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?
**Mode:** Read-only discovery. No store data changed. No report built.

## 1. Existing AIOS assets checked
- `evidence/shopify_sales/` (Ripsan two-product report, 2026-07-02) — proves the Shopify MCP orders/GraphQL path works; different scope, not a duplicate.
- Requirement 2 evidence (PostgreSQL discovery, earlier today) — established **PostgreSQL has NO Shopify sync tables** (order tables are Amazon/eBay/supplier only). **Duplicate risk: GREEN.**

## 2. Shopify data source identified (store: ledsone.co.uk / ledsone.myshopify.com)

| Field | Verified source | Proof |
|---|---|---|
| Category / Collection | Admin GraphQL `collectionByHandle` → products | all 5 handles resolved (below) |
| Product ID / Variant ID / SKU / Vendor / Status / Title | Admin GraphQL `collection.products.variants` | 10-product sample from spider-light returned all fields incl. SKUs (e.g. ENC4449) |
| Sales (£) + Units Sold | **ShopifyQL Analytics**: `FROM sales SHOW total_sales, gross_sales, quantity_ordered, orders GROUP BY product_id, product_variant_sku SINCE -30d UNTIL today` | test run returned 10 rows, e.g. product 4417258848352 / SKU 24IP67100 = £985.00, 50 units; store total-sales summary £12,525.52 top-10 slice |
| Last Order Date | ShopifyQL `GROUP BY product_id, day` (max day) or Admin GraphQL orders search | verified orders queryable per product (Ripsan task method) |

Column-name discovery (do-not-assume rule): `net_quantity` and `sku`/`variant_sku` DO NOT exist in ShopifyQL — correct names are `quantity_ordered` and `product_variant_sku` (errors captured during testing).

## 3. Collections verified (all 5 exist)

| Handle | Collection GID | Title | Products |
|---|---|---|---|
| wall-light | gid://shopify/Collection/159869927520 | Wall Lights & Sconces | 230 |
| plugin-lighting | gid://shopify/Collection/159870615648 | Plug-in Lights | 35 |
| table-lamps | gid://shopify/Collection/159869960288 | Table Lamps | 28 |
| spider-light | gid://shopify/Collection/262856835233 | Spider Light | 58 |
| pendant-lights | gid://shopify/Collection/158085054560 | Top Pendant Lights & Hanging Lights | 879 |
| **Total** | | | **1,230 product memberships** (overlap possible — a product can be in several collections) |

## 4. Join key verified
`collection.products.legacyResourceId` (GraphQL) = `product_id` (ShopifyQL sales). Proven: spider-light product 8015418720506 (SKU ENC4449) also appears in sales/orders data. **Join: product_id.**

## 5. Reporting period
Requirement 2 explicitly states **Last 30 Days** → ShopifyQL `SINCE -30d UNTIL today`. Documented, not invented. (Note: rolling window relative to run date; today = 2026-07-02, so window ≈ 2026-06-02 → 2026-07-02, store timezone BST.)

## 6. Recommended extraction queries
1. **Per collection (×5):** GraphQL `collectionByHandle(handle){ products(first:50, after:$cursor){ id legacyResourceId title vendor status variants{ id legacyResourceId sku } } }` — paginate (≈25 pages total for 1,230 memberships).
2. **Sales:** ShopifyQL `FROM sales SHOW total_sales, gross_sales, quantity_ordered, orders GROUP BY product_id, product_variant_sku SINCE -30d UNTIL today` (paginate/increase LIMIT).
3. Join 1↔2 on product_id (+ SKU for variant grain); products with no sales row = £0.
4. Last Order Date: `FROM sales SHOW orders GROUP BY product_id, day SINCE -30d` → max(day) per product.

## 7. PostgreSQL objects checked
None usable: no Shopify sync tables exist (verified via information_schema scans earlier today — see dilaksi-requirement-2-product-priority-postgresql-evidence.md).

**Objects checked:** 5 collections, collection products sample, ShopifyQL sales cube (3 test queries), PostgreSQL order-table scan (prior evidence)
**Collections checked:** wall-light, plugin-lighting, table-lamps, spider-light, pendant-lights
**Files created:** this evidence + prompt, validation, closure, handover, source-map, docs entry
**Validation:** sources verified with live test queries; row counts recorded
**Status:** DISCOVERY COMPLETE — full extraction (~25 paginated calls) not run yet by design
**Known limits:** ShopifyQL total_sales includes discounts/returns effects (net-of-returns "total sales"); first sales row has blank product_id (deleted products bucket, £4,643.56) — will be excluded on join; collection overlap means a product may appear under multiple categories.
**Next step:** GPT/Kuberan approve full extraction → build Requirement 2 Shopify columns.
**PASS/FAIL:** **PASS** — Category, SKU, and Sales sources verified and documented; nothing guessed.
