# Source Map — Mahima Requirement 4: real Shopify DE product source

Date: 2026-09-22

| # | Source | Purpose | Authority | Data used | Read/Write | Status |
|---|---|---|---|---|---|---|
| 1 | `listings.shopify_listings` (business Postgres, `site='Germany', is_parent=1`) | **NEW base product universe** for Product ID Coverage — the real, separately-synced Shopify listings table | Authoritative — verified against Shopify's own Admin API within ~2% | item_id, title, product_type, price, status | Read-only | Live, newly adopted this task |
| 2 | Shopify Admin API (`ledsone_de`, `productsCount`) | Ground-truth verification only, not used at request-time by the page | Authoritative (direct Shopify API) | Total/active/draft product counts | Read-only, one-off verification call | Used to validate #1, not wired into the live query |
| 3 | `google_ads.merchant_products` (`feed_label='DE'`) | Feed attribute/eligibility data — LEFT JOINed onto #1, no longer the base product list | Partially unreliable — confirmed to contain a second, unrelated data source with non-Shopify IDs (see evidence.md) | product_category, item_group_id, mpn, color, condition, description, product_types, availability, brand, price | Read-only | Still used, but only as a joined attribute source now |
| 4 | `google_ads.product_performance` | Campaign stats (clicks/impressions/conversions/cost) — joined by the same normalized item_id | Existing, unchanged | Per-campaign daily metrics | Read-only | Unchanged |

## Explicitly identified as NOT a reliable Shopify source

`google_ads.merchant_products` rows with `feed_label='DE'` but a raw
numeric `product_id` (not matching `shopify_DE_<id>_<variant>`) —
2,392 rows, verified live to match ZERO real Shopify listings by exact
ID comparison against `listings.shopify_listings`. Left untouched in
the source table; simply not joined into this report's product universe
anymore.
