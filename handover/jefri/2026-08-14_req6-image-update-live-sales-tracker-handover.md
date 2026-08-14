# Handover — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Let another LLM or team member understand and continue this work without verbal explanation.

**This feature went through 3 iterations same day, each following an explicit correction from Kuberan.** If you find any reference to a single search-box-then-one-result form, or to a per-row manual date `<input>`, that's an OLD version — ignore it. This document describes the FINAL, current architecture only.

## What Req 6 does
A "Requirement 6" tab in `jefri.html`. **Always shows a table of every listing belonging to Jefri** (all ~8,127 distinct product/listing IDs that have ever run in Jefri's 5 Google Ads campaigns) — no search or manual input required to see it; a search box only filters the already-loaded table. As each row scrolls into view, it automatically fetches (no user action) its real Image Update Date live from Shopify, then computes and displays SKU, Days Live, Total Sales Since Update, Pre-Update Baseline Sales, % Change, and a Trend badge (Improved / Same / Dropped / Insufficient data).

**There is no manual date input anywhere in this feature.** Image Update Date is 100% derived from Shopify's own image metadata.

## Where it's implemented
- **Backend:** `reports/digital-marketing-member-pages/api/requirement.js` — search for `jefriReq6HandlerModule` (a self-contained IIFE right after `jefriReq5HandlerModule`, before `module.exports`). It returns `{ handleJefriReq6, handleJefriReq6List }` (an object, not a bare function — different from most other handler modules on this page). Two routes:
  - `GET /api/requirement?fn=jefri-req6-list` — all Jefri listings (`listingId`, `sku`, `level`, `matched`), no params. This is what the table loads on tab open.
  - `GET /api/requirement?fn=jefri-req6&listingId=<id>` — per-row calculation, including the live Shopify image-date lookup. No other params.
- **Frontend:** `reports/digital-marketing-member-pages/pages/jefri.html` — search for `req6Tab` (HTML panel: search bar + table, no form) and `r6Init`/`r6LoadList`/`r6Calc`/`r6PatchRow`/`r6Render` (JS, appended after Req5's `r5ExportCsv` wiring inside the same `<script>` block). Nav item: `<li><a data-req="req6">Requirement 6</a></li>`.

## How the data flows
1. Tab opens → `r6LoadList()` fetches `fn=jefri-req6-list`, renders all matching rows immediately with `–` placeholders in every calculated column.
2. An `IntersectionObserver` (recreated on every `r6Render()`, rooted on the table's own `.scroll` container) watches every rendered row. As a row scrolls into the visible area (plus a 200px margin), `r6Calc(listingId)` fires exactly once for that row (guarded by `R6_CALC[listingId]` already being set) and the observer stops watching it.
3. `r6Calc` calls `fn=jefri-req6&listingId=<id>`. Backend:
   a. Resolves `listingId` → `listings.shopify_listings` row (`item_id`, `sku`, `is_parent`, `is_child`), channel `'LEDSone DE'`.
   b. If the listing is a child/variant, resolves its parent Shopify **product** ID via `listings.shopify_listings_parent_child_mapping` (images live on the product, not the variant).
   c. Calls `fetchShopifyImageUpdateDate(productId)` — Shopify Admin **REST** API, `GET /admin/api/2024-10/products/{productId}/images.json`, takes `MAX(updated_at)` across all images on that product. Cached 24h server-side per product ID.
   d. Computes `daysLiveSinceUpdate = today - imageUpdateDate` (whole days).
   e. Runs two identical-shaped Postgres sales queries against `order_management.orders` + `order_item_info` (`sub_source_id=108`, `status='Completed'`, matched on `product_id` if Parent, `variant_id` if Variant/child):
      - Post window: `order_date >= imageUpdateDate` (open-ended)
      - Baseline window: `[imageUpdateDate - daysLiveSinceUpdate days, imageUpdateDate)` — always exactly `daysLiveSinceUpdate` days long, by construction
   f. `pctChangeVsBaseline = ((post - baseline) / baseline) × 100`, or `null` if baseline is `0`/the window is empty.
   g. `trend`: `Improved` if `≥ +15`, `Dropped` if `≤ -15`, `Same` otherwise, `Insufficient data` if `pctChangeVsBaseline` is `null`.
4. `r6PatchRow(listingId)` updates just that row's cells in place (not a full table re-render — with 8,127 rows, re-rendering the whole table on every background fetch completion would be janky and would reset scroll position).

## Listing source ("what does 'Jefri listings' mean")
Every distinct `product_item_id` that has ever appeared in `google_ads.product_performance` for Jefri's 5 named campaigns (same 5 campaigns as Req1/Req4/Req5) — confirmed with Kuberan via an explicit clarifying question before building, not assumed. Resolved to a Shopify listing the same way Req1/Req4/Req5 do (raw ID or `shopify_de_<parent>_<variant>` format → `listings.shopify_listings.item_id`). Deduped on the resolved Shopify listing, since multiple raw Ads ID formats can point at the same real listing.

## Listing ID → SKU mapping
`listings.shopify_listings.item_id` (text, the raw Shopify product/variant ID) → `.sku`. In this store, **every** `is_parent=1` row has `sku IS NULL` (2,704 variation-template rows, `all_list=0` — not real sellable listings); all 11,722 `is_child=1` rows have a real SKU. So in practice every valid Listing ID resolves as `level: "Variant"`. Verified with a `GROUP BY is_parent, is_child` count query, not assumed.

## Image Update Date source (the part that changed twice)
Shopify Admin **REST** API — `GET /admin/api/2024-10/products/{productId}/images.json`, `MAX(updated_at)` across the product's images. REST was chosen deliberately over GraphQL: the `Image` type used elsewhere in this file (for live stock lookups) does not expose per-image timestamps in GraphQL; REST's image object does, reliably.

**Known scope gotcha (already hit once, fixed):** `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_API_VERSION`, used for live-stock GraphQL calls elsewhere in `requirement.js`, are declared with zero indentation and LOOK like file-level constants — they are actually inside `jefriProductStatusHandlerModule`'s own IIFE (lines 9–1345) and are NOT reachable from other modules further down the file. `jefriReq6HandlerModule` hit a `ReferenceError` on first deploy because of this. Fixed by duplicating the two constants locally as `R6_SHOPIFY_STORE_DOMAIN`/`R6_SHOPIFY_API_VERSION` — this file already has a precedent for the same workaround (`T2_SHOPIFY_STORE_DOMAIN`). **If you add another Shopify Admin API call anywhere in this file, check which IIFE the constants you want actually live in before assuming they're reachable.**

## PostgreSQL source
Read-only. Tables: `listings.shopify_listings`, `listings.shopify_listings_parent_child_mapping`, `order_management.orders`, `order_management.order_item_info`. Same DB pool/connection pattern as every other handler in `requirement.js`.

## Sales source
Gross line-item revenue: `item_price × item_quantity`, `status = 'Completed'`, `sub_source_id = 108` (Shopify DE / ledsone.de). Identical definition to Req5's `SHOPIFY_SALES_QUERY` — deliberately reused, not reinvented.

## Baseline logic
Always exactly `daysLiveSinceUpdate` calendar days immediately before Image Update Date. Not a fixed 7/30-day window — enforced structurally (the baseline start date is derived FROM `daysLiveSinceUpdate`, so it cannot drift out of sync).

## Trend logic
`Improved ≥ +15%`, `Same` from `-14%` through `+14%`, `Dropped ≤ -15%`. Boundaries inclusive on both sides.

## Known edge cases
- **Zero baseline** (baseline sales = £0, `daysLiveSinceUpdate > 0`): `pctChangeVsBaseline: null`, `trend: "Insufficient data"`, `zeroBaseline: true`. Reused muguntha.html's "Target Achievement" N/A convention rather than inventing a new rule. Very common in practice — most listings' images were last updated long before any recent sales window exists, so their "baseline" period (e.g. 2021) legitimately has £0.
- **No Shopify image match / no images on the product**: `found:true` with an `error` string, no crash.
- **Listing not found / no SKU**: `found:false` or `sku:null` plus a human-readable `error` string.
- **Unmatched Ads items** (no Shopify listing at all): shown in the list table as "Unmatched", never sent for per-row calculation (nothing to calculate).

## Files changed
- `reports/digital-marketing-member-pages/api/requirement.js` (both repos)
- `reports/digital-marketing-member-pages/pages/jefri.html` (both repos)

## Validation status
PASS. Original 10-test suite (Improved/Same/Dropped classification, exact thresholds, zero-baseline, equal-length baseline, dynamic days-live, Listing ID→SKU resolution, no regression to existing tabs) all still hold — the formula/threshold logic was never touched across any of the 3 reworks, only how Listing ID and Image Update Date get INTO that logic changed. Re-verified live post-Shopify-integration with real listings (`44963099312393`, `57163495964937`) and confirmed sales totals match figures observed independently earlier in the session. See `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md` and the evidence file's two CORRECTION sections for the full live-test trail.

## Deployment status
DEPLOYED — live at `https://dm-dashboard.vintageinterior.co.uk/pages/jefri.html#req6`. Confirmed via direct `curl` against `fn=jefri-req6-list` (8,127 rows) and `fn=jefri-req6` (real Shopify-sourced dates + correct sales/trend), and `scripts/check-live-deploy.js` shows no regression to any other feature.

## Next action
None outstanding. One open, non-blocking question for Jefri: currency in € instead of £ — a one-line change in `r6Money()` in `jefri.html`.
