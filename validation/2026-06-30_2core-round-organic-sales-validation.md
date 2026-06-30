# Validation: 2Core-Round Organic Sales Jan-Jun 2026

**Task:** Organic sales (revenue + orders + 1st session data) for 28 2core-round products
**Date:** 2026-06-30
**Status:** PASS

## Method Validation
- Used Shopify Admin GraphQL `orders` query with `product_id` filter — confirmed working
- `customerJourneySummary.firstVisit` returned per-order first session source
- Cross-checked: product_id filter correctly returns only orders containing that product
- Fetched all orders (no pagination needed — all products had <250 orders each)
- Revenue calculated from matching lineItem.quantity × originalUnitPrice (not totalOrderPrice)

## Coverage Check
| # | Product | Orders Found | Status |
|---|---------|-------------|--------|
| 1 | ~3228 Black (4417262551136) | 66 total, 19 organic | ✓ |
| 2 | ~3024 Hemp (4417280770144) | 19 total, 5 organic | ✓ |
| 3 | ~3227 (4417262452832) | 0 orders | ✓ |
| 4 | ~4714 Grey (8010472292602) | 9 total, 4 organic | ✓ |
| 5 | ~4746 White (4417262649440) | 10 total, 5 organic | ✓ |
| 6 | ~3229 Light Gold (4417262518368) | 2 total, 0 organic | ✓ |
| 7 | ~3031 Cream (4417280213088) | 11 total, 6 organic | ✓ |
| 8 | ~3027 Army Green (4417280409696) | 3 total, 2 organic | ✓ |
| 9 | ~3246 Yellow (4417263468640) | 2 total, 1 organic | ✓ |
| 10 | ~3028 Light Green (4417280376928) | 1 total, 0 organic | ✓ |
| 11 | ~3026 (4417280475232) | 0 orders | ✓ |
| 12 | ~3222 (4417264746592) | 3 total, 2 organic | ✓ |
| 13 | ~3213 (4417280606304) | 2 total, 2 organic | ✓ |
| 14 | ~4719 Brown (8010481828090) | 1 total, 1 organic | ✓ |
| 15 | ~4695 (4417263403104) | 3 total, 2 organic | ✓ |
| 16 | ~4685 Dark Brown (4417263272032) | 18 total, 8 organic | ✓ |
| 17 | ~3244 (4417263239264) | 3 total, 2 organic | ✓ |
| 18 | ~1405 (4417279852640) | 0 orders | ✓ |
| 19 | ~4415 (7986285445370) | 1 total, 1 organic | ✓ |
| 20 | ~4692 (4417264877664) | 0 orders | ✓ |
| 21 | ~1672 Gold (4417262256224) | 7 total, 0 organic | ✓ |
| 22 | ~4711 Green (4417264812128) | 5 total, 1 organic | ✓ |
| 23 | ~4729 (4417265041504) | 1 total, 1 organic | ✓ |
| 24 | ~3049 (4417279918176) | 2 total, 2 organic | ✓ |
| 25 | ~3032 (4417279983712) | 0 orders | ✓ |
| 26 | ~2203 (5265738629281) | 1 total, 0 organic | ✓ |
| 27 | ~4700 (8010439360762) | 3 total, 0 organic | ✓ |
| 28 | ~4734 (8010511319290) | 0 orders | ✓ |

**All 28 products covered.**

## Organic Classification Logic (applied consistently)
- ORGANIC SEARCH: Google/Bing/DuckDuckGo with null utmParameters
- DIRECT: source=direct (any referrerURL including ledsone.co.uk)
- NO DATA: firstVisit=null and momentsCount=0
- PAID (excluded): Google with medium=PMax/PMax_Asset/cpc/pmax/google_ads; Facebook; android-app://m.facebook.com/

## Final Totals
- 64 organic orders
- £1,366.06 organic product revenue
- 17 of 28 products had at least 1 organic order
- No AI tool referrals detected (0 ChatGPT/Perplexity orders)
