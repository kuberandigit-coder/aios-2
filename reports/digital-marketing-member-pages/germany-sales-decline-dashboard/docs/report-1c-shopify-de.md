# Report 1C — Shopify DE: Out-of-Stock Products

**File:** `pages/report-1c-shopify-de.html`
**Hub label:** Report 1C
**Last rebuilt:** 2026-07-23

---

## Purpose

Shows every SKU that sold via Shopify ledsone-de in 2025, currently has zero stock in the Germany warehouse, and continued receiving Google Shopping ad spend after going out of stock.

---

## Two Tabs

| Tab | What it shows |
|---|---|
| OOS Products | 51 SKUs with DE stock = 0, their 2025 sales, days OOS, estimated lost revenue |
| Google Ads Spend | 21 of those SKUs that received Google Shopping spend AFTER their last DE sale date |

---

## OOS Products Tab — Build Logic

### Step 1 — Germany marketplace
```
order_management.orders.market_place::integer = 10
```

### Step 2 — Shopify ledsone-de account only
```
order_management.orders.sub_source_id::integer = 108
```
sub_source 108 = ledsone-de (Shopify Germany store).

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

### Step 8 — Product images
```
listings.shopify_listings.main_image_url WHERE sub_source = 108 AND sku = real_sku
```

---

## Google Ads Tab — Build Logic

### Rule: Spend AFTER OOS date only
```sql
WHERE google_ads.product_performance.date > oos_skus.last_order_date
```

### Join path (Google Ads product → SKU)
Google Ads stores `product_item_id` which maps to Shopify variant item_id:
```
google_ads.product_performance.product_item_id
  → listings.shopify_listings.item_id  WHERE sub_source = 108
    → listings.shopify_listings.sku
```
Filter:
```
google_ads.product_performance.merchant_id = 5351990695
```
Merchant 5351990695 = ledsone.de Google Merchant Center account.

### Spend metric
```
SUM(google_ads.product_performance.cost) AS total_spend
```
Other metrics: `clicks`, `impressions`, `conversions`, `conversion_value`, `avg_cpc`.

### KPIs shown
| KPI | Value |
|---|---|
| Google Ads Spend (OOS SKUs) | €200.58 |
| Total Clicks | 647 |
| Conversions | 27.46 |
| Conversion Value | €567.05 |

### Columns per row
SKU · 2025 Spend (€) · Clicks · Impressions · Conversions · Conv. Value (€) · Avg CPC (€)

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Germany filter, sub_source=108, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price |
| `inventory` | `products` | SKU → inventory_id |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock level |
| `google_ads` | `product_performance` | Cost, clicks, conversions by product_item_id+date |
| `listings` | `shopify_listings` | product_item_id → SKU mapping + image URLs |

---

## Key Correctness Rules

1. `market_place = 10` — Germany only
2. `sub_source_id = 108` — ledsone-de Shopify store only
3. `status = 'Completed'` — no Refunded/Cancelled
4. INNER JOIN on Germany warehouse row — UK-fulfilled excluded
5. `licsl.stock = 0` — zero stock only
6. Google Ads join requires `merchant_id = 5351990695` to isolate ledsone.de account
7. `listings.shopify_listings.sub_source = 108` — prevents cross-store SKU mis-match
8. PPC `date > last_order_date` — post-OOS spend only

---

## Known Limitations

- Google Ads `product_item_id` must match `shopify_listings.item_id` exactly — unmatched variants are excluded
- Conversion attribution window in Google Ads may cause some conversions to appear after the product was OOS
- Shopify DE has far fewer SKUs (51) than Amazon/eBay because it is a single-country store with narrower range
