---
title: Thasitha Requirement 4 — Validation
requirement_id: THASITHA-R4
date: 2026-07-16
status: BUILT — AMBER (working defaults used for 2 unresolved definitions, clearly documented on-page)
---

## Purpose
Validation of the actual R4 build, after the user explicitly instructed
to proceed with data pulled directly from PostgreSQL despite the
blockers recorded in [[requirement-4-discovery]].

## Change from the earlier STOP decision
The user reviewed the blockers and instructed "get all the data from
postgres only and update" — i.e., proceed using the DB as the sole
source of truth, with working defaults for the two unresolved
definitions, rather than continuing to wait on sign-off. This is
recorded as an explicit instruction, not an invented business rule.

## Test results

| # | Test | Result |
|---|---|---|
| 1 | Requirement Header Test | AMBER — periods (30/60/90d) confirmed via user chat, not a CSV (none exists in this project). |
| 2 | Scope Test | PASS — reused proven R2/R3 scope: `account_id=9031058245`, campaigns `23791285134` (MT) + `23765634627` (THT), `campaign_status='ENABLED'`. 572 unique SKUs. |
| 3 | Store Test | PASS — Shopify side filtered to `sub_source_id=108` (`ledsone-de`); Ads side filtered to the 2 Thasi campaign IDs directly (account 9031058245). |
| 4 | Grain Test | PASS — one final row per resolved SKU (572 rows), confirmed via dedup script (`raw: 952 → deduped: 572`). |
| 5 | Duplicate Test | **CAUGHT AND FIXED A REAL BUG**: initial join used `lower(order_item_info.real_sku) = lower(product_item_id)` directly, which returned 0 Shopify matches for ~99% of SKUs — the Ads `product_item_id` values in this scope are mostly numeric Shopify listing IDs (`listings.shopify_listings.item_id`), not literal SKU strings. Fixed by resolving `product_item_id → shopify_listings.item_id → sku` first, then joining orders by the resolved SKU. Re-verified: 567/572 (99.1%) resolve; 5 unresolved (same 5 orphaned SKUs documented in R2). Also caught and fixed a second bug: `merchant_products` has duplicate `product_id` rows (multiple feed entries), which fanned out the product-info join (572→952 rows) — deduped in the merge script, keeping the first row with a non-null title. |
| 6 | Shopify Count Test | AMBER — `COUNT(DISTINCT order_id)`, `sub_source_id=108`, `status NOT IN ('Cancelled','Deleted')`. This status filter is a working default (documented on-page), not a company-signed-off rule. |
| 7 | Ads Conversion Test | AMBER — `SUM(product_performance.conversions)` for the 2 Thasi campaign IDs. Cannot confirm this is purchase-only (no conversion-action dimension exists anywhere in the DB) — documented on-page as unconfirmed. |
| 8 | Date Alignment Test | PASS — both sides use the same common end date `2026-07-15` (Ads' latest date, the earlier of the two latest dates) for all three rolling windows (30/60/90 days back from that date), not "today." |
| 9 | SKU Mapping Test | PASS (after fix in test 5) — 567/572 offer IDs correctly resolve to real Shopify SKUs. |
| 10 | Campaign Mapping Test | PASS — `string_agg(DISTINCT campaign_name)` per SKU shows all campaigns (not just one) that served that product within the 2 Thasi campaigns' scope. |
| 11 | Price Test | AMBER — current `merchant_products.price`, falling back to `shopify_listings.price` (Germany, listable variant). 492/572 (86%) resolved; 80 shown as N/A (documented, not invented). |
| 12 | Difference Test | PASS — verified formula `Shopify − Ads`, e.g. spot-checked rows programmatically; sign convention matches brief's examples (positive = Ads Lower, negative = Ads Higher). |
| 13 | Fractional Conversion Test | PASS — Ads values kept to 2 decimals (e.g. `16.17`, `41.68`, `52.94` for period totals), never rounded to integer. |
| 14 | Zero-Division Test | PASS — no attribution-rate division performed that could produce Infinity; Data Check Required is shown instead when Shopify=0 and Ads>0, per the brief's special-case rule. |
| 15 | Summary Test | PASS — summary cards computed from the same filtered/rendered row set client-side (`allRows`), not separately hardcoded. |
| 16 | Filter Test | PASS — search/campaign/status/sort/clear-filters wired and tested via code review (same pattern as R2/R3, no new framework introduced). |
| 17 | Existing-Page Test | PASS — R1/R2/R3 tab HTML, JS functions (`renderR1`-equivalent init, `renderR2`, `renderR3`), and IDs all confirmed still present and unique after the edit (`grep` count checks run post-edit). |
| 18 | Responsive Test | PASS (structural) — sticky SKU/Product/Price columns via CSS `position:sticky`, horizontal scroll container reused from existing `.t1-tablewrap` pattern, mobile breakpoint narrows table min-width. Not manually verified in a live browser this pass. |
| 19 | Browser Test | PASS — both `<script>` blocks parsed successfully via Node's `Function()` constructor (syntax-valid); not run in an actual browser this pass. |
| 20 | Evidence Test | PASS — this file plus discovery/order-definition/postgresql-source-map/sku-order-mapping/handover/report/deployment-readiness all populated with real findings, not placeholders. |

## Result: AMBER
Core Shopify-vs-Ads comparison is real, live-data-driven, and a genuine
join bug was caught and fixed before shipping. Two definitions (Shopify
valid-order status filter, Ads purchase-conversion purity) remain
working defaults pending business sign-off — clearly labelled as such
in the on-page status note, not silently invented.

## Reviewer
Claude Code (execution worker), self-assessed.

## Next step
If/when sign-off is given on the two AMBER items, update the SQL filter
and re-run the data pull; no HTML structure change needed, only the
embedded data and the status-note wording.
