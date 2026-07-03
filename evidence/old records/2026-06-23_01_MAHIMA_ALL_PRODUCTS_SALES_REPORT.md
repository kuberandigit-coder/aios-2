# Task 01 — Mahima All Products Sales Performance Report
**Date:** 23 June 2026  
**Type:** Investigation / Report generation — No store changes  
**Output:** `mahima-products-sales-performance.docx`

---

## What Was Asked
Create a Word document listing ALL 598 Mahima Google Ads products sorted from zero sales to highest sales (ascending order).

## How It Was Done

### Step 1 — Load Mahima Product IDs
- Loaded 618 product IDs from memory file: `C:\Users\PC\.claude\projects\...\memory\reference_mahima_google_ads.md`
- These are the Shopify numeric product IDs Mahima uses for Google Ads campaigns

### Step 2 — Match Products in Store
- Loaded all 2,484 store products from `dupes.pkl` (previously scanned via Shopify Bulk Operation API)
- Matched Mahima IDs against store products → 598 found in store (20 IDs not found)

### Step 3 — Get Sales Data
- Loaded analytics data from Shopify ShopifyQL query result (top 1,000 products all-time)
- Matched each product by title (exact match first, then first-30-chars partial match)
- Products not found in analytics = 0 lifetime sales

### Step 4 — Sort and Colour Code
- Sorted ascending: 0 orders first → highest orders last
- Red rows = 0 sales (255 products)
- Yellow rows = 1–10 orders (low)
- Green rows = 11+ orders (good)

### Step 5 — Generate Word Document
- Script: `mahima_all_products_doc.py`
- Page: A4 landscape (29.7 x 21 cm)
- Table columns: # | Product ID | Product Title | Handle | Status | All-Time Sales EUR | All-Time Net EUR | All-Time Orders | Performance
- Performance labels: No Sales / Very Low / Low / Medium / Good / High
- Dark header row (#1F1F2E), alternating row colours, colour-coded by sales band

## Result
- File: `C:\Users\PC\OneDrive\Desktop\DE\reports\mahima-products-sales-performance.docx`
- Size: 83 KB
- Rows: 598 products (255 red → 343 yellow/green)

## Key Numbers
| Metric | Value |
|--------|-------|
| Total products | 598 |
| Zero sales | 255 (43%) |
| Has sales | 343 (57%) |
