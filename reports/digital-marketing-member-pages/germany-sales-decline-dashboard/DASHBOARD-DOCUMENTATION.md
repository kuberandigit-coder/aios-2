# Germany Sales Decline — Stock Impact Dashboard
## Full Technical Documentation

**Version:** 1.0  
**Built:** 2026-07-23  
**Audience:** Warehouse Owner / AIOS Team  
**Live URL:** https://staff-requirements-02.vercel.app/germany-sales-decline-dashboard/

---

## 1. Overview

This dashboard is a **static HTML reporting suite** that shows which products are losing German sales because centralized German warehouse stock is unavailable. It covers three channels — Amazon DE, eBay DE, and Shopify DE — across 10 active German accounts.

There is no backend, no API, and no login. All data is embedded directly inside each HTML file as JavaScript arrays at build time. The pages are deployed as static files to Vercel.

---

## 2. Architecture

```
PostgreSQL Database
    │
    ▼
SQL Queries (run manually via MCP ledsone-db-mcp)
    │
    ▼
Python Script (formats data → JS array string)
    │
    ▼
Static HTML File (data embedded inside <script> tag)
    │
    ▼
Vercel (serves file as static asset)
    │
    ▼
Browser (renders table from JS array with filter/sort UI)
```

### Key Design Decisions

| Decision | Reason |
|---|---|
| Static HTML, no backend | Zero infrastructure cost, deploys in seconds, works offline |
| Data embedded in JS array | No fetch/CORS issues, instant page load, no API key exposure |
| Python to build HTML | SQL results are large; Python formats them reliably into escaped JS strings |
| OOS proxy = last order date | No stock history table available; last order date is the best available signal |
| Lost sales = estimate | Formula-based approximation, not confirmed actuals — flagged on every page |

---

## 3. Database Schemas Used

| Schema | Purpose |
|---|---|
| `order_management` | Sales orders, order lines, marketplace identifiers |
| `inventory` | Current stock per warehouse location |
| `listings` | Channel listing metadata (SKU ↔ item_id mapping) |
| `amazon_campaigns` | Amazon PPC performance data |
| `ebay_campaigns` | eBay PPC performance data |
| `google_ads` | Google Ads product performance data |
| `suppliers` | Supplier restock orders and order items |

### Key Tables

| Table | Key Columns |
|---|---|
| `order_management.orders` | `id`, `order_date`, `market_place`, `sub_source` |
| `order_management.order_line_items` | `order_id`, `sku`, `quantity`, `line_price` |
| `inventory.local_inventory_current_stock_location_wise` | `sku`, `warehouse_location`, `stock` |
| `listings.shopify_listings` | `sku`, `item_id`, `sub_source` |
| `listings.ebay_listings` | `sku`, `listing_id` |
| `amazon_campaigns.performance_data` | `listing_sku`, `spend`, `impressions`, `clicks`, `date_start` |
| `ebay_campaigns.performance_data` | `ad_id`, `spend`, `impressions`, `clicks`, `date_start` |
| `ebay_campaigns.ads` | `id` (=ad_id), `listing_id` |
| `google_ads.product_performance` | `product_item_id`, `spend`, `impressions`, `clicks`, `segments_date` |
| `suppliers.orders` | `id`, `status_confirmed`, `status_shipped`, `status_arrived`, `expected_completion_date` |
| `suppliers.order_items` | `order_id`, `sku`, `quantity` |

---

## 4. Core Logic

### 4.1 Germany Marketplace Identifier

All orders are filtered to German marketplace using:

```sql
WHERE o.market_place = 10
```

`market_place = 10` is the internal ID for Germany across all channels (Amazon DE, eBay DE, Shopify DE).

For channel separation, `sub_source` is used:

| Channel | sub_source values |
|---|---|
| Amazon DE — LEDSone | 8 |
| Amazon DE — DC Voltage | 6 |
| eBay DE — led_sone | varies |
| eBay DE — huettenlampen | varies |
| eBay DE — ledsonede | varies |
| eBay DE — electricalsone | varies |
| eBay DE — sunsone | varies |
| eBay DE — homin_gmbh | varies |
| Shopify DE — ledsone-de | 108 |

### 4.2 German Stock Check

Zero stock is determined from the centralized German warehouse:

```sql
FROM inventory.local_inventory_current_stock_location_wise licsl
WHERE licsl.warehouse_location = 'Germany'
  AND COALESCE(licsl.stock, 0) = 0
```

Only products with **zero stock at this location** are included in the OOS reports (1A, 1B, 1C).

### 4.3 Out-of-Stock Date Proxy

There is no historical stock depletion log. The OOS date is approximated using the **last German order date**:

```sql
MAX(o.order_date)::date AS last_order_date
```

Logic: if the last order was on date X, the product was available up to roughly date X, so it has been OOS since approximately that date.

```sql
days_oos = CURRENT_DATE - last_order_date
```

### 4.4 Lost Sales Formula

```
Daily Sales Rate = Annual Sales Revenue / 365
Estimated Lost Sales = Daily Sales Rate × Days OOS
```

In SQL:
```sql
ROUND(
  (SUM(oli.line_price) / 365.0) * (CURRENT_DATE - MAX(o.order_date)::date)
, 2) AS est_lost_sales
```

**Important:** This is an estimate only. It assumes the same daily sales rate would have continued. Both figures require business-owner validation.

### 4.5 Recommended Minimum Stock Formula

Used in Report 4 (Never OOS / Fast-Moving):

```
Monthly Sales Quantity = Annual Quantity / 12
Recommended Minimum Stock = Monthly Sales Quantity × 1.5
```

The 1.5× multiplier gives approximately 6 weeks of buffer stock.

### 4.6 Monthly Lost Opportunity (Slow Restock Report)

```
Monthly Lost Opportunity = Annual Revenue / 12
```

This represents the revenue at risk per month that the product remains OOS with no restock order in the pipeline.

---

## 5. Report-by-Report Data Sources & Logic

---

### Report 1A — Amazon DE Best Sellers OOS

**File:** `pages/report-1a-amazon-de.html`  
**Data:** 329 products | €36,718 est. lost | 338 avg days OOS

#### OOS Products Tab

**SQL Logic:**
1. Join `order_management.orders` + `order_management.order_line_items` filtered to `market_place = 10`
2. Restrict to Amazon sub_sources (6 and 8) — note: sub_source filter applied via the join to confirm Amazon channel
3. Group by SKU → compute `annual_sales`, `last_order_date`, `days_oos`, `est_lost_sales`
4. Join to `inventory.local_inventory_current_stock_location_wise` WHERE `warehouse_location = 'Germany'` AND `stock = 0`
5. Only products with zero DE stock are included

**Per-Account Last Order Date (special logic):**

Because Amazon DE has 2 accounts (LEDSone sub_source=8, DC Voltage sub_source=6), each SKU shows both accounts' last order dates stacked in the table cell. The per-account query groups by `(sku, sub_source)` and the HTML displays them as two lines per cell.

**PPC Spend Tab:**

Join path:
```
amazon_campaigns.performance_data.listing_sku → matches sku directly
```

```sql
SELECT listing_sku AS sku,
       SUM(spend) AS total_spend,
       SUM(impressions) AS total_impressions,
       SUM(clicks) AS total_clicks
FROM amazon_campaigns.performance_data
WHERE date_start >= '2025-01-01'
GROUP BY listing_sku
```

---

### Report 1B — eBay DE Best Sellers OOS

**File:** `pages/report-1b-ebay-de.html`  
**Data:** 288 products | €59,657 est. lost | 348 avg days OOS

#### OOS Products Tab

Same logic as 1A but filtered to eBay DE accounts (6 accounts across market_place=10).

**Per-Account Last Order Date (special logic):**

6 eBay accounts → each SKU shows up to 6 per-account last order date lines stacked in the table cell. The sub_source column identifies which account each line belongs to.

**PPC Spend Tab:**

eBay PPC join is more complex — 3-table join:
```
ebay_campaigns.performance_data.ad_id
  → ebay_campaigns.ads.id (= ad_id) → ebay_campaigns.ads.listing_id
  → listings.ebay_listings.listing_id → listings.ebay_listings.sku
```

```sql
SELECT el.sku,
       SUM(epd.spend) AS total_spend,
       SUM(epd.impressions) AS total_impressions,
       SUM(epd.clicks) AS total_clicks
FROM ebay_campaigns.performance_data epd
JOIN ebay_campaigns.ads ea ON ea.id = epd.ad_id
JOIN listings.ebay_listings el ON el.listing_id = ea.listing_id
WHERE epd.date_start >= '2025-01-01'
GROUP BY el.sku
```

---

### Report 1C — Shopify DE Best Sellers OOS

**File:** `pages/report-1c-shopify-de.html`  
**Data:** 52 products | €3,074 est. lost | 269 avg days OOS

#### OOS Products Tab

Same logic as 1A/1B filtered to Shopify DE (sub_source=108, market_place=10).

**PPC Spend Tab (Google Ads):**

Shopify DE is backed by Google Ads (not a dedicated Shopify PPC platform). Join path:

```
google_ads.product_performance.product_item_id
  → listings.shopify_listings.item_id (WHERE sub_source = 108)
  → listings.shopify_listings.sku
```

`product_item_id` in Google Ads = Shopify variant ID = `item_id` in shopify_listings.

```sql
SELECT sl.sku,
       SUM(pp.spend) AS total_spend,
       SUM(pp.impressions) AS total_impressions,
       SUM(pp.clicks) AS total_clicks
FROM google_ads.product_performance pp
JOIN listings.shopify_listings sl
  ON sl.item_id = pp.product_item_id AND sl.sub_source = 108
WHERE pp.segments_date >= '2025-01-01'
GROUP BY sl.sku
```

---

### Report 2 — Channel-Wise Stock Impact

**File:** `pages/report-3-channel-wise.html`  
**Data:** 634 OOS SKUs | €51,494 combined est. lost

**Columns:** Product SKU | Shopify Sales Loss | Amazon Sales Loss | eBay Sales Loss | Total Lost Sales

**SQL Logic:**

Three separate CTEs — one per channel — each computing `est_lost_sales` for OOS SKUs. Then a FULL OUTER JOIN on SKU across all three, COALESCE-ing NULLs to 0.

```sql
WITH amazon_oos AS (
  -- OOS SKUs on Amazon DE with est lost sales
),
ebay_oos AS (
  -- OOS SKUs on eBay DE with est lost sales
),
shopify_oos AS (
  -- OOS SKUs on Shopify DE with est lost sales
)
SELECT
  COALESCE(a.sku, e.sku, s.sku) AS sku,
  COALESCE(s.est_lost, 0) AS shopify_loss,
  COALESCE(a.est_lost, 0) AS amazon_loss,
  COALESCE(e.est_lost, 0) AS ebay_loss,
  COALESCE(s.est_lost,0) + COALESCE(a.est_lost,0) + COALESCE(e.est_lost,0) AS total_loss
FROM amazon_oos a
FULL OUTER JOIN ebay_oos e USING (sku)
FULL OUTER JOIN shopify_oos s USING (sku)
ORDER BY total_loss DESC
```

**Breakdown:**
- Amazon: €30,890
- eBay: €17,760
- Shopify: €2,845
- Combined: €51,494

---

### Report 3 — Slow Restocking / Lost Revenue Report

**File:** `pages/report-4-slow-restock.html`  
**Data:** 634 OOS SKUs | 577 with No Order | €54,962 total est. lost | €4,960/month at risk

**Columns:** Product SKU | First OOS Date | Days Missing | Monthly Sales | Lost Opportunity | Restock Status

**SQL Logic:**

Combines OOS SKU data with supplier restock pipeline:

```sql
-- Restock status from suppliers schema
SELECT soi.sku,
  CASE
    WHEN so.status_arrived = true THEN 'Arrived'
    WHEN so.status_shipped = true THEN 'Shipped'
    WHEN so.status_confirmed = true THEN 'Confirmed'
    ELSE 'No Order'
  END AS restock_status,
  so.expected_completion_date
FROM suppliers.orders so
JOIN suppliers.order_items soi ON soi.order_id = so.id
```

Status priority (highest to lowest): Arrived → Shipped → Confirmed → No Order

**Monthly Sales:**
```
monthly_sales = annual_revenue / 12
```

**Lost Opportunity:**
```
lost_opportunity = (annual_revenue / 365) × days_oos
```

---

### Report 4 — Fast-Moving Products / Never OOS List

**File:** `pages/report-5-never-oos.html`  
**Data:** 1,381 in-stock DE SKUs | 7 Below Min | 14 OK | 1,360 Well Stocked

**Columns:** Product | SKU | Avg Monthly Sales | Current Stock | Recommended Min Stock | Stock Health

**SQL Logic:**

```sql
SELECT
  licsl.sku,
  licsl.stock AS current_stock,
  ROUND(SUM(oli.quantity) / 12.0, 1) AS avg_monthly_qty,
  ROUND(SUM(oli.quantity) / 12.0 * 1.5, 0) AS recommended_min
FROM inventory.local_inventory_current_stock_location_wise licsl
JOIN order_management.order_line_items oli ON oli.sku = licsl.sku
JOIN order_management.orders o ON o.id = oli.order_id
WHERE licsl.warehouse_location = 'Germany'
  AND COALESCE(licsl.stock, 0) > 0          -- in-stock only
  AND o.market_place = 10
  AND EXTRACT(YEAR FROM o.order_date) = 2025
GROUP BY licsl.sku, licsl.stock
```

**Stock Health Banding:**

| Status | Condition |
|---|---|
| Well Stocked | `current_stock >= recommended_min × 2` |
| OK | `current_stock >= recommended_min` |
| Below Min | `current_stock < recommended_min` |

---

## 6. Product Images

Each report table shows product images loaded from:

```
https://www.ledsone.co.uk/images/sku/{SKU}.jpg
```

If the image fails to load (404 or network error), the `onerror` handler hides the broken image and shows a grey placeholder div instead:

```html
onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"
```

**Known Bug (fixed):** Unescaped single quotes inside `onerror` attributes break the JavaScript string that builds the HTML. Always escape to `\'` inside JS template literals.

---

## 7. HTML Page Structure

Every report page follows this structure:

```
<head>
  <style> ... embedded CSS ... </style>
</head>
<body>
  <div class="topbar"></div>
  <header class="masthead"> ... title + stats ... </header>
  <main class="page">
    <div class="tabs"> ... tab buttons ... </div>
    <div class="tab-panel" id="tab-oos"> ... OOS table ... </div>
    <div class="tab-panel" id="tab-ppc"> ... PPC table ... </div>
  </main>
  <script>
    const DATA = [ ... embedded JS array ... ];
    // filter, sort, render functions
  </script>
</body>
```

### Filter System

Each OOS table has:
- **Search box** — filters on SKU substring match
- **Sort** — click any column header to sort ascending/descending

### Tab System (Reports 1A, 1B, 1C)

Two tabs per page:
- **OOS Products** — main table of out-of-stock items with lost sales
- **PPC Spend** — ad spend data for the same SKUs (Amazon / eBay / Google Ads)

---

## 8. Deployment

**Platform:** Vercel (static site)  
**Project:** `staff-requirements-02`  
**Deploy command:**
```bash
cd Staff-requirements-02
vercel --prod --yes
```

All HTML files in `germany-sales-decline-dashboard/` are served as static assets. No build step, no framework — Vercel detects static files automatically.

**Production URL:** https://staff-requirements-02.vercel.app/germany-sales-decline-dashboard/

---

## 9. Accounts Covered

| Account | Channel | Marketplace |
|---|---|---|
| ledsone-de | Shopify | DE |
| LEDSone (sub_source 8) | Amazon | DE |
| DC Voltage (sub_source 6) | Amazon | DE |
| led_sone | eBay | DE |
| huettenlampen | eBay | DE |
| ledsonede | eBay | DE |
| electricalsone | eBay | DE |
| sunsone | eBay | DE |
| homin_gmbh | eBay | DE |
| *(Wayfair DE)* | *(removed — no data)* | — |

---

## 10. Summary Figures

| Report | SKUs | Est. Lost Sales | Key Insight |
|---|---|---|---|
| 1A — Amazon DE OOS | 329 | €36,718 | 338 avg days OOS |
| 1B — eBay DE OOS | 288 | €59,657 | 348 avg days OOS |
| 1C — Shopify DE OOS | 52 | €3,074 | 269 avg days OOS |
| 2 — Channel-Wise | 634 | €51,494 | Amazon biggest loss channel |
| 3 — Slow Restock | 634 | €54,962 | 577 SKUs with no order placed |
| 4 — Never OOS | 1,381 | — | 7 SKUs below recommended min stock |

---

## 11. Important Caveats

1. **OOS dates are proxies.** Last order date ≠ exact depletion date. Actual OOS could be earlier or later.
2. **Lost sales are estimates.** Based on 2025 annual run-rate. Seasonality, promotions, and competitor changes are not accounted for.
3. **Stock figures are from the Germany warehouse only.** Products may have stock in other warehouses (UK, etc.) not counted here.
4. **Data period is 2025.** Orders from 2024 or earlier are excluded from sales rate calculations.
5. **PPC spend figures are 2025 YTD.** They show advertising investment, not confirmed wasted spend.
6. All figures require business-owner validation before operational decisions are made.

---

*Built by AIOS · 2026-07-23 · Data source: PostgreSQL (order_management + inventory + listings + campaigns + suppliers schemas)*
