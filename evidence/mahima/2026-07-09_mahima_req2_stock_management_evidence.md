---
task: Mahima Requirement 2 — Stock Management, Tab 2 on mahima.html
date: 2026-07-09
team_member: Mahima
status: DONE (local device only, not pushed)
---

## Title
Mahima Requirement 2 — Stock Management (Tab 2) — Evidence

## Purpose
Prove the Stock Management table is built entirely from live Shopify ledsone.de data (no
fabrication), document every source, join, formula, and the exact row counts.

## Requirement source
Kuberan, 2026-07-09 (see `prompts/mahima/2026-07-09_mahima_req2_stock_management_prompt.md`)

## Team member
Mahima

## Business question
Which Shopify products need restocking, monitoring, no restock yet, or stop purchasing based on
current stock and last 30-day sales?

## 1. Existing asset search (before building)
Searched for "mahima stock management", "requirement 2", "stock management", "restock", "days
remaining", "avg daily sales" across `prompts/`, `evidence/`, `validation/`, `handover/`,
`reports/`, `vercel/` (kuberan web repo) and
`C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages`. No prior Mahima Requirement 2 /
Stock Management asset existed — clear to build. Found and reused a **relevant precedent**:
Kamsi's Requirement 1 (`kamsi-req1-slow-moving-products.html`) used a proven Shopify **bulk
operation** export method (`bulkOperationRunQuery`) for full-catalog SKU/stock/category data —
documented in `evidence/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_evidence.md`. This
report adopted the same method rather than manual pagination.

## 2. Shopify sources inspected
- `mcp__claude_ai_Shopify__get-shop-info` — confirmed connected shop = **ledsone.de**
  (domain `ledsone.de`, currency EUR, timezone CEST, country Germany).
- `query { productsCount { count } }` — **2,524 products** confirmed live.
- ShopifyQL Analytics API (`run-analytics-query`) — inventory report:
  `FROM inventory SHOW starting_inventory_units, ending_inventory_units, inventory_units_sold, sell_through_rate GROUP BY product_title, product_variant_title SINCE -30d UNTIL today LIMIT 20000`
  → **10,233 rows** (unique product_title × product_variant_title keys, no duplicates).
- Shopify Admin GraphQL **bulk operation** (`bulkOperationRunQuery`) — full catalog export:
  `{ products { edges { node { id title productType variants { edges { node { id sku title inventoryQuantity } } } } } } }`
  → bulk operation id `gid://shopify/BulkOperation/9514590175497`, status COMPLETED,
  **12,657 objects** (2,524 Product records + 10,133 ProductVariant records), completed
  2026-07-09T08:53:16Z. Downloaded via the operation's signed URL to
  `ledsone_catalog_bulk.jsonl` (session scratchpad).

## 3. Fields confirmed
| Required field | Shopify source | Confirmed present |
|---|---|---|
| SKU | `ProductVariant.sku` (bulk export) | Yes, for 10,120 of 10,133 variants (13 blank — genuine gap in Shopify catalog, not invented) |
| Product Title | `Product.title` (bulk export) | Yes, all rows |
| Product Category | `Product.productType` (bulk export) | Yes for 9,926 of 10,133 rows (207 blank — see limitations) |
| Current Stock | `ending_inventory_units` (ShopifyQL inventory report, today's ending balance) | Yes for 10,123 rows; fallback to `ProductVariant.inventoryQuantity` (bulk export) for the 10 unmatched rows |
| Last 30-Day Sales | `inventory_units_sold` (ShopifyQL inventory report, SINCE -30d UNTIL today) | Yes for 10,123 rows; genuinely unavailable (Data Missing, not guessed) for 10 rows |

## 4. Current stock source
ShopifyQL `ending_inventory_units` from the `inventory` table, `SINCE -30d UNTIL today` —
this is Shopify's own ending inventory balance as of query time (2026-07-09), i.e. today's
live stock. For the 10 variants with no matching inventory-report row, fell back to the bulk
catalog export's `inventoryQuantity` field (also live Shopify data, just from a different
endpoint) — flagged with `sales_source:"missing"` internally.

## 5. Last 30-day sales source
ShopifyQL `inventory_units_sold` from the same `inventory` table query
(`SINCE -30d UNTIL today`). Cross-checked against an independent ShopifyQL sales query
(`FROM sales SHOW quantity_ordered GROUP BY product_title, product_variant_title SINCE -30d UNTIL today`)
for SKU `LDMST64E278-IDE` ("Vintage E27 8W Dimmbare LED Dekorative Glühbirnen ~1025") — both
queries independently returned **37 units** for that product, confirming the figure is real
and internally consistent, not fabricated.

## 6. Join
Joined the bulk catalog export (grain: product × variant) to the ShopifyQL inventory report
(grain: product_title × product_variant_title) on an **exact (product_title, variant_title)**
match. Script: `reports/mahima/data/2026-07-09_mahima_req2_build_stock_report.py`.

- Catalog: 2,524 products, 10,133 variants.
- Inventory report: 10,233 unique (title, variant_title) keys, 0 duplicate keys.
- **Matched: 10,123 of 10,133 variants (99.9%)** — got real stock + real 30-day sales.
- **Unmatched: 10 of 10,133 (0.1%)** — kept the row with live catalog stock, sales shown as
  Data Missing (not guessed).

## 7. Calculation formulas (exact, as specified — no changes made)
- `Avg Daily Sales = Last 30-Day Sales / 30`, rounded to 2 decimals.
- `Days Remaining = Current Stock / Avg Daily Sales`, rounded to nearest whole number;
  `"N/A"` when Avg Daily Sales = 0.
- Script: `reports/mahima/data/2026-07-09_mahima_req2_compute_rules.py`.

## 8. Status and Action rules (exact, as specified — no changes made)
```
IF Avg Daily Sales = 0: Status = "Never Moving"
ELSE IF Days Remaining <= 7: Status = "Fast Moving"
ELSE IF Days Remaining <= 60: Status = "Healthy"
ELSE IF Days Remaining > 60: Status = "Slow Moving"

Fast Moving -> Restock
Healthy -> Monitor
Slow Moving -> Don't Restock Yet
Never Moving -> Stop Purchasing
```
Rows with no 30-day sales data (10 rows) show Status = "Data Missing" / Action = "Data
Missing" rather than being forced into one of the four buckets without a real basis.

## 9. Row count
**10,133 total rows** (Shopify variant/SKU grain), matching the live catalog exactly
(2,524 products × their real variant counts, 10,133 total variants per `productsCount` +
bulk export cross-check).

Status breakdown: Fast Moving 48, Healthy 11, Slow Moving 336, Never Moving 9,728,
Data Missing 10. (Sums to 10,133.)
Action breakdown: Restock 48, Monitor 11, Don't Restock Yet 336, Stop Purchasing 9,728,
Data Missing 10.
Category Data Missing: 207 rows (2.0%).
Full machine-readable summary: `reports/mahima/data/2026-07-09_mahima_req2_stock_summary.json`.

## 10. mahima.html before/after
- **Before:** single-tab page, Requirement 1 (Product Performance Report) only.
- **After:** two-tab page — `id="tabPanel1"` (unchanged Requirement 1 content) and
  `id="tabPanel2"` (new Requirement 2 — Stock Management: KPI cards, search/status/action/
  category filters, paginated 10,133-row table, data source note, calculation rules note,
  known limitations note). Tab switching via `showTab(1|2)`, both panels share the page's
  existing CSS (`.card`, `.badge`, `.tablewrap`, etc.) plus new badge classes
  (`.b-fast`, `.b-healthy`, `.b-slow`, `.b-never`, `.b-act-*`) and a `.tabbar` class.
- Backup of the pre-Tab-2 file kept at session scratchpad
  `mahima_backup_before_tab2.html` (not committed — local device change only, per Kuberan's
  instruction).
- File edited: `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`
  (local device only — **not pushed to git**, per explicit Kuberan instruction mid-task).

## 11. Validation checklist
See `validation/mahima/2026-07-09_mahima_req2_stock_management_validation.md`.

## 12. Screenshot mapping
Not applicable — no screenshot values were used anywhere in this build (explicitly forbidden
by the task); every number traces to a live Shopify API call documented above.

## Owner / Reviewer
Owner: Mahima (requirement owner) · Executed by: Claude Code · Reviewer: Kuberan

## Status
Done — local device only, deploy/push pending Kuberan's approval.

## Known limitations
1. Product Category is Data Missing for 207 of 10,133 rows (2.0%) — blank Shopify
   `productType`, no reliable collection-based fallback existed, not guessed.
2. Last 30-Day Sales / Status / Action are Data Missing for 10 rows (0.1%) — variant exists
   in the live catalog but has no matching row in the 30-day inventory report.
3. SKU is blank for 13 of 10,133 variants (0.1%) — genuine gap in the Shopify catalog itself.
4. Grain is Shopify variant (one row per SKU), not parent product — by design, matches how
   Shopify tracks stock and how "SKU" is defined in the requirement.
5. Point-in-time snapshot (2026-07-09), not live/auto-refreshing.

## Next steps
Kuberan review of Tab 2 → approval to push/deploy (currently local-device-only per his
instruction).

## PASS / FAIL result
**PASS.** Tab 2 added; all data from live Shopify ledsone.de API calls (bulk catalog export +
ShopifyQL inventory report), no PostgreSQL, no screenshots, no fabricated data; Status and
Action follow the exact rules with no changes; AIOS evidence files updated; no duplicate
report created.
