# Evidence — Full Duplicate SKU Report (ledsone-de)

**Date:** 2026-07-01
**Store:** ledsone.de (ledsone-de.myshopify.com)
**Purpose:** Extend the earlier `duplicate-sku-comparison` doc, which only showed ONE duplicate pair (Product A vs Product B) per SKU. This report finds and lists EVERY product sharing each duplicated SKU, with all-time sales/orders per listing.

## Method
1. Confirmed store had **2,507 products / 9,994 variants** via Shopify Admin GraphQL (`productsCount`).
2. Ran a Shopify Admin **bulk operation** (`bulkOperationRunQuery`) exporting all products + variants (id, title, status, handle, sku, price, variant title) — 12,501 JSONL records.
3. Downloaded the JSONL export and grouped variants by SKU. Found **1,088 SKUs used by more than one variant**; **1,079 of those span more than one product** (true duplicate-listing risk, as opposed to one product legitimately reusing a SKU across its own variants).
4. Pulled **all-time gross sales + order counts per product_id** via ShopifyQL (`FROM sales SHOW gross_sales, orders GROUP BY product_id, product_title SINCE 2015-01-01 UNTIL today`) — 1,414 products with recorded sales.
5. Merged sales data onto each duplicate listing, ranked listings within each SKU group by sales (highest = Primary), flagged listings whose price differs from the Primary listing's price with `(!)`.
6. Generated `duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report.docx`.

## Key numbers
- Total duplicate SKU groups (cross-product): **1,079**
- Groups with exactly 2 duplicate listings: **903**
- Groups with 3 duplicate listings: **163**
- Groups with 4 duplicate listings: **13**
- Total duplicate listing rows across all groups: **2,347**

## Why this differs from the prior doc
The prior `duplicate-sku-comparison 1 (1).docx` (23 June 2026, 1,075 groups) only recorded a single "Product A vs Product B" pair per SKU — any SKU shared by 3 or 4 listings was truncated to just 2. This report captures **176 groups (16%) that actually have 3 or 4 duplicate listings**, which were previously invisible.

## Data sources
- Bulk operation ID: `gid://shopify/BulkOperation/9456060825865`
- Live GraphQL Admin API + ShopifyQL Analytics API (both read-only, no store changes made)
