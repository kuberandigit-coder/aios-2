# Evidence — Full Duplicate SKU Report (ledsone-de)

**Date:** 2026-07-01
**Author:** Claude (AIOS agent), on request of store owner
**Status:** PASS
**Store:** ledsone.de (ledsone-de.myshopify.com)

## Task objective
Find every duplicate SKU across the entire ledsone.de catalog and list ALL products sharing each SKU (not just one comparison pair), with all-time sales/orders attached, so the merchant can decide which duplicate listings to merge/archive.

## Business reason
Duplicate SKUs mean the same physical product is listed under 2+ separate product pages. This splits reviews, SEO authority, and ad performance across listings, confuses inventory tracking, and often lets a weaker/duplicate listing undercut the price of the better-performing "real" listing. The store owner needed a complete, current list to plan a catalog cleanup.

## Root cause discovered
Historical product creation created near-duplicate listings for the same physical part (often regional variants, re-imports, or re-listings for different collections) reusing the same manufacturer/internal SKU instead of merging into one product with variants. The most severe cases (176 of 1,079 groups) have 3 or 4 separate products sharing one SKU — these were invisible in the prior audit doc because its table only had columns for a single "Product A vs Product B" pair.

## Purpose
Extend the earlier `duplicate-sku-comparison` doc, which only showed ONE duplicate pair (Product A vs Product B) per SKU. This report finds and lists EVERY product sharing each duplicated SKU, with all-time sales/orders per listing.

## Method
1. Confirmed store had **2,507 products / 9,994 variants** via Shopify Admin GraphQL (`productsCount`).
2. Ran a Shopify Admin **bulk operation** (`bulkOperationRunQuery`) exporting all products + variants (id, title, status, handle, sku, price, variant title) — 12,501 JSONL records.
3. Downloaded the JSONL export and grouped variants by SKU. Found **1,088 SKUs used by more than one variant**; **1,079 of those span more than one product** (true duplicate-listing risk, as opposed to one product legitimately reusing a SKU across its own variants).
4. Pulled **all-time gross sales + order counts per product_id** via ShopifyQL (`FROM sales SHOW gross_sales, orders GROUP BY product_id, product_title SINCE 2015-01-01 UNTIL today`) — 1,414 products with recorded sales.
5. Merged sales data onto each duplicate listing, ranked listings within each SKU group by sales (highest = Primary), flagged listings whose price differs from the Primary listing's price with `(!)`.
6. Generated `duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report.docx`, then reformatted (landscape, fixed column widths) into `_v2.docx` after a layout review.

## Key numbers
- Total duplicate SKU groups (cross-product): **1,079**
- Groups with exactly 2 duplicate listings: **903**
- Groups with 3 duplicate listings: **163**
- Groups with 4 duplicate listings: **13**
- Total duplicate listing rows across all groups: **2,347**

## Why this differs from the prior doc
The prior `duplicate-sku-comparison 1 (1).docx` (23 June 2026, 1,075 groups) only recorded a single "Product A vs Product B" pair per SKU — any SKU shared by 3 or 4 listings was truncated to just 2. This report captures **176 groups (16%) that actually have 3 or 4 duplicate listings**, which were previously invisible.

## Shopify data source used
- Admin GraphQL API: `productsCount`, `bulkOperationRunQuery` (products → variants: id, title, status, handle, sku, price, variant title)
- ShopifyQL Analytics API: `FROM sales SHOW gross_sales, orders GROUP BY product_id, product_title SINCE 2015-01-01 UNTIL today`
- Bulk operation ID: `gid://shopify/BulkOperation/9456060825865`
- Both read-only — no store changes made

## Files inspected
- `C:\Users\PC\Downloads\duplicate-sku-comparison 1 (1).docx` — prior reference report, used to match table format/columns and confirm this new report is a superset of it
- Live Shopify bulk export JSONL (12,501 lines: 2,507 Product records + 9,994 ProductVariant records) — processed in a session scratchpad only, not stored in the repo
- Live ShopifyQL sales export (1,414 product rows with recorded all-time sales)

## Validation method
- Cross-checked `productsCount` (2,507) against the bulk export's product record count (2,507) — match.
- Excluded 13 variants with blank SKU from duplicate matching (blank isn't a real duplicate).
- Excluded 9 SKU collisions that were within a single product's own variants (not a duplicate-listing risk).
- Spot-checked 3 SKUs (`ICC35E1460-IDE`, `ICMUSHE2760-IDE`, `LDMT185E2742PK-IDE`) against the prior doc's figures — same product pairs reappear with consistent, slightly-grown sales (consistent with 1 week elapsed).
- Full detail in `validation/2026-07-01_ledsone-de-full-duplicate-sku-report.md`.

## Scan totals
- **Products scanned:** 2,507
- **Variants scanned:** 9,994
- **Duplicate SKU groups found (cross-product):** 1,079
- **Largest duplicate SKU group:** 4 products sharing one SKU (13 groups hit this max)

## Report output location
`duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report_v2.docx` — current, corrected version (landscape orientation, fixed-width columns so the `#` and `All-time Orders` columns no longer clip).
An earlier file of the same name without `_v2` also exists in that folder but is stale/superseded; it was left in place because it was open/locked in Word at the time of the fix and could not be overwritten.
