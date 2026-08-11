# Report 4 — Fast-Moving Products: Never OOS List

**File:** `pages/report-5-never-oos.html`
**Hub label:** Report 4
**Last rebuilt:** 2026-07-23

---

## Purpose

Shows all SKUs that currently have Germany warehouse stock > 0 AND sold on Germany DE channels in 2025. Used to identify fast-moving products at risk of becoming OOS, show current stock health, and recommend minimum stock levels.

---

## Build Logic

### Step 1 — Germany DE sales in 2025 (in-stock products)

Same channel and year filters as OOS reports, but stock condition is reversed:

```sql
JOIN inventory.local_inventory_current_stock_location_wise licsl
  ON licsl.inventory_id = ip.id
  AND licsl.warehouse_location = 'Germany'
WHERE licsl.stock > 0   -- IN STOCK (not zero like OOS reports)
AND o.market_place::integer = 10
AND o.sub_source_id::integer IN (6, 8, 1, 4, 22, 27, 28, 222, 108)
AND o.status = 'Completed'
AND EXTRACT(YEAR FROM o.order_date) = 2025
```

All 9 DE sub_sources combined (Amazon + eBay + Shopify).

### Step 2 — Sales velocity per SKU

```sql
SUM(real_qty::numeric)       AS qty_sold_2025
SUM(real_qty * real_price)   AS sales_eur_2025
SUM(real_qty) / 12.0         AS avg_monthly_qty    -- annual ÷ 12 months
```

### Step 3 — Minimum stock recommendation

```
min_stock_recommended = ROUND(avg_monthly_qty × 1.5, 0)
```

1.5× average monthly quantity = 6-week buffer stock rule.

### Step 4 — Current DE stock

```sql
inventory.local_inventory_current_stock_location_wise.stock
WHERE warehouse_location = 'Germany'
```

### Step 5 — Months of cover

```
months_cover = current_de_stock / avg_monthly_qty
```

### Step 6 — Stock health classification

```
'Below Min'    if current_de_stock < min_stock_recommended
'Well Stocked' if months_cover >= 3
'OK'           otherwise
```

### Totals
| Metric | Value |
|---|---|
| In-Stock SKUs with 2025 DE sales | 1,359 |
| Below Min Stock | 6 |

---

## Data Structure (JS)

Embedded as `var DATA=[...]` on line 144 of the HTML. Each entry:
```json
{
  "sku": "EXAMPLE-SKU",
  "product_title": "EXAMPLE-SKU",
  "product_img_url": "",
  "qty_sold_2025": 84,
  "sales_eur_2025": 1240.50,
  "avg_monthly_qty": 7.0,
  "min_stock_recommended": 11,
  "current_de_stock": 45,
  "months_cover": 6.4,
  "stock_health": "Well Stocked"
}
```

### Stock health row colours
| Health | Row colour |
|---|---|
| Below Min | Red highlight |
| Well Stocked | Green highlight |
| OK | Default |

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Germany filter, all sub_sources, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price |
| `inventory` | `products` | SKU → inventory_id |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock > 0 filter + current stock level |

---

## Key Correctness Rules

1. `market_place = 10` — Germany DE only
2. `status = 'Completed'` — no Refunded/Cancelled
3. `licsl.stock > 0` — in-stock products only (opposite of OOS reports)
4. All 9 DE sub_sources included (Amazon + eBay + Shopify combined sales)
5. Min stock = 1.5 × avg monthly qty (6-week buffer)
6. `real_qty` and `real_price` are varchar — regex-validated before numeric cast

---

## How This Differs from OOS Reports

| OOS Reports (R1A, R1B, R1C) | This Report (R4) |
|---|---|
| `licsl.stock = 0` | `licsl.stock > 0` |
| Products that HAVE gone OOS | Products currently in stock |
| Goal: quantify past lost sales | Goal: prevent future OOS events |
| Per-channel breakdown | All channels combined |

---

## Known Limitations

- Sales velocity uses 2025 full-year average ÷ 12 — does not account for seasonal peaks (e.g. Christmas Q4 may require higher buffer)
- Stock cover in months is point-in-time — does not account for in-transit supplier orders
- Products with very low avg monthly qty (< 1) may show very high months_cover but are still at risk from single bulk orders
