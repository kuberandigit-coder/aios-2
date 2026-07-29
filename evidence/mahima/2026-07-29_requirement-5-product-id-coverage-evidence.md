# Evidence — Mahima Requirement 5: Product ID Coverage

**Title:** Product ID Coverage Tab — data source verification
**Purpose:** Record the exact PostgreSQL/Shopify/Google Ads sources checked and used for each of the 22 required columns.
**Requirement Source:** prompts/mahima/2026-07-29_requirement-5-product-id-coverage-prompt.md
**Team Member:** Mahima
**Business Question:** see prompt doc.

## PostgreSQL Sources Checked
- `google_ads.merchant_products` (country='DE') — universe of all products in Mahima's feed. Live-verified: 5,274 distinct DE products (deduped by normalized product ID).
- `google_ads.product_performance` — clicks, impressions, conversions, cost, conversion_value, per campaign_id/product_item_id/date, for Mahima's 5 campaign IDs. Live-verified data spans 2024-11-20 to 2026-07-29.
- `google_ads.campaigns` — campaign_id → campaign_name, live-verified all 5 of Mahima's campaigns present.
- `raw_data.gmc_product_diagnostics_daily` — re-checked live 2026-07-29: **does not exist** (dropped; was merely empty as of 2026-07-09, see `evidence/mahima/2026-07-09_mahima_req1_missing_attribute_evidence.md`). Confirms no real Feed Status/Missing Attribute source exists.
- `search_objects` (table pattern `%diagnostic%`, column patterns `%feed_status%`, `%eligib%`) — 0 results each, confirming no alternate real source exists anywhere in the database.

## Shopify Sources Checked
- None required for this tab (Current Stock is not one of the 22 spec columns for Req5; Product ID/SKU come directly from the Postgres merchant feed, same as Req1's `product_item_id` parsing).

## Google Ads Sources Checked
- No live Google Ads API / Merchant Center connector exists in this project — all Google Ads data is accessed via the PostgreSQL export tables above (same architecture as Req1/Req2/Req3).

## SQL validated live (2026-07-29)
- Bounds/range/prev-range CTEs tested standalone — correctly resolve to trailing 30-day current window (2026-06-30 to 2026-07-29) and the preceding 30-day window (2026-05-31 to 2026-06-29).
- Full query (merchant catalog LEFT JOIN campaign performance, previous period, last-conversion-date) tested with `LIMIT 5` against the live database — returned correct shape, multi-campaign array_agg working, previous-period columns populated, last_conv_date populated.

## Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js` — added `MAHIMA5_QUERY`, `mahimaReq5Handler`, `mahima5MissingAttribute`, `mahima5SuggestedAction`, `mahima5Priority`; wired `fn=mahima-req5` dispatch.
- `reports/digital-marketing-member-pages/pages/mahima.html` — added Tab 5 panel (KPI cards, filters, colored table, legend, sources, limitations), CSS badge classes, and JS (fetch/render/filter/export).

## Evidence Location
This file; live curl verification against production endpoint (see validation doc).
