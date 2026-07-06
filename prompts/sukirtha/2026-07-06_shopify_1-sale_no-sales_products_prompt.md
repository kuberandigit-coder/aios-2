# Prompt — Sukirtha: ledsone.de 1-Sale / No-Sales Products (June 2026)

**Date:** 2026-07-06 · **Owner:** Sukirtha · **Support:** Kuberan

## Request (final, after user revisions)
Report of ledsone.de products with **exactly 1 sale** or **no sales** in **June 2026** (store timezone CEST), with columns: Product ID, Product URL, Image URL, Price (EUR), Stock Qty, Last Order Date — plus title, handle, variant IDs, SKUs, qty sold, sales status. The "Last 6 month Sales" column was requested mid-task and then **dropped by the user** ("no need 6 month sales, that is 0 and 1 order").

## Reusable method
1. Connect Shopify MCP to ledsone.de (`get-shop-info` to confirm store + timezone).
2. Bulk export products: `bulkOperationRunQuery` on `products(query:"status:active OR status:draft")` with id, title, handle, status, onlineStoreUrl, featuredImage.url, variants (id, sku, price, inventoryQuantity).
3. Bulk export orders since 2023-01-01 with createdAt, cancelledAt, lineItems (quantity, sku, variant.id, product.id).
4. Poll `currentBulkOperation`, download both JSONL files with curl.
5. Run `build_report.py` (aggregates June gross quantity per product, matches variant→product→SKU, classifies NO SALES / 1 SALE, excludes qty>1, adds all-time-since-2023 last order date).

Script archived at: `evidence/sukirtha/shopify_sales_last_month/build_report.py`
