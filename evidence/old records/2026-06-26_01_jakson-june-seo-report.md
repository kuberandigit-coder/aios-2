# 01 — Jackson June 2026 SEO Sales Report (Apps Script)

Pulled all Shopify orders for Jackson's 50 ledsone.co.uk products from 01 Jun – 25 Jun 2026, classified them by traffic source, and generated a ready-to-run Apps Script to create the report tab in the Jackson sheet.

## What was done

- Loaded Jackson's 50 product IDs from memory (user_jackson.md)
- Queried Shopify Admin GraphQL using `product_id` filters with OR batching (5 parallel queries of 10 IDs each) to avoid paginating ~1,200+ store-wide orders
- Classified each order's first-visit session as: Organic SEO / Direct / No Data / Paid (excluded from SEO table)
- Built Apps Script function `createJacksonSEOReportJune2026()` matching the May 2026 report format

## Results

| Category | Orders | Revenue |
|---|---|---|
| ✅ Truly Organic SEO | 5 | £121.85 |
| 🔵 Direct / No UTM | 12 | £218.26 |
| ⚫ No Data | 4 | £53.92 |
| **SEO Table Total** | **21** | **£394.03** |
| Jackson All June (~48 incl. paid) | ~48 | £718.01 |

## Key organic orders

- #LED55484 — Bing SEO — IP68 Junction Box — 12 qty — £46.20
- #LED55688 — Google SEO — Ribbed Glass Wall Light E27 — £43.78
- #LED54729 — Google SEO — IP67 LED Modules — £23.19
- #LED55915 — Google SEO — 5-Way Malleable Iron Pipe Fitting — £3.79
- #LED56452 — Google Organic (medium=organic, campaign=Multifeeds) — M10 Cord Grip — £4.89

## Notable direct orders

- #LED55424 — IP67 LED Modules — 6 qty × 2 variants — £79.17 (largest direct order)
- #LED55026 — IP68 Junction Box — 15 qty — £57.75

## Sheet

- **Sheet:** https://docs.google.com/spreadsheets/d/1k0v-L1Hw-1IVk84xogI4Iik-6bwZVjwHCC7iU1RSQAw/edit
- **New tab name:** Jackson - June 2026 SEO
- **Script function:** `createJacksonSEOReportJune2026()`

## Notes

- Paid orders (Google Ads PMax, Meta) excluded from SEO table — 27 paid orders totalling ~£323.98
- Jackson Total ~£718.01 is approximate; verify paid orders separately if exact figure needed
- Period is 01 Jun – 25 Jun only (not full month)
- Team rule: Jackson = ledsone.co.uk (GBP). Never merge with Mahima (ledsone.de / EUR)
