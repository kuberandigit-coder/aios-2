# Handover — Kamsi Requirement 6: Duplicate Listing & Price Check

**Title:** Handover for the new Requirement 6 dashboard tab
**Purpose:** Give Kuberan/Kamsi everything needed to review and approve deployment
**Requirement Source:** GPT planning layer instruction, 2026-07-08
**Business Question:** Across the full Shopify catalog, which SKUs appear on more than one listing, and do those listings have price differences?
**PostgreSQL Sources Checked:** Not used
**External Sources Checked:** None

## What's new for Kamsi
A 6th tab has been added to the existing Kamsi dashboard (`kamsi-req1-slow-moving-products.html`) — **built and validated locally, not yet deployed.**

Opening tab 6 shows:
- 6 KPI cards: Total Variant Rows Checked (17,542), Unique SKUs Checked (14,264), Duplicate SKUs (2,402), Rows With Duplicate SKU (5,571), Price Mismatch SKUs (1,430), Blank SKU Rows (109)
- A search box, Duplicate?/Price Mismatch?/Product Status filters, and a fully sortable table (click any column header)
- Every required column: SKU, Product Title, Variant Title, Listing URL, Current Price (£), Compare Price (£), Duplicate?, Duplicate Count, Price Mismatch?, Matching Listing URLs, Last Checked
- Colour-coded badges (orange=Duplicate Yes, green=Duplicate No, red=Price Mismatch Yes, green=Price Mismatch No)
- CSV export button

## Headline numbers
Out of 5,179 products / 17,542 variant listing rows: **2,402 SKUs are duplicated across more than one listing URL**, affecting 5,571 rows. Of those duplicate SKUs, **1,430 have an actual price difference** between the duplicated listings — worth reviewing, since a customer could see two different prices for what is nominally the same product depending on which URL they land on.

## Important — please read
1. **This has NOT been deployed.** Per this task's explicit instruction, I built and fully validated it locally only. It needs your approval before it goes live.
2. This is a **snapshot as of 2026-07-08** — if products/prices change in Shopify afterward, this needs a re-run of `2026-07-08_kamsi_req6_parse_and_detect.py` against a fresh bulk export before the numbers are trusted again.
3. Found **34 cases** where a single product has multiple variants (different colours/styles) sharing the same SKU — these correctly show as "duplicates" of themselves under the stated logic, but they're not really separate listings, just variant options. All 34 were spot-checked and are same-price, so they don't introduce any false Price Mismatch flags — but if this pattern grows, it might be worth a follow-up rule to exclude same-product variant duplicates from the "true" duplicate-listing count.

## Files to know about
- Detection logic: `reports/Kamsi/data/2026-07-08_kamsi_req6_parse_and_detect.py` — re-runnable against a fresh Shopify bulk export
- Full audit CSV: `reports/Kamsi/data/2026-07-08_kamsi_req6_duplicate_price_log.csv`
- Live page (once deployed): `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` (tab 6)

**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Built and validated locally — awaiting deployment approval
**Next Steps:** Kuberan review of the 1,430 price-mismatch SKUs; approve deployment when ready
**PASS / FAIL:** PASS
