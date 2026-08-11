# Report 1B — eBay DE: Out-of-Stock Products

**File:** `pages/report-1b-ebay-de.html`
**Hub label:** Report 1B
**Last rebuilt:** 2026-07-23

---

## Purpose

Shows every SKU that sold on eBay Germany in 2025 across all 6 eBay DE accounts, currently has zero stock in the Germany warehouse, and is still receiving eBay Promoted Listings spend after going out of stock.

---

## Two Tabs

| Tab | What it shows |
|---|---|
| OOS Products | 278 SKUs with DE stock = 0, their 2025 sales, days OOS, estimated lost revenue |
| PPC Spend | 220 of those SKUs that continued receiving eBay Promoted Listings fees AFTER their last DE sale date |

---

## OOS Products Tab — Build Logic

### Step 1 — Germany marketplace
```
order_management.orders.market_place::integer = 10
```

### Step 2 — All eBay DE accounts
```
order_management.orders.sub_source_id::integer IN (1, 4, 22, 27, 28, 222)
```
| sub_source | Account name |
|---|---|
| 1 | led_sone |
| 4 | so_926407 (sunsone) |
| 22 | electricalsone |
| 27 | ledsonede |
| 28 | huettenlampen |
| 222 | homin_gmbh |

### Step 3 — Completed orders only
```
order_management.orders.status = 'Completed'
```

### Step 4 — 2025 only
```
EXTRACT(YEAR FROM order_management.orders.order_date) = 2025
```

### Step 5 — Strict DE OOS (INNER JOIN)
```sql
JOIN inventory.products ip ON ip.sku = oli.real_sku
JOIN inventory.local_inventory_current_stock_location_wise licsl
  ON licsl.inventory_id = ip.id
  AND licsl.warehouse_location = 'Germany'
WHERE licsl.stock = 0
```

### Step 6 — OOS proxy
```
MAX(orders.order_date)::date AS last_order_date
```

### Step 7 — Lost sales estimate
```
(annual_sales_eur / 365) × days_oos
```

### Step 8 — Per-account breakdown
Each SKU may have sold across multiple eBay accounts. `account_dates[]` in the DATA array stores per-account last order dates. KPIs use the most recent last_order_date across all accounts.

### Step 9 — Product images
```
listings.ebay_listings.main_image_url WHERE sku = real_sku
```

---

## PPC Spend Tab — Build Logic

### Rule: Spend AFTER OOS date only
```sql
WHERE ebay_campaigns.performance_data.date > oos_skus.last_order_date
```

### Join path (eBay listing → SKU)
eBay PPC does not store SKU directly — joins via listing item_id:
```
ebay_campaigns.performance_data.ebay_listing_id (bigint)
  → listings.ebay_listings.item_id (text cast)  WHERE sub_source = campaign.sub_source
    → listings.ebay_listings.sku
```
Filters:
```
ebay_campaigns.campaigns.marketplace_id = 'EBAY_DE'
ebay_campaigns.campaigns.sub_source IN (1, 4, 22, 27, 28, 222)
listings.ebay_listings.sku != 'sku not assigneds'
```

### Spend metric
eBay uses `ad_fees_listing_currency` (not a `spend` column):
```
SUM(ebay_campaigns.performance_data.ad_fees_listing_currency) AS total_spend
```
Sales: `sale_amount_listing_currency`
Units: `attributed_sales`

### KPIs shown
| KPI | Value |
|---|---|
| Ad Fees on OOS SKUs | €36,318.00 |
| Total Clicks | 177,383 |
| Attributed Sales (units) | 22,542 |
| OOS SKUs with PPC | 220 |

### Columns per row
SKU · Account · Ad Fees (€) · Clicks · Impressions · Attributed Sales · Ad Sale Amount (€)

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Germany filter, sub_source, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price |
| `order_management` | `sub_source` | Account name lookup |
| `inventory` | `products` | SKU → inventory_id |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock level |
| `ebay_campaigns` | `performance_data` | Ad fees, clicks, impressions, sales by listing+date |
| `ebay_campaigns` | `campaigns` | Campaign → sub_source + marketplace_id |
| `listings` | `ebay_listings` | listing item_id → SKU mapping + image URLs |

---

## Key Correctness Rules

1. `market_place = 10` — Germany only
2. `status = 'Completed'` — no Refunded/Cancelled
3. INNER JOIN on Germany warehouse row — UK-fulfilled excluded
4. `licsl.stock = 0` — zero stock only
5. PPC join uses `item_id = ebay_listing_id::text` (cast required — ebay_listing_id is bigint, item_id is varchar)
6. `listings.ebay_listings.sub_source = campaigns.sub_source` — prevents cross-account listing mis-match
7. PPC `date > last_order_date` — post-OOS spend only

---

## Known Limitations

- One eBay listing (item_id) can map to multiple SKUs — filtered by sub_source match and `sku != 'sku not assigneds'` to reduce ambiguity
- OOS date is a proxy (last order date)
- eBay ad fees are not the same as total PPC cost in all campaign types
