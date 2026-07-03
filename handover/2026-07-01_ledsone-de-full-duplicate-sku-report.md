# Handover — Full Duplicate SKU Report (ledsone-de)

**Date:** 2026-07-01
**Status:** PASS — ready for human review, no store changes made

## What was completed
A complete, store-wide duplicate-SKU audit of ledsone.de (2,507 products / 9,994 variants), listing every product that shares each duplicated SKU (not just one comparison pair, as the prior doc did). 1,079 duplicate SKU groups found, 176 of which have 3 or 4 listings sharing one SKU.

## Why
Duplicate SKUs split sales/SEO/reviews across multiple listings for the same physical product and risk price inconsistency. The merchant needs a full, current picture to plan a catalog cleanup — the prior doc undercounted because its table format could only show 2 listings per SKU.

## Where the report is
`duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report_v2.docx` — use this file. An older, non-`_v2` file of the same name in the same folder is stale (has a column-clipping layout bug) and should be deleted once no longer open in Word.

## What Shopify data was used
Live Shopify Admin GraphQL bulk export (products + variants: sku, price, status, handle) and ShopifyQL all-time sales/orders per product. Both read-only. Full query text in `evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md`.

## How validation was performed
Cross-checked product/variant counts against live `productsCount`, excluded blank SKUs and same-product SKU reuse, spot-checked 3 SKUs against the prior report. See `validation/2026-07-01_ledsone-de-full-duplicate-sku-report.md`.

## What evidence exists
`evidence/`, `validation/`, `closure/`, `docs/`, `reports/` entries all dated 2026-07-01 with this task name.

## What still remains
- Human decision on which duplicate/weaker listings to merge, redirect, or archive — this task only identifies duplicates, it does not act on them.
- Cleanup of the stale (non-`_v2`) docx file once unlocked from Word.

## Who should review
Store owner / catalog manager (person who requested this report).

## Is it safe to reuse
Yes — this is a read-only analysis; no products, variants, or prices were modified. The report itself is a static snapshot dated 2026-07-01 and should be re-generated (not hand-edited) if the catalog changes materially.

## Parent-AIOS candidate assessment
**Candidate:** Yes
- **Candidate Title:** Store-wide Full Duplicate SKU Detection (bulk export + all-listing grouping)
- **Problem Solved:** Reliably finds every duplicate SKU across an entire Shopify catalog and lists ALL sharing listings (not just a pair), with sales data attached, using a bulk GraphQL export instead of slow page-by-page product calls.
- **Reuse Potential:** High — same method applies unchanged to the other AIOS-managed stores (ledsone-us, vintagelite, dcvoltage) and to future re-runs of ledsone.de.
- **Evidence Path:** `evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md`
- **Reviewer Required:** Yes — store owner should confirm this is worth turning into a repeatable Parent-AIOS tool before promotion.

Not promoted automatically per instruction — flagged for reviewer decision only.
