# Source Map — Dilaksi Req 2: All Collections

**Title:** Data source map for the Req 2 all-collections rebuild
**Purpose:** Document every data source, tool, and file used
**Date:** 2026-07-07 · **Requirement number:** 2 · **Team member:** Dilaksi · **Team:** SEO

| Data | Source | Tool/Method | File |
|---|---|---|---|
| Store confirmation | Shopify Admin API | `get-shop-info` (MCP) — confirmed ledsone.co.uk, GBP, Advanced plan | — |
| All collections (475 real, ~350+ incl. catch-alls seen during manual pagination) | Shopify Admin GraphQL | `collections(first:50)` pagination, then superseded by Bulk Operations product export | — |
| All products/variants/collection membership | Shopify Admin GraphQL Bulk Operations API | `bulkOperationRunQuery` — 119,085 JSONL records, 5,179 products, 17,542 variants | `2026-07-07_req2-allcol-bulk-products.jsonl`, parsed by `2026-07-07_req2-allcol-parse-bulk.py` → `2026-07-07_req2-allcol-products-flat.csv`, `2026-07-07_req2-allcol-collections-summary.csv` |
| 30-day net sales/units/orders per variant | Shopify ShopifyQL analytics | `run-analytics-query` (MCP) — `FROM sales SHOW net_sales, net_items_sold, orders GROUP BY product_id, product_variant_id SINCE -30d UNTIL today` — 1,705 variant rows returned (rest are verified zero) | `2026-07-07_req2-allcol-sales-30d.csv` |
| Keyword derivation | Reused 2026-07-02 curated (30) + auto (1,157) map; new auto-cleaning rules for remaining 3,948 products | `2026-07-07_req2-allcol-derive-keywords.py` | `2026-07-07_req2-allcol-keyword-map.json`, `2026-07-07_req2-allcol-keyword-source.json` |
| Semrush demand (searches/mo) | Semrush `keyword_research` toolkit, `phrase_these` report, UK database | 25 batches × ~100 keywords = 2,456 new keyword lookups (~24,560 API units) + reused 2026-07-02 volumes (405 already known) | `_semrush_result_00.csv` … `_semrush_result_24.csv`, merged → `2026-07-07_req2-allcol-semrush-volumes-new.csv` |
| GA4 organic sessions | GA4 Data API, service account `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, property 408110563 | `2026-07-07_req2-allcol-ga4-fetch-script.py` — all organic landing pages, true last 30 days, Organic Search channel only, 2,766 rows | `2026-07-07_req2-allcol-ga4-organic-landing-30d.csv` |
| SEO Priority rule application | Approved 6-condition rule (unchanged from 2026-07-02) | `2026-07-07_req2-allcol-page-builder.py` | `2026-07-07_req2-allcol-seo-priority-log.csv`, `2026-07-07_req2-allcol-rows.json` |
| HTML build | Same design system as 2026-07-02 Req 2 page (CSS/JS reused, table replaced with dropdown for 475 collections) | `2026-07-07_req2-allcol-html-builder.py` | `pages/dilaksi-req2-all-products.html`, `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html` |

**Known limits documented:** Profit Margin N/A everywhere (COGS not in Postgres) — proven not required since max product sales (£1,705.42) is below both £4,000/£10,000 rule thresholds across the full catalog. Auto-derived keywords carry LOW/MEDIUM/AUTO confidence, not manually verified per-product.
