# Evidence — Mahima Requirement 4 (Product ID Coverage): full rebuild

Date: 2026-09-22
Repo: dm-dashboard, `dev-work` only
Staff: Mahima (Google Ads DE)

## User request

"First confirm the product only showing from ledsone.de and find the
duplicates" -> "is that are the same ids please check that" -> "so only
show these products from listings.shopify_listings with that listing id
= in the campaigns also" -> "fix the feed eligibility heuristic too".

## Investigation chain (every claim below was live-tested against the
real business Postgres database, not assumed)

1. **Wrong store scoping confirmed.** The query scoped by
   `currency = 'EUR'`, which is shared by 19+ unrelated
   `google_ads.merchant_products.feed_label` values (IT, EU, TRAFFIC,
   SHOUK, SMSH, CONVERSION, DEALL, and other campaign/asset-group-style
   labels) — not just Germany. Inflated the page to 26,831 "products"
   when scoping to the real `feed_label='DE'` gives 2,843.
2. **Massive cross-feed duplication confirmed.** 18,793 of 26,846
   norm_ids under the old scoping had 2+ conflicting rows across
   different feed_labels (one product had 488 rows across 12 labels).
3. **Even scoped to feed_label='DE', still wrong.** That table mixes TWO
   unrelated data sources: 451 products with `shopify_DE_<id>_<variant>`
   IDs, and 2,392 "products" with raw numeric IDs that only *look* like
   Shopify IDs.
4. **ID-level verification (the user's own catch) settled it.**
   Cross-referenced both groups against `listings.shopify_listings`
   (the real, separately-synced Shopify listings table) by exact ID
   match: only the 451 `shopify_DE_...`-pattern products matched a real
   listing. The 2,392 raw-numeric-ID group matched **zero** real
   listings, despite its aggregate count coincidentally being close to
   Shopify's real active-product count (2,504) — a genuinely misleading
   coincidence I initially got wrong before checking actual IDs.
5. **Ground truth established via Shopify's own Admin API directly**
   (`productsCount`): 2,711 total / 2,504 active products for
   `ledsone_de`. `listings.shopify_listings` (site='Germany',
   is_parent=1) gives 2,771 — within ~2% of the real API, confirming it
   as the authoritative source.
6. **Feed-eligibility heuristic was also broken** (found while explaining
   the first fix): ANY of 10 catalog columns blank flagged a product
   "Not Eligible" — live-tested, this hit 100% of the real catalog.
   Several of those columns are not universally required per Google's
   own Merchant Center product data spec (item_group_id only applies to
   variant products, color only to apparel, mpn only when no GTIN,
   product_types is merchant-optional, product_category is recommended
   not required).

## Fixes implemented

1. Rebuilt `MAHIMA_QUERY_R5`'s product universe on
   `listings.shopify_listings` (site='Germany', is_parent=1) instead of
   `google_ads.merchant_products` — Merchant Center feed data and
   campaign performance (`google_ads.product_performance`) are both LEFT
   JOINed onto it by the same normalized item_id used elsewhere in this
   codebase's own convention. A real Shopify product with no Merchant
   Center row now shows "Data Missing" (with its real Shopify
   title/category as fallback) instead of being silently excluded.
2. Split the 10 attribute columns into
   `MAHIMA_CRITICAL_ATTR_COLUMNS` (description/availability/price/
   condition/brand — genuinely blocks eligibility) and
   `MAHIMA_RECOMMENDED_ATTR_COLUMNS` (product_category/item_group_id/
   mpn/color/product_types — flagged as new "Needs Improvement" status,
   still feed-eligible). Added `summary.needsImprovement`/`fullyClean`;
   frontend gained a "Needs Improvement" KPI card + filter option.

## Live verification (real database, every number confirmed)

- `totalProducts`: 26,831 -> 2,843 (feed_label fix) -> **2,771** (real
  Shopify catalog rebuild), matching Shopify's own Admin API count
  within ~2%.
- Feed Eligible: 0 -> 2,194 (heuristic fix alone) -> **51** (after the
  catalog rebuild revealed most eligible-looking products were actually
  the bogus numeric-ID group); genuine Feed Issues 649 -> 400 on the
  real catalog.
- **Major new finding surfaced by the rebuild**: 2,320 of 2,771 real
  Shopify DE products (84%) have NO Google Merchant Center feed row at
  all — invisible under the old query since it only ever looked at
  whatever merchant_products happened to contain.
- Snapshot cache (10-day scheduled) manually refreshed via `Run Now`
  after each deploy; re-verified against the live production API
  directly after each deploy, not just locally.

## Status

Fully implemented and live-verified in production. Commits `87be999`,
`4c2e032`, `020c1d0`, all `dev-work` only per the standing instruction
given mid-session.
