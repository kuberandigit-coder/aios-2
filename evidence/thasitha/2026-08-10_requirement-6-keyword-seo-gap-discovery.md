# Requirement 6 — Google Ads / Amazon Keyword → Product → Shopify SEO Gap Report

## Purpose
Help Thasitha identify products/SKUs where valuable advertising keywords are
performing well but the current Shopify SEO H1 and/or Meta Title does not
contain that keyword.

## Requester / Team
Thasitha · Google Ads · ledsone.de

## Business question
For products Thasitha advertises, which high-converting search keywords
(Google Ads, and — where the same SKU is also advertised on Amazon — Amazon)
are missing from that product's live Shopify H1 (Title) and/or Meta (SEO)
Title?

## Discovery summary (full reasoning happened live in chat, condensed here)

**Google Ads / PMax structural limitation (confirmed, not assumed):**
Thasitha's 3 campaigns (`google_ads.campaigns.group_name='Thasi'`,
`account_id=9031058245`) are all `PERFORMANCE_MAX`. PMax has no keyword
targeting — `google_ads.keyword_performance`/`keywords` returned 0 rows for
these campaigns. The closest real data is **search terms**
(`google_ads.pmax_campaign_search_term_data`), reported at
**campaign+date level only** — Google Ads provides no join from a PMax
search term to the specific product it was shown/clicked for anywhere in the
schema (checked `asset_group_product_group_performance` too — no shared key).

**Decision (user, 2026-08-10):** report campaign-wise. Each row = a real
product with real `google_ads.product_performance` in the selected date
range (top 15 by Conversion Value per campaign), tagged with its owning
campaign. The Google-side "Top Keyword" is that campaign's top search term
by conversion value — a campaign-level proxy, disclosed as such in the UI.

**eBay — excluded, not a guess:** every column in the `ebay_campaigns` schema
was checked; there is no keyword/search-term data anywhere. Not a linking
problem — the data was never captured.

**Amazon — included, real per-SKU signal:** `amazon_campaigns.performance_data`
has `listing_sku` + `ad_group_id` (indexed: `amazon_pd_listing_sku_idx`).
Confirmed 184 of Thasitha's 683 Google-side SKUs also exist as an Amazon
`listing_sku` (exact string match). Ad groups containing Thasitha's SKUs
range 1–~212 distinct SKUs (checked directly) — much tighter than Google's
campaign-wide targeting, so meaningful (occasionally exact, when the ad
group has 1 SKU). `amazon_campaigns.ads.listing_sku` has **no index** and a
full scan times out — the query uses `performance_data` instead, which does.

**Shopify live H1/Meta Title:** fetched live via the existing
`shopifyGraphQL()` pattern (`ledsone-de.myshopify.com`, `SHOPIFY_ADMIN_TOKEN`)
using `productByHandle` keyed on `listings.shopify_listings.shopify_handle` —
never read from the DB-cached `listings.shopify_listings.title` field. H1 is
treated as = Product Title (Shopify's default Online Store 2.0 theme
behavior) — **the LEDSone DE theme's actual template was not independently
verified**, flagged as a known limitation.

## Exact sources
- `google_ads.pmax_campaign_search_term_data` (search_term, clicks, cost, conversions, conversions_value; campaign_id + date filtered)
- `google_ads.product_performance` (product_item_id, cost, clicks, conversions, conversion_value; campaign_id + date filtered)
- `google_ads.campaigns` (group_name='Thasi' scoping)
- `listings.shopify_listings` (item_id → sku, shopify_handle; channel='LEDSone DE')
- `amazon_campaigns.performance_data` (listing_sku, ad_group_id, date)
- `amazon_campaigns.search_term_performance_data` (ad_group_id, search_term, clicks, spend, orders, sales; date filtered)
- Shopify Admin GraphQL API, live (`productByHandle` → `title`, `seo.title`)

## SKU → Product mapping
`google_ads.product_performance.product_item_id` → strip `shopify_` prefix
(same resolved_ids pattern as Req2/Req3) → `listings.shopify_listings.item_id`
→ `sku` + `shopify_handle`.

## Keyword matching rule
Case-insensitive, punctuation-stripped, whitespace-normalized substring
match of the full keyword phrase against normalized H1/Meta text.
Deterministic — no semantic/AI matching.

## Gap logic
- GAP: keyword in neither H1 nor Meta.
- H1 ONLY: in Meta but not H1.
- META ONLY: in H1 but not Meta.
- OK: in both.
- Gap Keywords: every real candidate keyword (Google + Amazon), not just the
  single Top Keyword, missing from both H1 and Meta.

## Files changed
- `reports/digital-marketing-member-pages/api/requirement.js` — new
  `thasithaReq6HandlerModule`, dispatched via `?fn=thasitha-req6`.
- `reports/digital-marketing-member-pages/pages/thasitha.html` — new R6
  sidebar nav item, `TAB_TITLES.R6`, `tabPanelR6` (KPI cards, date range +
  filters + sort, table, pager, status note), and the R6 load/render JS.

## Validation performed
- R1/R2/R3 APIs re-tested live after the R6 change — all HTTP 200, unaffected.
- R6 API tested live end-to-end: 51 rows for the full campaign-start-to-date
  range, real Google terms (36/51 rows), real Amazon terms (6/51 rows, real
  ad-group SKU counts observed: 15, 3378 — confirms tight vs. broad ad groups
  as discovered), 19/51 rows resolved live H1/Meta (rest N/A — legitimate
  catalog-coverage gap, same known-limitation pattern as R2/R3, not a bug).
- Sidebar/topbar/switchTab wiring confirmed live (`data-tab="R6"`,
  `tabPanelR6`, title present in served HTML).

## Known limitations
1. Google-side keyword attribution is campaign-level, not per-SKU (Google
   Ads platform limitation for PMax — cannot be fixed by better querying).
2. Amazon-side attribution is ad-group-level, not always per-SKU (Amazon
   platform limitation for Search Term Reports — same class of issue, but
   meaningfully tighter than Google's in practice).
3. H1 = Product Title is an assumption based on Shopify's default theme
   behavior; LEDSone DE's actual live theme template was not independently
   verified.
4. eBay excluded entirely — no keyword data exists for that channel.
5. Only the top 15 products per campaign (by conversion value) are shown,
   to keep the live Shopify lookup count bounded — not the full SKU catalog.

## Deployment
`vercel --prod --yes` from `reports/digital-marketing-member-pages/`.
Verified live via curl against `/api/requirement?fn=thasitha-req6` and the
served `thasitha.html`.

## Result
**PASS** — implementation complete, all required sources verified against
live data (not invented), R1-R5 unaffected, deployed and confirmed live.
Two open items for Thasitha to review: (1) the H1-vs-theme-template caveat,
(2) whether the campaign-level/ad-group-level proxy signal is useful enough
in practice, or whether she'd rather see it restricted to cases where the
Amazon ad group is small (e.g. <20 SKUs) for a tighter signal.
