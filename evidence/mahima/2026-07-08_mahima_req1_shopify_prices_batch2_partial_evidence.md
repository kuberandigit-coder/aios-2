# Evidence — Mahima Requirement 1: Real Shopify Prices for Numeric IDs (Batch 2, Partial)

**Title:** Fetched real Shopify prices for the numeric-format product IDs — 8 of 15 chunks complete
**Purpose:** Continue user's request to get real Shopify prices for all product IDs, batch 2 (numeric IDs, discovered to be a mix of Shopify Product and Variant IDs)
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What was discovered
- The 2,131 distinct numeric IDs are **not one consistent ID type**: some (mostly the lowest/oldest ID range) are Shopify **Product** IDs, most others are Shopify **Variant** IDs. Confirmed empirically: chunk 0 (IDs 10020225876233–36046380597415) resolved only as Products; chunks 1–7 (IDs 36046380695719–48457228779785) resolved only as Variants.
- Adapted the fetch accordingly per chunk rather than assuming one ID type for all 2,131.

## What was done
- Fetched real Shopify prices for **8 of 15 chunks (~1,178 of 2,131 distinct numeric IDs)**, applied to the dataset
- Product Price coverage: **4,788 of 6,781 rows (70.6%)**, up from 2,935 (43.3%) after batch 1

## Verification performed
- Div balance: 38 open / 38 close
- `node --check` syntax validation: passed, exit 0
- Confirmed 3,233 rows updated, 1,853 of those newly filled from Data Missing

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/mahima/data/2026-07-08_mahima_numeric_ids.json` — 2,131 distinct numeric IDs to fetch
- `reports/mahima/data/2026-07-08_mahima_numeric_price_map_batch1.json` — 1,178 IDs resolved so far
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_raw.json` — updated with prices merged in

## Remaining work
7 of 15 chunks (~950 numeric IDs) still pending — will need the same Product-or-Variant lookup approach per ID.

**Duplicate risk:** GREEN
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Batch 2 partial (8/15 chunks), built and validated locally — still not deployed
**Known Limitations:** ~1,993 rows still without a real price (remaining numeric-ID chunks + the 20 SKU-code rows, batch 3, not yet attempted)
**Next Steps:** Kuberan review; continue remaining numeric chunks, then batch 3 (SKU-code rows)
**PASS / FAIL:** PASS
