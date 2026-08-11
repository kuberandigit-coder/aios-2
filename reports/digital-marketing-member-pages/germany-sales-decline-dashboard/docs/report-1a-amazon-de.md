# Report 1A — Amazon DE: Out-of-Stock Products

**File:** `pages/report-1a-amazon-de.html`
**Hub label:** Report 1A
**Last rebuilt:** 2026-07-23

---

## Purpose

Shows every SKU that sold on Amazon Germany in 2025, currently has zero stock in the Germany warehouse, and is still receiving Amazon PPC spend after going out of stock. Used to quantify lost revenue and wasted ad spend at SKU level.

---

## Two Tabs

| Tab | What it shows |
|---|---|
| OOS Products | 309 SKUs with DE stock = 0, their 2025 sales, days OOS, estimated lost revenue |
| PPC Spend | 204 of those SKUs that continued receiving Amazon PPC spend AFTER their last DE sale date |

---

## OOS Products Tab — Build Logic

### Step 1 — Identify Germany marketplace
```
order_management.orders.market_place::integer = 10
```
Marketplace 10 = Germany (name: Germany, abbreviation: DE, Amazon marketplace ID: A1PA6795UKMFR9).

### Step 2 — Filter to Amazon DE accounts only
```
order_management.orders.sub_source_id::integer IN (6, 8)
```
- sub_source 8 = Amazon Ledsone
- sub_source 6 = Amazon Dcvoltage

### Step 3 — Completed orders only
```
order_management.orders.status = 'Completed'
```
Excludes Refunded and Cancelled. Refunded orders were previously included incorrectly and inflated unit counts.

### Step 4 — 2025 sales year only
```
EXTRACT(YEAR FROM order_management.orders.order_date) = 2025
```

### Step 5 — Strict DE OOS definition (INNER JOIN)
```sql
JOIN inventory.products ip ON ip.sku = oli.real_sku
JOIN inventory.local_inventory_current_stock_location_wise licsl
  ON licsl.inventory_id = ip.id
  AND licsl.warehouse_location = 'Germany'
WHERE licsl.stock = 0
```
**INNER JOIN** — only products that have a Germany warehouse row AND that row shows stock = 0.
Products with NO Germany row (UK-fulfilled stock) are excluded entirely.
This gives 606 strict DE OOS SKUs across all channels; 309 of those sold via Amazon DE.

### Step 6 — OOS proxy (last order date)
```
MAX(order_management.orders.order_date)::date AS last_order_date
```
The last date a Completed DE order was placed = proxy for when the product went OOS.

### Step 7 — Lost sales estimate
```
(annual_sales_eur / 365) × days_oos
```
Where `days_oos = TODAY - last_order_date`.
This is a daily run-rate estimate, not a guaranteed figure.

### Step 8 — Per-account breakdown
Each SKU may appear in both Amazon Ledsone (sub 8) and Amazon Dcvoltage (sub 6). The DATA array stores per-account breakdowns in `account_dates[]`. KPIs aggregate across both accounts per SKU.

### Step 9 — Product images
Images sourced from:
```
listings.amazon_listings.main_image_url WHERE sku = real_sku
```
Real CDN URLs from the DB, not pattern-guessed paths.

---

## PPC Spend Tab — Build Logic

### Rule: Spend AFTER OOS date only
PPC spend is only included for dates **after** the SKU's last DE order date:
```sql
WHERE amazon_campaigns.performance_data.date > oos_skus.last_order_date
```
This isolates truly wasted spend — budget spent when there was no DE stock to fulfil orders.

### Join path
```
amazon_campaigns.performance_data.campaign_id
  → amazon_campaigns.campaigns.campaign_id
    WHERE campaigns.sub_source IN (6, 8)
    AND campaigns.market_place = 10
  → order_management.sub_source.id  (for account name)
```
SKU matched via `amazon_campaigns.performance_data.listing_sku = oos_sku.sku`.

### KPIs shown
| KPI | Value |
|---|---|
| PPC Spend on OOS SKUs | €2,362.65 |
| Total Clicks | 14,507 |
| Ad Sales Generated | €10,527.29 |
| OOS SKUs with PPC | 204 |

### Columns per row
SKU · Account · PPC Spend (€) · Clicks · Impressions · Ad Sales (€) · Ad Orders · Avg ACOS · Avg ROAS

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `order_management` | `orders` | Filter by market_place=10, sub_source, status, year |
| `order_management` | `order_item_info` | real_sku, real_qty, real_price per order line |
| `order_management` | `sub_source` | Account name lookup |
| `inventory` | `products` | SKU → inventory_id mapping |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany warehouse stock level |
| `amazon_campaigns` | `performance_data` | PPC spend, clicks, impressions, sales by SKU+date |
| `amazon_campaigns` | `campaigns` | Campaign → sub_source + market_place mapping |
| `listings` | `amazon_listings` | Product image URLs |

---

## Key Correctness Rules

1. `market_place = 10` — Germany DE only, never global
2. `status = 'Completed'` — never Refunded or Cancelled
3. INNER JOIN on Germany warehouse row — excludes UK-fulfilled products
4. `licsl.stock = 0` — stock must be exactly zero, not just null
5. PPC spend filtered to `date > last_order_date` — post-OOS period only
6. Two Amazon accounts (sub 6 + 8) always combined at SKU level

---

## Known Limitations

- OOS date is a proxy (last order date), not the actual warehouse stock-out date
- Lost sales estimate uses annual run-rate ÷ 365 — does not account for seasonality
- PPC ad sales shown are attributed conversions, not necessarily fulfilled (stock was zero)
