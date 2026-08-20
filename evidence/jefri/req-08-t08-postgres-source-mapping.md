# Jefri Req 8 — T-08 — PostgreSQL Source Mapping (Read-Only Discovery)

**Date:** 2026-08-20 · **Team Member:** Jefri · **Requirement:** T-08

## Databases/schemas inspected (read-only — SELECT + information_schema only, no writes issued)
- `google_ads` schema — all 21 tables listed via `information_schema.tables`, columns of `campaign_performance` inspected in full.
- Whole-database search for any table named `%transaction%`, `%conversion%`, `%offline%`, `%attribution%`, `%utm%`.
- `order_management.orders` — columns matching `%utm%|%source%|%medium%|%campaign%|%term%|%shipping%|%total%|%tax%|%id%`.

## Findings

### Google Ads side — Transaction ID / conversion-level data
**Does not exist anywhere in this database.** Whole-DB search for `%transaction%`/`%conversion%`/`%offline%`/`%attribution%` returned only:
- `pg_catalog.pg_conversion` (Postgres system catalog, unrelated)
- `accounting.amazon_transactions`, `accounting.amazon_transactions_breakdown`, `accounting.shopify_transactions` (payment/accounting transactions — Amazon and Shopify payment gateway records, NOT Google Ads conversion tracking data)

No `google_ads.*` table contains a transaction ID, order number, or any per-conversion row. **Method 1 (exact Transaction ID attribution) has no data source in this database.**

### Google Ads side — Delta / Current-Update-vs-Last-Update data
`google_ads.campaign_performance` (the only campaign-level daily table with `conversion_value`) columns, in full:
`id, date, campaign_id, clicks, impressions, cost_micros, conversions, conversion_value, cost_per_conversion, ctr, cpc, cpa, cost, cpe, acos, roas, mobile_clicks, desktop_clicks, tablet_clicks, mobile_conversions, desktop_conversions, tablet_conversions`

This is a **flat, single-row-per-campaign-per-date aggregate** — one `conversion_value` number per campaign+date, upserted/overwritten on each data refresh. There is no "current update" vs "last update" pair of columns, no historical snapshot/versioning table found anywhere that would let us compute how much a given campaign+date's `conversion_value` changed between two points in time. **Method 2's core input (the Delta) has no data source in this database.**

### Bid-strategy bonus adjustment (New Customer bonus, High Value Customer bonus, etc.)
No column or table found anywhere referencing bid adjustments, bonuses, or bid-strategy multipliers. **This required Step-4 input has no data source in this database.**

### UTM data (for Order Summary field)
Whole-DB search for `%utm%` tables returned **zero results**. `order_management.orders` has no `utm_term`/`utm_source`/`utm_medium` column (full ID-column list checked: `id, order_id, sub_source_id, warehouse_id` — no UTM field). **The "Order Summary: UTM Term / Direct / Organic / Other" field has no data source in this database**, independent of the Google Ads blockers above.

### Shopify side — what DOES exist (for completeness, not currently usable without the above)
`order_management.orders` has `total` (numeric, grand total), `sub_total` (numeric — the likely "Order Value Excl. Shipping" candidate, not yet confirmed against `shipping_cost`+`tax` arithmetic), `shipping_cost`, `tax`, and `order_id` (varchar, likely the "Order Number"). This part of the requirement is plausible to satisfy on its own, but is moot without the Google Ads matching data.

## Conclusion
Three of T-08's required inputs (Transaction ID conversion data, Delta/versioned conversion data, bid-adjustment data) and one independent field's source (UTM) **do not exist anywhere in the currently connected read-only PostgreSQL database**. This is not an ambiguity or a naming-convention issue to resolve by more searching — the tables/columns genuinely are not present, confirmed via multiple whole-database searches, not just a single schema.
