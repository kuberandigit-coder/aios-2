# Evidence — Kamsi Requirement 1: Slow-Moving Product Visibility

**Title:** Kamsi Req 1 evidence · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan
**Purpose:** Record what was checked, collected and built.
**Requirement Source:** Kamsi via Kuberan session prompt 2026-07-03.
**Business Question:** Which products have low sales but high current stock and need SEO/product visibility attention?
**Status:** Delivered locally — deploy pending Kuberan approval.

## Step 1 — Existing asset discovery
- No Kamsi folders existed in prompts/evidence/validation/reports/handover/vercel (all created fresh).
- `pages/kamsi.html` existed as a "Pending" placeholder → extended to link the new report.
- Grep for "slow-moving/slow_moving" across AIOS: only hits are a Shopify *collection named* "Slow Moving" inside Dilaksi Req 3 data — not a report. **Duplicate risk: none.**
- Reused asset found: `reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv` (Shopify-connector catalog: SKU, product/variant IDs, collection, status) + handle maps p1–p4 (1,182 products, 100% handle coverage).
- **Decision: Create New** (report) + **Reuse** (Shopify catalog asset) + **Extend** (kamsi.html placeholder).

## Step 2 — PostgreSQL read-only discovery
Schemas checked: analytics, public, development, staging_ai, ph_action_board (via information_schema column scan for sku/stock/inventory/quantity/handle).
Key objects inspected (get_object_details):
- `analytics.slow_stock_snapshot` — sku, sold_last_90_days, current_stock, status, snapshot_date (latest snapshot 2026-06-15, 4,358 rows) — prior art at SKU level, but stale and without page URLs/categories; not reused for live numbers.
- `public.order_transaction` — sku, quantity, order_date, order_status, source_name (SHOPIFY/EBAY/AMAZON/…), fresh through 2026-07-03, indexed on sku+date. **Used** for Units Sold (90d) + Last Order Date (source SHOPIFY, cancelled excluded).
- `public.inv_final_stock` — sku, stock, warehouse (297,499 rows / 42,505 SKUs). **Used** for Current Stock (summed across warehouses).
- `public.listing_data` — sku, shopify_handle (sparse: 2,152), product_type. Checked for seasonal indicators — none (only false positive "Lamp Shade Spring Clip").
Missing fields in PG: page URLs (sparse), product tags. **PG verdict: supports sales + stock fully; catalog/URLs came from the Shopify-sourced asset.**

## Step 3 — Shopify data collection (read-only)
- Catalog: reused 2026-07-02 Shopify-connector export (5 core collections: wall-light, pendant-lights, plugin-lighting, spider-light, table-lamps) → 4,793 active SKUs after dedupe; DRAFT rows excluded (783 variant rows).
- Seasonal check via live connector: `shop.productTags` + tag search — tags like "xmas"/"Christmas Biggest Sale"/"New Year" are promo campaign tags applied to non-seasonal items (e.g. ceiling hooks) → **not reliable → Seasonal Tag = "Not Available"** for all rows. Nothing invented.
- Live spot verification (productVariants query, 2026-07-03):
  - WSSS70CO — Shopify sellable 613 vs warehouse total 656; ACTIVE; handle matches catalog.
  - 12ASIP20100 — Shopify sellable 121 vs warehouse total 154; ACTIVE.
  - Interpretation: warehouse total ≥ Shopify channel-allocated stock, as expected. Warehouse total used as Current Stock (documented on page).

## Calculation results
- Products checked: **4,793** · Slow-Moving: **1,388** · Active: **3,405** · Stock sitting in slow-movers: **418,658 units** · SKUs with unknown stock: 313 (shown "—", never classified Slow-Moving).
- Rule applied verbatim: Units Sold (90d) < 10 AND Current Stock > 100 → Slow-Moving.

## Files Created
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` (+ archive copy `reports/Kamsi/kamsi-requirement-1-slow-moving-products.html`)
- `reports/Kamsi/data/`: orders-90d CSV, stock-by-SKU CSV, handle map CSV, parse script, page builder
- AIOS: prompt / evidence / validation / handover / vercel files (Kamsi folders)
- `pages/kamsi.html` updated from Pending placeholder to link R1.

**Evidence Location:** this file + data CSVs.
**Validation:** `validation/Kamsi/2026-07-03_kamsi_req1_slow_moving_validation.md`
**Known Limitations:** (1) catalog scope = 5 core collections (1,182 products), not the full store; (2) Current Stock = warehouse total, slightly above Shopify sellable; (3) Seasonal Tag not available; (4) Units Sold counts Shopify channel only, per requirement.
**Next Steps:** deploy on Kuberan approval; optional full-store catalog expansion; optional all-channel sales variant if Kamsi wants it.
**External Sources Checked:** Shopify MCP connector (catalog reuse, tags, live variant verification).
**PostgreSQL Sources Checked:** as listed in Step 2.
**PASS/FAIL:** PASS
