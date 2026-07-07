# Evidence — Dilaksi Req 2: All Collections Scope Expansion

**Title:** Full-catalog rebuild of Product Priority Guidance page
**Purpose:** Verifiably prove scope moved from 5 collections to all real collections, with real source data
**Date:** 2026-07-07 · **Requirement source:** GPT planning layer, user-approved · **Requirement number:** 2
**Team member:** Dilaksi · **Team:** SEO
**Scope change:** 5 collections → ALL collections
**Business question:** Which products should be prioritised for SEO across the entire catalog?

## Data sources used
Shopify Admin GraphQL (Bulk Operations API), Shopify ShopifyQL analytics, Semrush `keyword_research`/`phrase_these` (UK), GA4 Data API. Full detail: `source-map/2026-07-07_dilaksi_req2_all_collections_source_map.md`.

## Collections checked
Confirmed via `get-shop-info` that the connected store is `ledsone.co.uk` (not `ledsone.de`, which was initially connected — corrected before any data pull). Manually paginated `collections(first:50)` through 450+ raw collection objects, discovering the store has catch-all/marketing/seasonal/vendor-batch/junk collections mixed in with real merchandising niches. Per explicit user decision ("literally everything"), **no exclusions applied** — every collection a product actually belongs to (475 distinct collections found via the product-level Bulk Operations export) is represented in the page.

## Fields collected
Per product: collection(s), title, product ID, variant ID(s), SKU(s), sales (£, 30d), units sold, orders, status, vendor. Per row: demand (searches/mo + keyword), organic sessions (30d), SEO Priority, matched rule condition, confidence.

## SEO Priority rule used
Unchanged 6-condition rule from 2026-07-02 (see rule box on page). Applied to all 5,179 products.

## Results
- **5,179 products** processed (17,542 variants), up from 1,231 in the 5-collection version.
- **475 distinct collections** referenced across the catalog (product-level truth, more reliable than the raw collection list which includes 0-product/empty collections).
- Sales (30d): **1,705 of 17,542 variants had nonzero activity**; the rest verified zero via the same ShopifyQL query (no separate zero-check needed — ShopifyQL returns only nonzero-metric rows for this cube).
- Max single product 30d sales: **£1,705.42** — confirmed below both the £4,000 and £10,000 Profit-Margin-dependent rule thresholds, so **Profit Margin (still N/A, COGS pending) is proven not required for any of the 5,179 rows**. Nothing invented.
- Semrush: 405 keywords already had volume from 2026-07-02; **2,456 new unique keywords looked up across 25 batches (~24,560 API units)**, approved in advance by the user with the exact unit estimate.
- GA4: all-site organic landing-page sessions pulled fresh (2,766 rows, last 30 days, Organic Search channel only) — this query has no collection filter, so it already covered the full catalog without extra API cost.
- SEO Priority counts: **High 313 · Medium 1 · Low 992 · Low — flag for review 3,873** (5,179 total).

## Files created or modified
- Builder scripts: `2026-07-07_req2-allcol-parse-bulk.py`, `2026-07-07_req2-allcol-derive-keywords.py`, `2026-07-07_req2-allcol-ga4-fetch-script.py`, `2026-07-07_req2-allcol-page-builder.py`, `2026-07-07_req2-allcol-html-builder.py`
- Data: bulk JSONL export, flattened products CSV, collections summary CSV, sales CSV, keyword maps (JSON), 25 Semrush batch result CSVs + merged volumes CSV, GA4 CSV, priority log CSV, rows JSON — all under `reports/dilaksi/data/`
- Pages updated/created: `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` (updated), `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html` (new)
- AIOS: this file + 6 companion files (prompt, validation, closure, handover, source-map, vercel notes)

## Guardrails
Requirement 1 page, all other member pages, EOD, Blog tool, Shopify themes untouched. No live Shopify/GA4/Semrush/PostgreSQL data was modified — only read operations performed. Not deployed to Vercel (approval pending per rule).

**Evidence path:** this file · **Validation result:** see `validation/2026-07-07_dilaksi_req2_all_collections_validation.md`
**Status:** Completed locally — deploy approval pending
**Known limits:** Profit Margin N/A (COGS pending, proven not required); auto-derived keywords for ~4,940 of 5,179 products carry LOW/MEDIUM/AUTO confidence (not manually curated); the raw Shopify collection list includes many 0-signal/junk/seasonal collections that were deliberately still included per explicit user instruction.
**Next step:** user/GPT review → approve Vercel deployment.
**PASS/FAIL rule:** PASS — all displayed values traced to executed live queries; scope verifiably expanded; SEO Priority rule applied exactly; AIOS complete; zero invented data.
