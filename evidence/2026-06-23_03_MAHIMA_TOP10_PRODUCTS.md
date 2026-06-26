# Task 03 — Mahima Top 10 Best Selling Products
**Date:** 23 June 2026  
**Type:** Data analysis — terminal output only  
**Output:** Terminal table result

---

## What Was Asked
"Find top 10 products in selling of Mahima" — ranked by all-time gross sales EUR.

## How It Was Done

### Step 1 — Filter only products with sales
- From all 598 Mahima products, filtered to 343 that have at least 1 order

### Step 2 — Sort by gross sales descending
- Sorted `all_prods` by `gross` field (highest first)
- Took top 10 results

### Step 3 — Print terminal table
- Columns: Rank | Product ID | Orders | Gross EUR | Net EUR | Title

## Result — Top 10

| Rank | Product ID | Title | Orders | Gross EUR |
|------|-----------|-------|--------|-----------|
| 1 | 6870920921255 | LED Trafo 12V IP67 Netzteil 10W–350W | 434 | EUR 13,260.63 |
| 2 | 8286052679945 | 12V Module IP65 fur Leuchtschilder | 122 | EUR 7,217.03 |
| 3 | 6632516419751 | Montagehalterung Deckenleuchte Stahl | 816 | EUR 4,759.19 |
| 4 | 15561582510345 | Vintage Wandleuchte Verstellbar 21cm | 114 | EUR 4,113.69 |
| 5 | 8289213153545 | Verstellbare Kabelhalter Lampenaufhangung | 562 | EUR 3,941.90 |
| 6 | 8313469108489 | LED Leuchtmittel E27/E14 4W/8W Dimmbar | 257 | EUR 3,764.27 |
| 7 | 7998062199049 | LED Netzteil 24V 20A 480W Transformator | 55 | EUR 3,369.25 |
| 8 | 6566984482983 | 3-adriges Textil-Lampenkabel | 241 | EUR 3,203.99 |
| 9 | 7350738059494 | Konstantstrom LED Treiber 300mA | 178 | EUR 2,373.48 |
| 10 | 5486934786215 | Vintage Textilkabel 3-adrig Schwarz | 112 | EUR 2,354.29 |

**Top 10 combined: EUR 52,357.72 = 35% of all Mahima revenue**

## Key Insights
- Product #1 (LED Trafo) = highest revenue but 434 orders — high value item (~EUR 30 per order avg)
- Product #3 (Montagehalterung) = most orders (816) but lower revenue — cheap high-volume item
- Top 3 products alone = EUR 25,236 = 17% of all Mahima revenue
