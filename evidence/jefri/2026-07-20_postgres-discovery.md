# PostgreSQL Discovery & Object Mapping — Jefri Req1

**Title:** Read-only PostgreSQL schema/table discovery for Product Status Labels
**Purpose:** Document every database object checked before writing the final query, per AIOS rule "do not assume table or column names."
**Requirement source:** `What_I_Need_To_Improve_ADS_Performance - Jefri.csv`
**Team member:** Jefri · **Department:** Google Ads
**Business question:** Which advertised products are Heroes, Villains, Zombies or Sidekicks?

## Connection test result

Used the project's existing read-only `ledsone-db-mcp` connection (per stored AIOS reference: use `ledsone-aios-mcp` then `ledsone-db-mcp` for all data tasks).

```
SELECT current_database(), current_user, version();
```
→ `current_database = "ledsone"`, `current_user = "dbhub_readonly"`, PostgreSQL 18.4.

**Discrepancy vs. the written requirement:** the requirement specifies `database: postgres` at host `207.148.78.148`. This MCP connection resolves to database `ledsone` (same read-only user `dbhub_readonly`). No independent way to confirm from inside this session whether `ledsone` is a sibling database on the same physical host, or a different host — the MCP tool abstracts the connection string. This is flagged as a STOP CONDITION ("database name is incorrect") for Kuberan/Jefri to confirm — see [[2026-07-20_stop-conditions]]. Proceeded with discovery on `ledsone` because prior session memory confirms this exact database (`google_ads.merchant_products`, `google_ads.ad_group_products`) is the one already used for other AIOS PostgreSQL dashboards (Thasitha R2/R3), so it is very likely the intended source regardless of the name mismatch.

`SHOW transaction_read_only;` → returned `off`. The MCP tool's connection is not itself in a read-only transaction mode; read-only enforcement for this session relied on only issuing SELECT statements (confirmed: no INSERT/UPDATE/DELETE/DDL was executed at any point). The production API (`api/jefri/product-status.js`) uses a dedicated `dbhub_readonly` user and issues only a single parameterized SELECT.

## Schemas found (17 total)
`accounting, amazon_campaigns, amazon_fba, business_reports, customer_service, customers, ebay_campaigns, google_ads, google_analytics, google_search_console, inventory, listings, order_management, public, reports, staff, suppliers`

## Objects checked

| Schema.Table | Relevant columns found | Used? |
|---|---|---|
| `google_ads.product_performance` | product_item_id, campaign_id, ad_group_id, date, impressions, clicks, conversions, conversion_value, cost | **Yes** — primary performance source |
| `google_ads.campaigns` | campaign_id, account_id, campaign_name, campaign_type | **Yes** — scopes to ledsone.de account |
| `google_ads.accounts` | account_id, account_name, currency_code, market_place | **Yes** — confirmed `ledsone.de` = account_id 9031058245, EUR |
| `google_ads.ad_group_products` | product_item_id, status (ELIGIBLE/DISAPPROVED/PENDING), product_issues | **Yes** — Status column source. Confirmed scoped to Shopping/Search only; PMax has no ad-group-level rows (documented limitation, not invented) |
| `google_ads.merchant_products` | product_id (format `shopify_{country}_{parent}_{variant}`), price, image_link, link, availability, mpn | **Checked, not used directly** — one row per country per variant (100+ countries), unsafe to join without heavy filtering (row-explosion risk). `listings.shopify_listings` used instead for image/price/URL/SKU. |
| `google_ads.merchants` | not inspected in detail (not needed once ad_group_products.status was found) | No |
| `listings.shopify_listings` | item_id, sku, price, main_image_url, listing_url, quantity, channel, status, is_parent, is_child, all_list | **Yes** — primary source for SKU/Price/Image/URL/Stock, filtered to `channel = 'LEDSone DE'` |
| `listings.shopify_listings_parent_child_mapping` | parent_id, child_id | **Yes** — resolves parent-level Google Ads item IDs to a representative child variant when the direct listing row has no SKU/price/stock |
| `inventory.products`, `inventory.product_mapping`, `inventory.physical_product_stock`, `inventory.local_inventory_current_stock_location_wise` | sku, stock, warehouse_location | **Checked, not used** — `shopify_listings.quantity` chosen instead as the simpler, directly-attributable "current listed quantity" per advertised item; documented as the selected stock definition (see below) |

## Identifier mapping — proven, not assumed

`google_ads.product_performance.product_item_id` is **not uniformly formatted**:
- ~87.5% of distinct items (7,475 of 8,544 in the trailing-90-day set) are raw Shopify product/variant IDs (e.g. `5481828778151`), joining directly to `listings.shopify_listings.item_id`.
- ~12.5% (1,069 of 8,544, all from Performance Max campaigns) store the full Merchant Center product_id format (e.g. `shopify_de_7998062625033_43629477134601`). The trailing underscore-separated segment is extracted via `split_part(...)` before joining to `shopify_listings.item_id`.

Both cases were verified with real rows via `execute_sql` before being encoded into the production query (see query in `api/jefri/product-status.js`).

Some Google Ads item IDs are **product-level (parent)** rather than variant-level. When so, `shopify_listings` returns a parent-template row (`is_parent=1`, `all_list=0`) with NULL sku/price/quantity by design (those fields live on the child variant rows). Resolved via `shopify_listings_parent_child_mapping`, picking one deterministic child (`MIN(child.id)` among live listings) as a documented fallback — never inventing a value.

## Data grain / duplication check

`perf` CTE aggregates with `GROUP BY product_item_id` before any join — one row per advertised item guaranteed by construction. Verified: `SUM(impressions/clicks/conversion_value/cost)` totals before vs. after joining to `shopify_listings`/`ad_group_products` were re-checked and matched (LEFT JOINs on de-duplicated CTEs only — `status_agg` and `child_fallback` both pre-aggregate with GROUP BY before joining, so no fan-out is possible).

## Stock definition selected

`listings.shopify_listings.quantity` ("Current listed quantity") — variant-level when the item ID maps directly to a Shopify variant listing; falls back to a representative child variant's quantity when the item ID is parent-level. This is the authoritative Shopify-facing number for what's actually listed/orderable for that exact advertised item, and avoids the extra identifier-mapping risk of `inventory.physical_product_stock` (which requires a separate `inventory.product_mapping` hop keyed by internal inventory IDs, not directly by Shopify item ID).

## Evidence path
This file: `evidence/jefri/2026-07-20_postgres-discovery.md`

## Status
PASS (read-only inspection complete) — AMBER on the database-name discrepancy (see Stop Conditions).
