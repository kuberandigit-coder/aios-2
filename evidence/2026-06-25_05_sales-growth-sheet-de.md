# 05 — Sales Growth Google Sheet (ledsone.de)

**Date:** 2026-06-25
**Store:** ledsone-de.myshopify.com
**Currency:** EUR

## What was done
- Pulled monthly total_sales from Shopify for ledsone.de across 3 years
- Calculated growth % for all months
- Created Google Sheet with full data table + Apps Script for chart and formatting

## Google Sheet
**Link:** https://docs.google.com/spreadsheets/d/1A4uHjJ3OEx1_ObUpdAwLD52nJycVxpqcor1YxkLmXy0/edit
**Tab name:** Sales Growth 2024-2026
**Owner:** digitalmarketing69140951@gmail.com

## Shopify Data Pulled

| Month | 2024 Sales (EUR) | 2025 Sales (EUR) | 2026 Sales (EUR) |
|-------|-----------------|-----------------|-----------------|
| Jan | 5,908.12 | 16,554.29 | 22,908.91 |
| Feb | 5,340.34 | 12,576.32 | 30,555.20 |
| Mar | 4,954.86 | 12,712.47 | 32,825.03 |
| Apr | 5,431.55 | 10,747.56 | 27,911.33 |
| May | 8,238.34 | 13,392.86 | 21,098.12 |
| Jun | 8,781.88 | 11,764.38 | 13,978.02 (partial to Jun 25) |
| Jul | 11,594.23 | 13,048.97 | N/A |
| Aug | 12,641.00 | 14,380.18 | N/A |
| Sep | 16,696.69 | 14,343.26 | N/A |
| Oct | 18,235.72 | 18,744.47 | N/A |
| Nov | 15,796.10 | 23,408.92 | N/A |
| Dec | 13,819.87 | 19,297.72 | N/A |
| **TOTAL** | **127,438.70** | **180,971.40** | **149,276.61 (YTD)** |

## Growth Summary
- 2025 vs 2024: +42.0%
- 2026 YTD vs 2025 same period (Jan-Jun): +92.0%

## Apps Script Features
- Tab renamed to Sales Growth 2024-2026
- Line chart positioned top right (column H, row 1)
- Chart: 3 colored lines — Blue=2024, Orange=2025, Green=2026
- Legend at bottom with year labels visible
- Growth % color coded: dark green (100%+), medium green (30-99%), light green (1-29%), red (negative)
- No frozen rows
- Currency format on sales columns
- Alternate row shading
