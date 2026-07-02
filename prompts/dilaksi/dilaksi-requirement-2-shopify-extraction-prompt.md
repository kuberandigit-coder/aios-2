# Prompt — Requirement 2 Shopify Full Extraction (Reusable)

**Title:** Extract Category/SKU/Sales for the 5 collections
**Purpose:** Reusable prompt to run the full extraction after discovery approval.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?

## Reusable prompt
> Using the verified sources in `source-map/dilaksi-requirement-2-shopify-source-map.md`:
> 1. For each handle (wall-light, plugin-lighting, table-lamps, spider-light, pendant-lights) paginate GraphQL `collectionByHandle → products(first:50) { legacyResourceId title vendor status variants { legacyResourceId sku } }` until hasNextPage=false (~1,230 memberships).
> 2. Run ShopifyQL: `FROM sales SHOW total_sales, gross_sales, quantity_ordered, orders GROUP BY product_id, product_variant_sku SINCE -30d UNTIL today` (raise LIMIT / paginate).
> 3. Join on product_id; missing sales row → £0.00 / 0 units. Exclude the blank-product_id bucket (deleted products).
> 4. Last Order Date: `FROM sales SHOW orders GROUP BY product_id, day SINCE -30d` → max day per product.
> 5. Output per product: Category, Product Title, Product ID, Variant ID, SKU, Total Sales (£), Units Sold, Collection, Vendor, Status, Last Order Date. Save row counts per collection in evidence.
> 6. Column names are exact — `product_variant_sku` and `quantity_ordered` (`sku`/`net_quantity` do not exist).

**Objects checked / Collections checked:** see evidence file
**Files created:** this prompt (extraction not yet run)
**Validation:** discovery PASS; extraction pending approval
**Status:** READY · **Known limits:** rolling -30d window; collection overlap
**Next step:** approval → run extraction → feed Requirement 2 build
**PASS/FAIL:** PASS only if all values come from these verified queries.
