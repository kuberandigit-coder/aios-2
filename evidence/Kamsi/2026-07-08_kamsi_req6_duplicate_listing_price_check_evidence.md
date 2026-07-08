# Evidence — Kamsi Requirement 6: Duplicate Listing & Price Check

**Title:** Kamsi Req 6 built — full-catalog SKU duplicate detection and price mismatch audit
**Purpose:** Prove the detection logic, data source, and dashboard were built exactly per the approved business rule, read-only
**Requirement Source:** GPT planning layer instruction, 2026-07-08 (see `prompts/Kamsi/2026-07-08_kamsi_req6_duplicate_listing_price_check_prompt.md`)
**Business Question:** Across the full Shopify product catalog, which SKUs appear on more than one product listing URL, and do those duplicated listings have price differences?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only, per instruction
**External Sources Checked:** None

## Step 1 — Existing asset discovery
Searched `prompts/Kamsi/`, `evidence/Kamsi/`, `validation/Kamsi/`, `reports/Kamsi/`, `handover/Kamsi/`, `vercel/Kamsi/`, and all existing Kamsi HTML pages for any prior duplicate-SKU or price-mismatch report. Full-text search for "duplicate SKU", "price mismatch", "duplicate listing", "Requirement 6"/"Req6" across all those locations returned **no prior report of this kind**. Kamsi's dashboard already exists as a single page with 5 in-page tabs (`kamsi-req1-slow-moving-products.html`).

**Decision: EXTEND** — added Requirement 6 as a 6th tab on the existing merged Kamsi dashboard, same pattern as Requirements 1–5. No duplicate report/page created.

## Step 2 — Shopify data collection (read-only)
- Confirmed connected store: `ledsone.co.uk` (via `get-shop-info`) — same store as every other Kamsi/Dilaksi requirement.
- Used **Shopify Admin GraphQL Bulk Operations API** (`bulkOperationRunQuery`), read-only, single pass: `products { id title handle status updatedAt variants { id title sku price compareAtPrice } }`.
- Result: **22,721 JSONL records** (5,179 products + nested variant edges), 4.85 MB, downloaded to `2026-07-08_kamsi_req6_bulk_products.jsonl`.
- **No mutation performed. No product/variant data changed.** Confirmed via Shopify's own read-only bulk query API (`bulkOperationRunQuery`, not a mutation).

## Step 3 — Calculation
- Parsed into **17,542 variant/listing rows** (one row per product variant, i.e. one row per Listing URL + variant combination — a product with 3 variants sharing one URL contributes 3 rows, each carrying that same `/products/{handle}` Listing URL, per instruction "one row per product variant/listing URL").
- **109 rows have a blank/null SKU** — excluded from duplicate grouping (forced `Duplicate? = No`, `Price Mismatch? = No`), counted in the "Blank SKU Rows" KPI, per instruction.
- Grouped the remaining **17,433 non-blank-SKU rows** by SKU → **14,264 unique SKUs**.
- Duplicate Count = number of rows sharing that SKU; Duplicate? = Yes if ≥2; Price Mismatch? = Yes only if Duplicate? = Yes AND the set of distinct Current Prices among those rows has more than 1 member.
- Matching Listing URLs = the sorted set of distinct `/products/{handle}` URLs for that SKU.

### Results (17,542 variant rows, 14,264 unique SKUs)
| Metric | Value |
|---|---|
| Total Variant Rows Checked | 17,542 |
| Unique SKUs Checked | 14,264 |
| Duplicate SKUs | 2,402 |
| Rows With Duplicate SKU | 5,571 |
| Price Mismatch SKUs | 1,430 |
| Blank SKU Rows | 109 |

## Edge-case validation (verbatim script output, spot-checked manually)
**Duplicate + price mismatch example:**
```
CRFF108YB+PHNH1GDRYB -> [
  ('/products/threaded-lamp-bulb-holder-vintage', £10.99),
  ('/products/chrome-threaded-lamp-holder-vintage-light', £9.89),
  ('/products/threaded-lamp-bulb-holder-vintage-light', £9.89)
]
```
3 listings, 2 distinct prices (£10.99, £9.89) → correctly Duplicate=Yes, Price Mismatch=Yes.

**Duplicate, same price, no mismatch example:**
```
12IP20120 -> [
  ('/products/industrial-universal-switching-power-supply-12v-120w-10a-aluminium', £11.89),
  ('/products/led-driver-12v-ip20-constant-voltage-transformer-non-dimmable', £11.89),
  ('/products/dc-12v-ip20-power-supply', £11.89)
]
```
3 listings, all £11.89 → correctly Duplicate=Yes, Price Mismatch=No.

**SKU on 5 listings (largest fan-out found):**
```
LDMG80E274 -> count 5, prices £3.05, £3.05, £2.99, £2.69, £2.49 (4 distinct prices across 5 rows)
```
Correctly handled as a single duplicate group with all 5 rows present and Price Mismatch=Yes.

## Step 4 — HTML Report
Added **tab 6** to `kamsi-req1-slow-moving-products.html` (the live merged Kamsi dashboard):
- 6 required KPI cards (values above)
- Search box (SKU/title/URL), Duplicate? filter, Price Mismatch? filter, Product Status filter (ACTIVE 16,846 / DRAFT 602 / UNLISTED 93 / ARCHIVED 1)
- A genuine sortable `<table>` (click any column header to sort ascending/descending) — all 11 required columns present in the exact order specified
- Colour-coded badges: Duplicate? Yes=orange/No=green, Price Mismatch? Yes=red/No=green
- "Export CSV" button exporting the currently filtered/sorted set with all 11 columns
- "Last checked: 2026-07-08" shown in the header
- Mobile-responsive (same horizontal-scroll table wrapper pattern used by every other Kamsi requirement)
- Pagination in pages of 100 rows client-side (same proven architecture as Req1/Req4/Req5, given the 17,542-row dataset)

## Verification performed
- Div balance: 189 open / 189 close (confirmed balanced after all edits)
- `node --check` syntax validation on the full combined script: passed, exit 0
- Confirmed zero id collisions (`q6`, `dupsel6`, `mismatchsel6`, `statussel6`, `tbody6`, `pageInfo6`, `prevPage6`, `nextPage6` — each appears exactly once)
- **Functional simulation** (Node.js + mock DOM, real embedded data) confirmed:
  - Search for "CRFF108YB" → 14 matching rows
  - Duplicate?=Yes filter → exactly 5,571 rows (matches KPI)
  - Price Mismatch?=Yes filter → 3,381 rows across exactly 1,430 unique SKUs (matches KPI)
  - Product Status=DRAFT filter → exactly 602 rows (matches raw data breakdown)
  - Column sort → verified ascending order correct
  - CSV export → ran without error

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` — Req6 tab added (Req1–5 tabs untouched)
- `reports/Kamsi/data/2026-07-08_kamsi_req6_bulk_products.jsonl` — raw Shopify bulk export (22,721 records)
- `reports/Kamsi/data/2026-07-08_kamsi_req6_parse_and_detect.py` — parser + duplicate/price-mismatch logic (auditable, re-runnable)
- `reports/Kamsi/data/2026-07-08_kamsi_req6_rows.json` — 17,542-row dataset embedded in the page
- `reports/Kamsi/data/2026-07-08_kamsi_req6_duplicate_price_log.csv` — full evidence CSV
- `reports/Kamsi/data/2026-07-08_kamsi_req6_build_and_merge.py` — HTML build/merge script
- `reports/Kamsi/data/2026-07-08_kamsi_before_req6_add_backup.html` — safety backup before this change

## What was explicitly NOT touched
- No Shopify mutation calls made (read-only bulk query only)
- No PostgreSQL queries run
- Req1–5 tabs unaffected
- No other staff member's pages touched
- **No deployment performed** — per explicit instruction, built and validated locally only

**Duplicate risk:** GREEN (no prior Requirement 6 report of any kind existed)
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Built and validated locally — **awaiting deployment approval**
**Known Limitations:**
1. "Duplicate Count" and "Matching Listing URLs" are computed once per Shopify pull (2026-07-08) — if the catalog changes, this snapshot goes stale and needs a re-run of the parser script.
2. A single product with multiple variants sharing the identical SKU (e.g. a mis-tagged variant set) shows as a "duplicate" of itself across variant rows sharing one Listing URL — handled per instruction ("if one product has multiple variants with the same SKU, include each variant row and document this"). Quantified: **34 SKU+Listing-URL combinations** have more than one variant row (e.g. SKU `LHS6E27BY` on `/products/copper-e27-lamp-light-bulb-holder` has both a "Shiny Black" and "Yellow Brass" variant at the same £5.49 price) — all 34 spot-checked are genuinely different colour/style variants of one product sharing one SKU, all same-price, so none contribute a false Price Mismatch.
3. Compare Price is shown as-is from Shopify (or "-" if null) and is not validated against any business rule beyond display, per instruction.
**Next Steps:** Kuberan review of the KPI numbers and decision on deployment
**PASS / FAIL:** PASS
