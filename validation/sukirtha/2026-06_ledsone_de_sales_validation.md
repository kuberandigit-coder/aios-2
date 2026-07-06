# Validation — ledsone.de 1-Sale / No-Sales Products, June 2026 (2026-07-06)

| # | Check | Result |
|---|---|---|
| 1 | Every output row has Product ID | PASS — 0 rows with empty Product ID (awk check on 2,356 rows) |
| 2 | Every row has SKU or "SKU MISSING" marked | PASS — script substitutes "SKU MISSING" for blank variant SKUs |
| 3 | Status only NO SALES / 1 SALE | PASS — 2,252 NO SALES + 104 1 SALE = 2,356 rows |
| 4 | No row with qty sold > 1 | PASS — 156 such products excluded before write; excluded count logged in stats |
| 5 | Count reconciles vs Shopify export | PASS — 2,252 + 104 + 156 = 2,512 = productsCount API (2,512); variants 10,044 = 12,556 bulk records − 2,512 products |
| 6 | Matching method documented | PASS — variant ID → product ID → SKU; counts in evidence; 0 unmatched June lines |
| 7 | Output file exists in approved path | PASS — `evidence/sukirtha/shopify_sales_last_month/2026-06_ledsone_de_1-sale_no-sales_products.csv` |
| 8 | Evidence + closure files exist | PASS — see evidence/, closure/ paths in closure doc |
| 9 | No Shopify data modified | PASS — only queries + bulkOperationRunQuery export jobs; no product/order/inventory mutations |

Cross-check: ShopifyQL June sales-by-product (269 net-activity rows) consistent with gross line-item aggregation (260 products with ≥1 gross unit; difference = returns/adjustment rows in analytics).

**Overall: PASS**

## Re-validation after window correction (Jan 1 – Jun 30, 2026)
Rerun on corrected window `2026-01-01..2026-06-30` (Europe/Berlin), output `2026-01_to_2026-06_ledsone_de_1-sale_no-sales_products.csv`:
- Rows: 1,688 NO SALES + 176 1 SALE = 1,864; excluded >1 sale: 648; 1,864+648 = 2,512 = catalogue ✔
- Orders in window: 4,606 non-cancelled (API ordersCount 4,609 incl. cancelled) ✔
- 0 unmatched line items in window ✔; all other checks 1–9 unchanged PASS.

**Overall (corrected deliverable): PASS**
