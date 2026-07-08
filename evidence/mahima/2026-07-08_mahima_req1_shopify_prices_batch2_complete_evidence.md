# Evidence — Mahima Requirement 1: Real Shopify Prices for Numeric IDs (Batch 2, Complete)

**Title:** Completed fetching real Shopify prices for all numeric-format product IDs (all 15 chunks)
**Purpose:** Continue user's request to get real Shopify prices for all product IDs — batch 2 (numeric IDs)
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What was done
- Completed all 15 chunks of the 2,131 distinct numeric IDs (previously 8/15 done)
- Confirmed the mixed-ID-type finding held across the whole set: most of the newest chunks (highest ID ranges, and a set of much older/short IDs) resolved as Shopify **Products**; the middle ID range resolved as Shopify **Variants** (already covered in the first 8 chunks)
- Product Price coverage: **5,355 of 6,781 rows (78.9%)**, up from 4,788 (70.6%) after the partial batch, and from the original 1,652 (24.4%)

## Verification performed
- Div balance: 38 open / 38 close
- `node --check` syntax validation: passed, exit 0
- Confirmed 807 rows updated in this final round, 567 newly filled from Data Missing

## Remaining gap
~1,426 rows (21.1%) still without a real price:
- A subset of numeric IDs returned null even as Products — these are very likely Shopify Variant IDs that weren't covered by the earlier variant-lookup chunks (an ID-range boundary was assumed; some numeric IDs on the edges may be misclassified). Would need a second pass re-trying these specific nulls as Variants.
- The 20 SKU-code-format rows (batch 3) — not yet attempted, would need a SKU-based product search instead of direct ID lookup.

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/mahima/data/2026-07-08_mahima_numeric_price_map_batch2.json` — remaining ~312 numeric IDs resolved
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_raw.json` — updated with prices merged in

**Duplicate risk:** GREEN
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Batch 2 complete, built and validated locally — still not deployed
**Known Limitations:** ~1,426 rows still without a real price (mixed-type edge cases + batch 3 SKU rows not yet attempted)
**Next Steps:** Kuberan review; optionally retry remaining nulls as Variant IDs, then batch 3 (SKU-code rows)
**PASS / FAIL:** PASS
