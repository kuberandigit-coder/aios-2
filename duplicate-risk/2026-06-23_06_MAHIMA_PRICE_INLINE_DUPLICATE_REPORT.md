# Task 06 — Mahima Duplicate SKU Report — Price Shown Inside Product Cell
**Date:** 23 June 2026  
**Type:** Investigation / Report generation — No store changes  
**Output:** `mahima-duplicate-sku-price-inline.docx`

---

## What Was Asked
"In the document why standalone column for Product A B C D prices — add the prices under every product title, add for all, add the price under every product as a row"

User did not want separate Price A, Price B, Price C, Price D columns. Instead, the price should appear INSIDE the product's own cell, on the line below the product title.

## Problem with Previous Reports
Previous column structure had separate standalone price columns:
```
# | SKU | Prod A | Prod B | Prod C | Prod D | Price A | Price B | Price C | Price D | A Sales | A Orders | ...
```
This made the table hard to read — you had to look across to another column to find the price.

## How It Was Redesigned

### Step 1 — New column structure (14 columns instead of 18)
Removed 4 standalone price columns. New layout:
```
# | SKU | Product A (title+price) | Product B (title+price) | Product C (title+price) | Product D (title+price) | A Sales EUR | A Orders | B Sales EUR | B Orders | C Sales EUR | C Orders | D Sales EUR | D Orders
```

### Step 2 — Two-line cell writing
Each product cell now contains TWO paragraphs:
- **Line 1:** Product label (`~12345 [M] LED Trafo 12V...`) — normal weight, dark grey
- **Line 2:** Price (`EUR 9.99`) — bold, coloured

```python
def cell_write_product(cell, p_obj, a_price, bg):
    # Line 1: title
    r1 = para.add_run(label)
    # Line 2: price in new paragraph
    price_para = cell.add_paragraph()
    r2 = price_para.add_run(price_str)
```

### Step 3 — Colour coding for prices
- **Green** (`#1F601F`) = price matches Product A (normal)
- **Red** (`#C00000`) + `(!)` suffix = price differs from Product A by >= EUR 0.01

Product A price is always shown in green (it is the reference price — no gap possible with itself).

### Step 4 — Grey cells for empty slots
When Product C or D does not exist for a SKU, the cell is filled grey — no title, no price, clearly empty.

### Step 5 — Legend on cover page
```
EUR X.XX in GREEN = normal price
EUR X.XX (!) in RED = price differs from Product A
grey cell = no further duplicate
[M] = also a Mahima product
```

## Comparison: Before vs After

| Before (18 cols) | After (14 cols) |
|---|---|
| Prod A column | Prod A column (title + price inside) |
| Prod B column | Prod B column (title + price inside) |
| Prod C column | Prod C column (title + price inside) |
| Prod D column | Prod D column (title + price inside) |
| Price A column | — removed |
| Price B column | — removed |
| Price C column | — removed |
| Price D column | — removed |
| A Sales + A Orders | A Sales + A Orders |
| B/C/D Sales + Orders | B/C/D Sales + Orders |

## 4 Sections in Document
1. All duplicate groups (583)
2. Price discrepancy groups (393) — red heading
3. Both A + other have sales (332)
4. 3+ listings / C or D present (131)

## Result
- File: `C:\Users\PC\OneDrive\Desktop\DE\reports\mahima-duplicate-sku-price-inline.docx`
- Size: 147 KB
- Script: `mahima_dupes_price_inline.py`
- Page: A3 landscape (42 x 29.7 cm)
- Cleaner, more readable than previous versions
