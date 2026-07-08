# Evidence — Mahima Requirement 1: Product-Level Correction

**Title:** Confirmed and clarified genuine product-level grain, added Product ID/Product Title/Product Price columns via a newly-discovered clean join, all remaining required-but-unavailable fields kept honestly "Data Missing"
**Purpose:** Prove the report genuinely shows one row per product per campaign, prove the PostgreSQL source is product-level, and document exactly what could/couldn't be added
**Requirement Source:** GPT planning layer instruction, 2026-07-08 (see `prompts/mahima/2026-07-08_mahima_req1_product_level_prompt.md`)
**Team Member:** Mahima · **Reviewer:** Kuberan
**Business Question:** Which Google Ads products for ledsone.de should Mahima Scale, Maintain, Optimize, or Pause, at genuine product-within-campaign grain?
**PostgreSQL Sources Checked:** Yes, read-only only — see full list below

## 1. Existing Mahima page checked
Read the live `reports/digital-marketing-member-pages/pages/mahima.html` before any change: 680 rows, 4 campaigns, source `staging_ai.cppc_workbook_product_performance_v1`, dated 2026-06-11, Data Missing already correctly applied to Product Cost/Feed Status/Missing Attribute/7d&30d ROAS.

## 2. Existing AIOS assets checked
`prompts/mahima/`, `evidence/mahima/`, `validation/mahima/`, `handover/mahima/`, `vercel/mahima/`, `reports/mahima/` all reviewed — prior Mahima Req1 build (2026-07-07) fully documented the interim build and its 3 blockers; this task extends that work, does not duplicate it.

## 3. PostgreSQL product-level source inspected (read-only)
```sql
select count(*) as total_rows, count(distinct campaign_id) as campaign_count,
       count(distinct google_item_id) as product_count, count(distinct internal_sku) as sku_count,
       max(as_of) as latest_date, min(as_of) as earliest_date
from staging_ai.cppc_workbook_product_performance_v1;
-- -> total_rows: 9,673 | campaign_count: 86 | product_count: 9,672 | sku_count: 1,333 | as_of: 2026-06-11 (single date)
```

## 4. Row count confirmed
**680 rows** for Mahima's 4 campaigns — unchanged from the prior build (matches exactly).

## 5. Campaign count confirmed
**4 of Mahima's 5 active ledsone.de campaigns** have product-level rows (unchanged): 20763699505, 23684789991, 23053104908, 23431543574. Campaign 23926509987 still has no product-level rows in this source.

## 6. Product count confirmed
Per-campaign distinct product counts (via `count(distinct google_item_id)`), confirming **multiple products per campaign** (not campaign-only aggregation):
```
20763699505: 72 distinct products
23053104908: 114 distinct products
23431543574: 30 distinct products
23684789991: 464 distinct products
```
680 total rows = 72+114+30+464, one row per product per campaign — genuinely product-level, not aggregated.

## 7. Whether source is product-level confirmed
**Yes, confirmed at both the whole-table level (9,672 distinct products / 9,673 rows, essentially 1:1) and specifically for Mahima's 4 campaigns** (row counts exactly equal distinct product counts per campaign, shown above). This was already true in the prior build; this task's correction request appears to have been based on a misunderstanding, or a request to make the product-level nature more explicit in the UI — both are addressed (see Step 10).

## 8. Missing columns documented
- **Product Cost, Gross Profit, Profit After Ads:** still Data Missing. Re-checked `development.sku_cogs` (empty) and `staging_ai.cppc_cogs_truth_model_v1` (cost fields NULL for all rows). New check this pass: `staging_ai.google_feed_field_discovery_v1` confirms `internal_sku` coverage in the cogs truth model is only **11.99%** site-wide — corroborates that real cost data is essentially absent, not a search failure.
- **Feed Status, Missing Attribute:** still Data Missing — `raw_data.gmc_product_diagnostics_daily` confirmed empty (0 rows) again this pass.
- **Last 7 Days ROAS / Last 30 Days ROAS:** still Data Missing — source has one `as_of` snapshot per row, no daily history to compute a rolling window from.
- **Product Title / Product Price — partially recovered this pass** (new finding, see below).

## 9. Freshness/staleness documented
Data remains dated **2026-06-11** (~4 weeks stale as of 2026-07-08). Shown prominently in the header, a KPI card ("Data Freshness Date"), and the Known Limitations section.

## New finding this pass: Product Title & Product Price (partial recovery)
Searched `staging_ai`, `cppc_intelligence`, and `public` schemas for better/newer product-level sources per instruction. Found no better source overall, but discovered a working join for Product Title/Price:

```sql
select p.google_item_id, gmp.title, gmp.price
from staging_ai.cppc_workbook_product_performance_v1 p
left join public.google_merchant_products gmp
  on p.google_item_id = gmp.product_id
where p.campaign_id in (...)
-- initial attempt: FAN-OUT BUG — one product_id maps to up to 15 rows in
-- google_merchant_products (different marketing "feed_label" segments),
-- each with a DIFFERENT PRICE for the identical product (e.g. one item
-- ranged £6.49 to £13.37 across 15 feed-segment rows).
```

**Fix:** restricted the join to `gmp.merchant_id in (4 ledsone.de IDs) AND gmp.country = 'DE'`, which gives exactly one row per product (verified: zero products have `count(*) > 1` under this filter) — the canonical DE-market listing, avoiding an arbitrary/wrong price pick.

**Result:** Product Title and Product Price now populate for **127 of 680 rows (18.7%)** — the rest correctly show "Data Missing" rather than a guessed value from one of the 15 conflicting feed-segment prices. This is a genuine, honest partial improvement, not a full fix.

## 10. mahima.html updated
- Added explicit text: **"Table grain: one row per product within each campaign."** in a highlighted banner directly above the KPI cards.
- Added **Product ID** (the raw `google_item_id`) and **Product** (title where matched, else "Data Missing") as separate columns — previously the ID/SKU were combined into one column.
- Added **Product Price** column (from the new join, "Data Missing" where unmatched).
- Kept Product Cost, Gross Profit, Profit After Ads, Feed Status, Missing Attribute, Last 7 Days ROAS, Last 30 Days ROAS as their own columns, all showing "Data Missing" (styled distinctly, not blank/invented).
- Added KPI cards: Total Product Rows, Active Campaigns Covered, Total Cost, Total Conversion Value, Overall ROAS, Products to Scale, Products to Pause, Data Freshness Date (8 cards, all required ones present).
- Extended the search filter to also match Product Title.
- Updated Suggested Action legend with the exact required note: *"Suggested Action is taken from source table and not independently recalculated unless rule inputs are available."*
- Rewrote Data Sources & Calculation Rules and Known Limitations sections to explain the new join, the fan-out bug found and worked around, and the 18.7% match rate honestly.

## 11. No fake values added
Confirmed: every "Data Missing" cell is genuinely absent from the database (checked this pass and the prior pass), not a placeholder for something that could have been estimated. Product Title/Price are real Merchant Center values, not sample data.

## 12. Validation completed
See `validation/mahima/2026-07-08_mahima_req1_product_level_validation.md`.

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html` — rebuilt
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_raw.json` — raw 680-row query result (with title/price join)
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_builder.py` — HTML builder script
- `reports/mahima/data/2026-07-08_mahima_before_product_level_update_backup.html` — safety backup

## What was explicitly NOT touched
- No PostgreSQL data modified (read-only SELECT only)
- No Google Ads rules changed
- No other staff pages touched
- **Not deployed** — consistent with the established norm for Mahima work in this AIOS (deployment requires explicit approval)

**Duplicate risk:** GREEN (extends the existing single Mahima Req1 report, no duplicate created)
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — not yet deployed
**Known Limitations:** see the 7 items now documented on the page itself (freshness, 18.7% title/price coverage with fan-out explanation, cost/feed-status/missing-attribute/7d-30d-ROAS all Data Missing, 1 of 5 campaigns uncovered, Suggested Action not independently verified)
**Next Steps:** Kuberan review + deployment approval
**PASS / FAIL:** PASS
