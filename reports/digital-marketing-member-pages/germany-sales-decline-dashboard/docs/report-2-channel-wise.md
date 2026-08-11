# Report 2 — Channel-Wise Stock Impact

**File:** `pages/report-3-channel-wise.html`
**Hub label:** Report 2
**Last rebuilt:** 2026-07-23

---

## Purpose

Cross-channel view of all 606 Germany DE OOS SKUs. Shows each SKU's 2025 revenue and estimated lost sales broken down by Amazon, eBay, and Shopify DE separately in a single row. Allows comparison of which channel drives most lost revenue per product.

---

## Build Logic

### OOS SKU set (same strict definition as R1A/1B/1C)

Three parallel CTEs — one per channel — each using identical filters:

```sql
-- market_place = 10 (Germany)
-- sub_source IN (channel accounts)
-- status = 'Completed'
-- YEAR = 2025
-- INNER JOIN inventory.local_inventory_current_stock_location_wise
--   WHERE warehouse_location = 'Germany' AND stock = 0
```

| Channel | sub_sources |
|---|---|
| Amazon | 6, 8 |
| eBay | 1, 4, 22, 27, 28, 222 |
| Shopify | 108 |

### FULL OUTER JOIN across channels

```sql
FROM amz a
FULL OUTER JOIN ebay e ON e.sku = a.sku
FULL OUTER JOIN shopify s ON s.sku = COALESCE(a.sku, e.sku)
```

This produces one row per unique SKU regardless of which channels it appeared in.
A SKU sold on Amazon + eBay appears once with both channel columns populated.
A SKU sold only on eBay appears once with Amazon columns = 0.

### Per-SKU fields computed

| Field | Formula |
|---|---|
| `amz_sales` | SUM(real_qty × real_price) for Amazon DE |
| `ebay_sales` | SUM(real_qty × real_price) for eBay DE |
| `shopify_sales` | SUM(real_qty × real_price) for Shopify DE |
| `total_sales` | amz + ebay + shopify |
| `amz_last_order` | MAX(order_date) for Amazon DE |
| `ebay_last_order` | MAX(order_date) for eBay DE |
| `shopify_last_order` | MAX(order_date) for Shopify DE |
| `last_order_date` | GREATEST of all three channel last order dates |
| `days_oos` | TODAY − last_order_date |
| `total_lost` | (total_sales / 365) × days_oos |
| `amz_lost` | (amz_sales / 365) × amz_days_oos |
| `ebay_lost` | (ebay_sales / 365) × ebay_days_oos |
| `shopify_lost` | (shopify_sales / 365) × shopify_days_oos |

### Price columns used
```
order_management.order_item_info.real_qty::numeric
order_management.order_item_info.real_price::numeric
```
Both are varchar — cast to numeric. Rows with non-numeric values filtered:
```sql
AND oli.real_qty ~ '^\d+(\.\d+)?$'
AND oli.real_price ~ '^\d+(\.\d+)?$'
```

### Totals (correct DE-only figures)
| Metric | Value |
|---|---|
| Total OOS SKUs | 606 |
| Amazon lost sales | €27,843 |
| eBay lost sales | €16,893 |
| Shopify lost sales | €2,575 |
| Total combined lost | €47,311 |

---

## Data Structure (JS)

Embedded as `const DATA=[...]` on line 145 of the HTML.
Each entry:
```json
{
  "sku": "EXAMPLE-SKU",
  "amz_sales": 1200.50,
  "amz_qty": 45,
  "amz_last_order": "2025-11-15",
  "amz_days_oos": 250,
  "amz_lost": 823.97,
  "ebay_sales": 340.00,
  "ebay_qty": 12,
  "ebay_last_order": "2025-10-20",
  "ebay_days_oos": 276,
  "ebay_lost": 256.88,
  "shopify_sales": 0,
  "shopify_qty": 0,
  "shopify_last_order": "",
  "shopify_days_oos": 0,
  "shopify_lost": 0,
  "total_sales": 1540.50,
  "total_qty": 57,
  "last_order_date": "2025-11-15",
  "days_oos": 250,
  "total_lost": 1055.82
}
```

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Germany filter, channel sub_sources, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price |
| `inventory` | `products` | SKU → inventory_id |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock = 0 filter |

---

## Key Correctness Rules

1. All three channel CTEs use identical `market_place = 10`, `status = 'Completed'`, INNER JOIN Germany stock rules
2. FULL OUTER JOIN ensures no SKU is dropped even if only on one channel
3. Per-channel lost sales use per-channel last_order_date (not the combined date)
4. `real_qty` and `real_price` are regex-validated before cast to numeric

---

## Known Limitations

- Lost sales estimate is a daily run-rate — no seasonality adjustment
- If a SKU sold on both Amazon and eBay, the `last_order_date` shown is the most recent across all channels
- Channel lost sales are independent estimates — total may differ slightly from summing R1A+R1B+R1C if last order dates differ per channel
