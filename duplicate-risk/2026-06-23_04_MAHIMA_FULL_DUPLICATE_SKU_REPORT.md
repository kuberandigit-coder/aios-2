# Task 04 — Mahima Full Duplicate SKU Report with Product B, C, D
**Date:** 23 June 2026  
**Type:** Investigation / Report generation — No store changes  
**Output:** `mahima-full-duplicate-sku-report.docx`

---

## What Was Asked
The previous duplicate SKU report only showed Product A and Product B (one duplicate). User asked to find ALL duplicates for each SKU — if a SKU has 3 or 4 listings, show Product C and D as well. No limit on duplicates.

## Problem with Previous Report
Old script `build_mahima_doc.py` had this line:
```python
b = prods[1] if len(prods) > 1 else None
```
It only ever looked at the second product (B). If a SKU had 4 products sharing it, C and D were completely ignored.

## How It Was Fixed

### Step 1 — Remove the hard limit
Old code: `rest = rest[:3]` (capped at 3)
New code: `rest = mahima_prods[1:] + other_prods` (NO limit — all duplicates included)

### Step 2 — Dynamic column structure
Since max duplicates was unknown before running, script first scans all groups to find `max_extras`:
```python
max_extras = max(len(r['rest']) for r in rows)
```
Result: max_extras = 3 (meaning D is the last column needed)

### Step 3 — Column layout (18 columns)
`# | SKU | Prod A | Prod B | Prod C | Prod D | Price A | Price B | Price C | Price D | A Sales | A Orders | B Sales | B Orders | C Sales | C Orders | D Sales | D Orders`

### Step 4 — Product sorting logic
- Product A = Mahima product with highest orders
- Products B, C, D = remaining Mahima products (if any) + non-Mahima products, sorted by orders desc
- [M] tag added to any product also in Mahima's list

### Step 5 — Price gap highlighting
- Red cell on Price B/C/D if price differs from Price A by >= EUR 0.01
- (!) suffix added to price text

### Step 6 — 4 Sections in document
1. All groups (583)
2. Price discrepancy groups (393) — red heading
3. Both A and at least one other have sales (332)
4. SKUs with 3+ listings / C column present (131)

## Duplicate Distribution Found
| Extra listings | Groups |
|---|---|
| 1 (only B) | 452 |
| 2 (B + C) | 123 |
| 3 (B + C + D) | 8 |
| More than 3 | 0 |

## Result
- File: `C:\Users\PC\OneDrive\Desktop\DE\reports\mahima-full-duplicate-sku-report.docx`
- Size: 164 KB
- Script: `mahima_full_dupes_doc.py`
- Page: A3 landscape (42 x 29.7 cm) to fit 18 columns
