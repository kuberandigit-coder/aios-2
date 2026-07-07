# Evidence — Mahima Requirement 1: Product Performance Report — STOPPED (Data Investigation)

**Title:** PostgreSQL read-only investigation for Mahima Req 1 (Google Ads Product Performance Report) — stopped before HTML build
**Purpose:** Document existing-asset search, PostgreSQL source discovery, and the reasons this task was stopped rather than completed
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Team Member:** Mahima (Google Ads) · **Reviewer:** Kuberan
**Business Question:** Which Google Ads products for ledsone.de should Mahima Scale, Maintain, Optimize, or Pause based on product performance, profitability, feed status, and ROAS?
**PostgreSQL Sources Checked:** Yes (read-only only — `execute_sql`/`get_object_details`/`list_objects`, no mutation calls made)

## 1. Existing asset search result
Searched `prompts/`, `evidence/`, `validation/`, `handover/`, `reports/`, `vercel/` for "mahima", "product performance report", "Google Ads product report", "ledsone.de product ROAS", "feed status", "profitability", "scale pause optimize maintain". Found:
- `evidence/old records/2026-06-23_*_MAHIMA_*` — three old files about Shopify all-products sales report and total sales calculation. **Different domain** (Shopify sales, not Google Ads product performance/ROAS/feed status) — not a duplicate.
- `reports/digital-marketing-member-pages/pages/mahima.html` — currently a **pending placeholder stub** (no report built).
- Target path `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html` does **not exist on this machine** — noted as a limitation; the equivalent file is managed via `reports/digital-marketing-member-pages/pages/mahima.html` (local/Vercel copy) and the `Staff-requirements` GitHub repo (synced via git in this project's established workflow).

**Duplicate risk: GREEN** — no existing report solves this specific requirement.

## 2. PostgreSQL schemas/tables/views inspected (read-only)
`list_schemas` → 20 user schemas found. Investigated: `cppc_intelligence`, `cppc_staff_ui` (governance/capability registries, not ads data — ruled out), `business_intelligence` (classifier/audit views, ruled out), `raw_data`, `analytics`, `growth_protection_engine`, `supplier`, `development`, `staging_ai`, `public`, `wayfair_catalog` (unrelated marketplace — ruled out).

Candidate tables identified via `information_schema.tables` search (`%ads%`, `%campaign%`, `%roas%`, `%gmc%`, `%product%`, `%cost%`, `%cogs%`, `%margin%`, `%merchant%`, `%campaign_name%`):

| Table | Columns confirmed | Verdict |
|---|---|---|
| `public.google_product_performance` | id, date, campaign_id, product_item_id, parent_id, variation_id, merchant_id, impressions, clicks, conversions, conversion_value, cost, ctr, avg_cpc | **Correct source for Ads metrics** — but see blocker #1 below |
| `public.google_merchant_products` | product_id, merchant_id, title, price, sale_price, availability, feed_label, product_types, mpn, item_group_id, custom_label0-4 | Correct source for product title/price/stock (`availability`); **no feed-eligibility/approval-status field** |
| `raw_data.gmc_product_diagnostics_daily` | merchant_id, date, sku, item_id, product_title, destination_status, approval_status, issue_severity, issue_code, issue_description | Correct schema for Feed Status/Missing Attribute — **but table is empty (0 rows)** |
| `public.google_merchants` | merchant_id, customer_id, customer_name, is_active | Confirms ledsone.de merchant IDs: `274357352`, `5351990695`, `5349761386`, `5348836557` (all `is_active=1`) |
| `development.sku_cogs` | sku, channel, marketplace, cogs_gbp, cogs_pct | Correct schema for product cost — **table is empty (0 rows)** |
| `staging_ai.cppc_cogs_truth_model_v1` | sku, title, spend_30d, cogs_gbp_verified, cogs_pct_verified, margin_blos_gross | Covers ledsone.de products (German titles confirmed in sample) — **but `cogs_gbp_verified`/`cogs_pct_verified` are NULL for 100/100 sampled rows; confirmed 0 rows anywhere in the table have a non-null verified COGS value** |
| `growth_protection_engine.paid_campaign_registry` | pc_id, channel_key, channel_name, parent_section | Not a campaign-ID-to-name lookup; **no campaign-name mapping table found anywhere in the database** |

## 3. Query snippets used (read-only only)
```sql
-- Confirm ledsone.de merchant IDs
select * from public.google_merchants order by id limit 20;

-- Join path confirmed (merchant_id on the performance table itself is unusable — see blocker)
select count(*) as matched_rows, count(distinct gpp.product_item_id) as distinct_products
from public.google_product_performance gpp
join public.google_merchant_products gmp
  on gpp.product_item_id = gmp.product_id
where gmp.merchant_id in (274357352,5351990695,5349761386,5348836557);
-- -> 2,222,782 rows / 3,037 distinct products

-- Data freshness check
select date_trunc('month', date) as month, count(*) from public.google_product_performance group by 1 order by 1 desc limit 6;
-- -> most recent month with data: April 2025

-- Product cost checks
select distinct channel, marketplace, count(*) from development.sku_cogs group by 1,2;  -- -> 0 rows (empty table)
select count(*) from staging_ai.cppc_cogs_truth_model_v1 where cogs_gbp_verified is not null or cogs_pct_verified is not null;  -- -> 0

-- Feed diagnostics check
select max(date), min(date), count(*) from raw_data.gmc_product_diagnostics_daily;  -- -> 0 rows (empty table)

-- Stock status confirmed available
select availability, count(*) from public.google_merchant_products
where merchant_id in (274357352,5351990695,5349761386,5348836557) group by 1;
-- -> out of stock: 48,167 · in stock: 37,092 · null: 213
```
No `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER` statements were executed. All queries above are `SELECT` only.

## 4. Data sample counts
- `google_product_performance` total rows: 4,088,614 (entire table, all merchants/dates)
- `google_product_performance` rows joined to ledsone.de products: 2,222,782 rows / 3,037 distinct products
- `google_merchant_products` for ledsone.de merchant IDs: 16,322 distinct products (85,472 raw rows incl. duplicates/snapshots)
- `raw_data.gmc_product_diagnostics_daily`: 0 rows (entire table empty)
- `development.sku_cogs`: 0 rows (entire table empty)
- `staging_ai.cppc_cogs_truth_model_v1`: 100 rows total, 0 with a non-null verified COGS value

## 5. Calculation formulas (as specified — not yet applied, blocked by data gaps below)
- CTR = Clicks ÷ Impressions
- Avg CPC = Cost ÷ Clicks
- Conversion Rate = Conversions ÷ Clicks
- ROAS = Conversion Value ÷ Cost
- Gross Profit = (Product Price − Product Cost) × Conversions
- Profit After Ads = Gross Profit − Cost

## 6. Duplicate risk result
**GREEN** — confirmed no existing report/page/AIOS file solves this requirement.

## 7. Before/after mahima.html
**Not changed.** `mahima.html` remains the existing pending placeholder — building it now would require inventing data for 3 of the 4 required data categories (see blockers below), which the task explicitly forbids.

## 8. STOP CONDITIONS TRIGGERED

### Blocker 1 — Google Ads performance data is stale, not "Last 30 Days"
`public.google_product_performance.merchant_id` is **NULL for all 4,088,614 rows** in the table — the only usable join path to identify ledsone.de products is via `product_item_id = google_merchant_products.product_id`. More critically: **the entire table's most recent data is dated 2025-04-28** — 14+ months stale relative to today (2026-07-07). A literal "Last 30 Days" window (as the requirement specifies) returns **zero rows**. This table appears to have stopped being refreshed over a year ago.

### Blocker 2 — Product Cost is unavailable (explicit stop condition)
- `development.sku_cogs`: table exists with the right schema, but is **completely empty**.
- `staging_ai.cppc_cogs_truth_model_v1`: does cover ledsone.de products by title, but the verified COGS columns (`cogs_gbp_verified`, `cogs_pct_verified`) are **NULL in every single row** (confirmed via `count(*) where ... is not null` = 0).
- No other product-cost source was found anywhere in the 20 schemas searched.
- Per the task's explicit stop condition ("Product cost is unavailable") and the instruction never to invent it, this blocks Product Cost, Gross Profit, and Profit After Ads entirely — not for a few rows, but for **100% of rows**, with no fallback source.

### Blocker 3 — Feed Status / Missing Attribute data is unavailable
`raw_data.gmc_product_diagnostics_daily` (the correct schema for GMC approval/destination status and issue codes — exactly what "Feed Status" and "Missing Attribute" require) is **completely empty (0 rows)**. `google_merchant_products.availability` only provides stock status (in stock/out of stock), not feed eligibility. No feed-diagnostics data exists anywhere in the database.

### Blocker 4 (minor, compounding) — No campaign-name lookup
Only a numeric `campaign_id` exists in `google_product_performance`; no table anywhere maps campaign IDs to human-readable campaign names. The "Campaign" column, if built today, could only show raw numeric IDs.

## Why this matters
Building the dashboard today would mean: (a) either showing an empty/misleading "Last 30 Days" report because the underlying data is 14+ months old, or silently redefining the date window without approval; (b) marking Product Cost/Gross Profit/Profit After Ads as "Data Missing" for literally every one of ~3,037 products, making 3 of the 6 required KPI cards and 3 of the 23 required columns permanently blank; (c) marking Feed Status/Missing Attribute as "Data Missing" for every row too. This isn't a partial-data edge case the task anticipated — it's the near-total absence of 2 of 4 required data categories, plus stale data in a 3rd. Per the task's own stop conditions, this needs Kuberan's decision before proceeding, not a silent workaround.

**Evidence path:** this file · **Validation:** `validation/mahima/2026-07-07_mahima_req1_product_performance_validation.md`
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** STOPPED — awaiting decision on how to proceed
**Known Limitations:** see blockers above
**Next Steps:** see validation/handover files
**PASS / FAIL:** N/A — stopped per explicit stop conditions, not a completed deliverable
