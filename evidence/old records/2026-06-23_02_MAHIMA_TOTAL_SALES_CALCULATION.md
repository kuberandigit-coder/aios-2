# Task 02 — Mahima All-Time Total Sales Calculation
**Date:** 23 June 2026  
**Type:** Data analysis — terminal output only, no file saved  
**Output:** Terminal result (numbers reported in conversation)

---

## What Was Asked
"Can you tell me how much amount she did sold" — total all-time revenue from all Mahima products combined.

## How It Was Done

### Step 1 — Loop all 598 Mahima products
- Loaded Mahima IDs from memory, matched against dupes.pkl store products
- For each product: called `get_sales(title)` to pull from analytics data

### Step 2 — Sum totals
- Added gross sales, net sales, and order counts across all 598 products
- Products absent from analytics counted as EUR 0.00 / 0 orders

### Step 3 — Output to terminal
- Ran inline Python script via PowerShell
- Printed total gross, net, orders, averages

## Result

| Metric | Value |
|--------|-------|
| **Total Gross Sales (all-time)** | **EUR 149,630.17** |
| **Total Net Sales (all-time)** | **EUR 141,062.10** |
| **Total Orders (all-time)** | **8,352** |
| Products with at least 1 sale | 343 / 598 |
| Products with ZERO sales | 255 / 598 (43%) |
| Average gross per product | EUR 250.22 |
| Average orders per product | 14.0 |

## Key Insight
43% of Mahima's Google Ads products have NEVER generated a single sale. All EUR 149,630 came from just 343 products. The other 255 are receiving Google Ads budget with zero return.
