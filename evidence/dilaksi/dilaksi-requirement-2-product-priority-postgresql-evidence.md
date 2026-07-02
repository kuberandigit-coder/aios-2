# Evidence — Dilaksi Requirement 2: Product Priority Guidance (STOPPED at discovery)

**Title:** Requirement 2 PostgreSQL discovery — Product Priority Guidance (Last 30 Days)
**Purpose:** Verify PostgreSQL can supply Category, SKU, Sales £, Profit Margin, Demand (searches/mo), Organic Sessions, SEO Priority for 5 collections before building.
**Requirement source:** Google Sheet — "Product Priority Guidance — Sample (Last 30 Days)"; collections: wall-light, plugin-lighting, table-lamps, spider-light, pendant-lights
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?
**Date:** 2026-07-02 · **Owner/reviewer:** Kuberan (GPT validation layer) · **Mode:** read-only

## Existing asset search
- Grep all AIOS md for "product priority / seo priority / profit margin / search volume": no prior Requirement 2 assets. Requirement 1 assets exist (dilaksi GA4 SEO report). **Duplicate-risk: GREEN.**
- `pages/dilaksi.html` exists (Requirement 1) — confirmed present, untouched.

## PostgreSQL objects inspected (read-only)

| Object | What it offers | Gap |
|---|---|---|
| staging_ai.master_sku_cluster_growth_model | sku, product/collection URL, listing_price, estimated_gross_margin (interim 20% cost proxy), sales_90d, revenue_90d, organic clicks/position, cluster_growth_priority_score | **Only 5 rows** (1 SKU per pilot collection, snapshot 2026-06-09); collections = spider-lamp, lampshades, led-panels, wall-lights, three-outlet/plugin — does NOT match Dilaksi's 5; 90-day not 30-day; margin is a proxy (cost assumed 20% of price) |
| staging_ai.seo_aeo_page_opportunity_baseline | url, organic_sessions_90d, organic_revenue_90d, priority_score_0_100, recommended_action | 14 pages only (2026-06-09); page-level not SKU-level; 90d |
| development.seo_organic_baseline | keyword, position, search_volume (Semrush), url | keyword-level demand; needs URL→SKU mapping; no sales/margin |
| Order/sales tables (public.order_transaction, amz/ebay expenses, supplier.orders, marketing_sales_truth_ledger etc.) | various | none provide Shopify per-SKU UK web sales for last 30 days at collection grain |
| Column scans: priorit|margin|profit|search_volume|demand (full DB) | 200+ columns reviewed | no `seo_priority` field for the requested collections/SKUs |

## STOP CONDITIONS TRIGGERED
1. **SEO Priority source missing** for the requested scope: no approved seo_priority field or rule mapping covering the 5 collections' SKUs. (Closest: `cluster_growth_priority_score` / `priority_score_0_100`, but they cover only pilot rows from 2026-06-09 and are different, unapproved definitions.)
2. **Required fields missing at requested grain:** per-SKU Sales (£) last 30 days does not exist in PostgreSQL (no Shopify order-line table); profit margin exists only as an interim 20%-cost proxy on 5 pilot SKUs.
3. **Last 30 days filter unavailable** for every candidate source (data is 90-day and/or a 2026-06-09 snapshot).
4. **Collections mismatch:** pilot collections ≠ Dilaksi's requested five (only plugin-lighting partially overlaps; wall-lights vs wall-light).

## What COULD be built without inventing data
- **Option A — "Sample" section from pilot data, heavily labelled:** show the 5-row pilot from master_sku_cluster_growth_model (sample SKUs, 90d revenue, proxy margin, organic clicks; demand joined from seo_organic_baseline where URL matches), with SEO Priority column rendered as "Pending approval — no approved SEO priority logic in PostgreSQL". Honest but does NOT match the requested collections/date range.
- **Option B — pipeline extension first:** add per-SKU Shopify 30-day sales, real COGS margin, Semrush demand mapping, GA4 organic sessions per product, and an approved SEO priority rule; then build to spec.
- **Option C — placeholder section only:** add Requirement 2 section to dilaksi.html with structure + "Data pending: source not yet in PostgreSQL" (fastest, zero data risk).

**PostgreSQL source checked:** as table above (22 schemas, full column scans)
**Files created/modified:** this evidence file only — dilaksi.html NOT touched (Requirement 1 intact)
**Evidence path:** this file
**Validation result:** N/A — build stopped
**Status:** STOPPED — awaiting GPT/requester decision (A/B/C)
**Known limits:** Google Sheet not opened directly; requirement taken from prompt text.
**Next step:** GPT/Kuberan choose Option A, B, or C.
**PASS/FAIL rule:** Building now with invented SEO priority or fake 30-day sales would FAIL; stopping with evidence = correct.
