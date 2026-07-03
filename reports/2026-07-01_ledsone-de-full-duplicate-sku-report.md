# Report Index — Full Duplicate SKU Report (ledsone-de)

**Date:** 2026-07-01
**Status:** PASS

## What this is
Index entry pointing to the delivered duplicate-SKU report. The actual report content lives in the `.docx` file below — this index exists so `reports/` is queryable without opening the binary file.

## Report file
`duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report_v2.docx`

## What the report contains
One row per duplicate listing, grouped by SKU (1,079 groups, 2,347 listing rows total). Columns: #, SKU, Rank (Primary/Duplicate N), Product Title, Handle, Status, Price, All-time Sales (EUR), All-time Orders. Listings within a group are ranked by all-time sales; the top seller is "Primary". Price mismatches vs. the Primary are flagged `(!)`.

## How the report works
1. All 2,507 products / 9,994 variants pulled via a Shopify Admin bulk GraphQL export.
2. Variants grouped by SKU; groups where the SKU spans more than one product are "duplicates" (1,079 found).
3. All-time sales/orders per product pulled via ShopifyQL and merged in.
4. Rendered to docx with python-docx, landscape orientation, fixed column widths.

## Known limitations
- Sales figures are **all-time gross sales** (ShopifyQL `gross_sales`, `SINCE 2015-01-01`), not net of returns/discounts.
- A SKU shared only within one product's own variants (not across products) is intentionally excluded — that's normal Shopify usage, not a duplicate-listing risk.
- Blank SKUs (13 variants) are excluded — they can't be matched as duplicates.
- Report is a point-in-time snapshot (2026-07-01); re-run the bulk export to refresh.
- Max group size observed was 4 duplicate listings for one SKU; the docx layout assumes this is uncommon and does not virtualize/paginate further if a future SKU has many more duplicates.

## Future maintenance notes
- To refresh: re-run the same bulk GraphQL query + ShopifyQL sales query described in `evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md`, re-run the grouping script, regenerate the docx.
- If this becomes a recurring need, consider automating steps 1–4 into a script saved under a `scripts/` folder rather than re-deriving ad hoc each time.

## Full detail
See `evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md` and `validation/2026-07-01_ledsone-de-full-duplicate-sku-report.md`.
