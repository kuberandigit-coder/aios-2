# Report 3 — Slow Restock / Lost Revenue

**File:** `pages/report-4-slow-restock.html`
**Hub label:** Report 3
**Last rebuilt:** 2026-07-23

---

## Purpose

Same 606 Germany DE OOS SKUs from Report 2, enriched with supplier purchase order status. Shows which products have no restock order placed, which are in production, which have arrived — and estimates the monthly revenue at risk for each.

---

## Build Logic

### Step 1 — OOS SKU set (same as R2)

Three-channel FULL OUTER JOIN using identical filters to Report 2:
- `market_place = 10`
- `status = 'Completed'`
- `YEAR = 2025`
- INNER JOIN Germany warehouse stock = 0
- sub_sources: Amazon (6,8), eBay (1,4,22,27,28,222), Shopify (108)

Combined monthly sales per SKU:
```
(amz_sales + ebay_sales + shopify_sales) / 12
```

### Step 2 — Supplier restock status

Joined from `suppliers` schema using latest supplier order per SKU:

```sql
SELECT DISTINCT ON (soi.sku)
  soi.sku,
  CASE
    WHEN so.status_arrived            THEN 'Arrived'
    WHEN so.status_shipped            THEN 'Shipped'
    WHEN so.status_finished_production THEN 'In Production'
    WHEN so.status_confirmed          THEN 'Order Placed'
    ELSE                                   'No Order'
  END AS status,
  so.expected_completion_date AS eta
FROM suppliers.orders so
JOIN suppliers.order_items soi ON soi.order_id = so.id
WHERE soi.sku IS NOT NULL AND soi.sku != ''
ORDER BY soi.sku, so.order_date DESC NULLS LAST
```

`DISTINCT ON (sku)` + `ORDER BY order_date DESC` picks the most recent supplier order per SKU.

### Step 3 — Opportunity classification

```
opp = 'High'   if monthly_sales >= 100 AND status = 'No Order'
opp = 'Medium' if monthly_sales >= 50  AND status = 'No Order'
opp = 'Normal' otherwise
```

### Step 4 — Lost opportunity estimate

```
lost = (monthly_sales / 30) × days_oos
```

Where `days_oos = TODAY − last_order_date`.

### Totals
| Metric | Value |
|---|---|
| Total OOS SKUs | 606 |
| No Restock Order | 556 |
| High Opportunity | 0 (threshold: monthly ≥ €100, no order) |
| Monthly at Risk (No Order) | €3,710 |

---

## Data Structure (JS)

Embedded as `const ROWS=[...]` on line 178 of the HTML. Each entry:
```json
{
  "sku": "EXAMPLE-SKU",
  "first_oos": "2025-11-15",
  "days": 250,
  "monthly": 95.40,
  "lost": 795.00,
  "status": "No Order",
  "eta": "",
  "opp": "Normal"
}
```

### Status values and row colours
| Status | Row colour |
|---|---|
| No Order (High opp) | Red highlight |
| No Order | Default |
| Order Placed | Default |
| In Production | Default |
| Shipped | Default |
| Arrived | Green highlight |

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Germany filter, channel sub_sources, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price |
| `inventory` | `products` | SKU → inventory_id |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock = 0 |
| `suppliers` | `orders` | Supplier PO status flags, expected completion date |
| `suppliers` | `order_items` | SKU on each supplier order line |

---

## Status Flag Columns in `suppliers.orders`

| Column | Type | Meaning |
|---|---|---|
| `status_confirmed` | boolean | Supplier has confirmed the order |
| `status_finished_production` | boolean | Production complete, awaiting shipment |
| `status_shipped` | boolean | Container shipped from supplier |
| `status_arrived` | boolean | Goods arrived at warehouse |
| `expected_completion_date` | date | Estimated production completion / ETA |

---

## Key Correctness Rules

1. OOS SKU set uses same strict filters as all R1 reports
2. `DISTINCT ON (sku)` picks only the latest supplier order — no duplicates
3. Status priority: Arrived > Shipped > In Production > Order Placed > No Order
4. Monthly sales = combined 3-channel annual revenue ÷ 12
5. Opportunity flag only applies to 'No Order' SKUs — ordered SKUs are already actioned

---

## Known Limitations

- Supplier order join is by SKU string match — if supplier order items use different SKU formats, they will show as 'No Order'
- `expected_completion_date` is the production completion date, not the arrival date
- High Opportunity count may be 0 if all high-revenue SKUs have supplier orders in progress
