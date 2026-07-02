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

---

## UPDATE 2026-07-02 — FULL EXTRACTION EXECUTED (user-approved: "run the extraction")

**Method run:**
- Products: GraphQL `collectionByHandle → products(first:250)` — 8 calls total (wall-light 1 page/231, plugin-lighting 35, table-lamps 28, spider-light 58, pendant-lights 4 pages/879). All pages verified `hasNextPage:false` at end. **1,231 product memberships captured** (matches discovery counts +1 wall-light).
- Sales: ShopifyQL `FROM sales … GROUP BY product_id, product_variant_sku SINCE -30d UNTIL today` pulled twice (ORDER BY total_sales DESC LIMIT 1000 + ASC LIMIT 1000) → **1,711 unique sold rows, 289-row overlap proves full coverage** of every sold product/SKU in the window.
- Join on product_id; SKU-level match to variants; sold SKUs not in current variant list kept as "(sold under SKU: …)" rows; deleted-products bucket (blank product_id) excluded.

**Output file:** `reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv` — **5,576 variant-level rows** (Category, Product Title, Product ID, Variant ID, SKU, Total Sales £ last 30d, Units Sold, Orders, Vendor, Status).

**Per-collection results (last 30 days to 2026-07-02, BST):**

| Collection | Products | Products w/ sales | Sales (£) | Units |
|---|---|---|---|---|
| wall-light | 231 | 79 | 8,882.04 | 564 |
| plugin-lighting | 35 | 19 | 1,781.20 | 143 |
| table-lamps | 28 | 4 | 642.94 | 33 |
| spider-light | 58 | 22 | 2,356.41 | 61 |
| pendant-lights | 879 | 168 | 19,635.84 | 1,111 |
| **Total** | **1,231** | **292** | **33,298.43** | **1,912** |

(Products in multiple collections are counted per collection; total is membership-based, not deduplicated.)

**Known limits recorded:** Last Order Date column NOT included — ShopifyQL day-grain pull caps at 1,000 rows (covers only ~2026-06-21→07-02); precise per-product last-order dates need order-level paging, flagged as follow-up. total_sales is net of returns (some negative day rows observed). Rolling window = 2026-06-02→2026-07-02.

**PASS/FAIL:** PASS — extraction complete from verified sources, no guessed values.

## UPDATE 2026-07-02 — Requirement 2 data published to Dilaksi page + DEPLOYED (user-approved)

- `pages/dilaksi.html` Requirement 2 section now carries real Shopify data: top 30 products by sales, summary card Total Sales **£29,866.96 net of returns** (1,922 units, 292/1,231 products sold), TOTAL row, per-collection net breakdown in footnotes (pendant £17,992.58 · wall £8,520.03 · plugin £1,781.20 · spider £930.21 · table £642.94; gross before returns £33,298.43).
- Margin / Demand / Organic Sessions remain N/A, SEO Priority remains "Pending approval" — still no invented data.
- Standalone report `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html` synced as full copy (Req 1 + Req 2).
- Correction during build: first summary counted only positive rows (£33,298.43 gross); net figure including return adjustments is £29,866.96 — page displays net, gross noted.
- Deployed to Vercel production; verified live: page returns "Requirement 2 — Shopify Sales Data Loaded" and £29,866.96 at https://digital-marketing-member-pages.vercel.app/pages/dilaksi.html
