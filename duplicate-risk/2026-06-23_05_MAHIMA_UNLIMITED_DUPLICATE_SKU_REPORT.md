# Task 05 — Mahima Duplicate SKU Report — Confirmed No Limit Version
**Date:** 23 June 2026  
**Type:** Investigation / Report generation — No store changes  
**Output:** `mahima-full-duplicate-sku-unlimited.docx`

---

## What Was Asked
"Not only product A B C D only if more duplicate available show add for all Mahima product do not miss any duplicate and there are no limit"

User wanted confirmation that truly no cap exists and ALL duplicates are shown regardless of count.

## What Was Different from Task 04
Task 04 script `mahima_full_dupes_doc.py` still had `rest[:3]` cap in one place.
This new script `mahima_full_dupes_unlimited.py` completely removes any cap:
```python
# NO LIMIT — all remaining mahima + all others
rest = mahima_prods[1:] + other_prods   # NO [:3] anywhere
```

## How It Was Done

### Step 1 — Scan all groups with no limit
- Loaded dupes.pkl (1,075 duplicate SKU groups from 2,484 store products)
- Filtered to groups where at least 1 product is in Mahima's 618-ID list
- Result: 583 Mahima duplicate groups

### Step 2 — Confirmed actual maximum
- After removing all limits: `max_extras = 3` (D is the highest column needed)
- This confirmed Task 04 already captured everything — the max in the entire store is 4 products per SKU

### Step 3 — Dynamic page width
```python
page_w = max(42.0, total_width + 2.5)
```
Ensures table always fits regardless of how many columns

### Step 4 — Grey cells for empty slots
When a SKU only has 1 duplicate (B only), C and D cells are filled grey (#F0F0F0) to clearly show "not applicable"

## Counts Confirmed
| Section | Count |
|---|---|
| All Mahima duplicate groups | 583 |
| Price gap groups | 393 |
| Both A + other have sales | 332 |
| 3+ listings (C or D present) | 131 |

## Result
- File: `C:\Users\PC\OneDrive\Desktop\DE\reports\mahima-full-duplicate-sku-unlimited.docx`
- Size: 158 KB
- Script: `mahima_full_dupes_unlimited.py`
- Confirmed: no missed duplicates, identical counts to Task 04 (max was already D)
