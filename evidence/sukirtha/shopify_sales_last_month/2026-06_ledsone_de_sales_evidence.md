# Evidence — ledsone.de 1-Sale / No-Sales Products, June 2026

- **Purpose:** Give Sukirtha an export of all ledsone.de products with 0 or exactly 1 sale in June 2026, incl. product URL, image URL, price, stock, last order date.
- **Requirement owner:** Sukirtha · **Supporting staff:** Kuberan
- **Store:** ledsone.de (ledsone-de.myshopify.com) · **Timezone:** CEST (UTC+2) — confirmed via `get-shop-info`
- **Date range:** 2026-06-01 00:00:00 → 2026-06-30 23:59:59 CEST
- **Executed:** 2026-07-06

## Source method (read-only)
Shopify Admin API via claude.ai MCP connector:
- Bulk op `gid://shopify/BulkOperation/9491800719625` — products (active + draft): **12,556 records = 2,512 products + 10,044 variants**
- Bulk op `gid://shopify/BulkOperation/9491815006473` — orders since 2023-01-01: **38,321 records = 16,344 orders + 21,977 line items**
- ShopifyQL cross-check: `FROM sales SHOW net_items_sold, orders GROUP BY product_id SINCE 2026-06-01 UNTIL 2026-06-30` → 269 product rows with activity (net incl. returns), consistent with 260 gross-sold products (104 one-sale + 156 multi-sale).
- Aggregation script: `build_report.py` (this folder); run stats: `2026-06_run_stats.json`.
- `bulkOperationRunQuery` is a data-export job — **no store data was modified** (same method as 2026-07-01 duplicate-SKU and 2026-07-06 Kamsi req1 tasks).

## Counts
| Metric | Value |
|---|---|
| Products checked (active+draft) | 2,512 |
| Variants checked | 10,044 |
| Orders in June (non-cancelled) | 432 (434 incl. cancelled) |
| June line items | 581 |
| NO SALES rows | 2,252 |
| 1 SALE rows | 104 |
| Excluded (qty sold > 1) | 156 |
| Reconciliation | 2,252 + 104 + 156 = 2,512 ✔ |

## Matching method
Line item → product via **variant ID first** (21,331 lines), **product ID second** (494), **SKU third** (65). 44 unmatched lines across the full 2023–2026 history (deleted/archived products); **0 unmatched lines in June 2026** — June classification is fully matched. No handle/title fallback needed.

## Output
- CSV: `evidence/sukirtha/shopify_sales_last_month/2026-06_ledsone_de_1-sale_no-sales_products.csv` (2,356 data rows)
- Columns: Product ID, Title, Handle, Status, Product URL, Image URL, Variant IDs, SKUs, Price (EUR, single or min–max range), Stock Qty (sum across variants), Qty Sold 2026-06, Sales Status, Last Order Date
- Google Sheet: **not created** — Sheets API not configured for this workspace. CSV is ready for manual upload to Google Sheets.

## Known limits
- "Last Order Date" looks back to **2023-01-01**; products whose only orders predate 2023 show "NEVER (since 2023-01-01)".
- Cancelled orders excluded; refunds/returns NOT netted (classification uses gross ordered quantity, per spec "quantity sold").
- Archived products excluded (spec: active + draft only).
- Price/stock are as of 2026-07-06 (run date), not June month-end.
- User dropped the "Last 6 month Sales" column mid-task; classification window remains June 2026.

**Reviewer needed:** Sukirtha · **Status:** delivered · **Result: PASS**
