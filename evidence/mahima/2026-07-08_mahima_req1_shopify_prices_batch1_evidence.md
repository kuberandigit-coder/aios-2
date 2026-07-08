# Evidence — Mahima Requirement 1: Real Shopify Prices for the `shopify_`-prefixed Product IDs (Batch 1 of 3)

**Title:** Fetched real Shopify variant prices directly from Shopify (ledsone.de store) for the 1,291 product rows whose ID format encodes a direct Shopify variant ID, replacing the ambiguous Merchant Center price where present
**Purpose:** User requested real Shopify prices for all product IDs, to be done in batches by ID format; this is batch 1 (`shopify_de_<productId>_<variantId>` format)
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What was done
- Identified 3 distinct ID formats across the 6,781 rows: 1,291 `shopify_de_<productId>_<variantId>` (direct Shopify variant IDs), 5,470 plain numeric (Google Merchant Center product IDs/GTINs), 20 `xxxx-ide` style (internal SKU codes)
- For the 1,291 `shopify_`-prefixed rows: extracted the trailing variant ID, queried Shopify Admin GraphQL directly (`nodes(ids: [...]) { ... on ProductVariant { id price } }`) in 9 batches of ~150 IDs, confirmed connected to the correct store (`ledsone.de`, currency EUR)
- Retrieved real prices for **1,288 of 1,291** (2 variants genuinely have no price set in Shopify, 1 unaccounted — both left as Data Missing, not guessed)
- These real Shopify prices **replace** the previous Merchant Center-derived price for these rows (Shopify's own price is the single authoritative source — no feed-segment ambiguity, unlike Merchant Center)
- Total Product Price coverage: **2,935 of 6,781 rows (43.3%)**, up from 1,652 (24.4%) before this batch

## Verification performed
- Div balance: 38 open / 38 close
- `node --check` syntax validation: passed, exit 0
- Confirmed exactly 1,288 rows had their price updated, and all 1,288 were previously "Data Missing" (none overwritten a value that didn't need it, confirmed via before/after diff in the merge script)
- Cross-checked `get-shop-info` confirmed correct store connection (`ledsone.de`) before querying

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/mahima/data/2026-07-08_mahima_shopify_variant_ids.json` — the 1,291 distinct variant IDs to fetch
- `reports/mahima/data/2026-07-08_mahima_shopify_variant_price_map.json` — variant ID → real Shopify price map
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_raw.json` — updated with real prices merged in
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_builder.py` — no logic change needed, just re-run against updated raw data

## Next batches (not yet done)
1. **5,470 numeric-ID rows**: these are Google Merchant Center product IDs/GTINs, not Shopify IDs directly — will need a barcode/GTIN search against Shopify (`productVariants(query: "barcode:...")`) instead of a direct ID lookup
2. **20 `xxxx-ide`-style rows**: appear to be internal SKU codes — will need a SKU match against Shopify

**Duplicate risk:** GREEN
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Batch 1 of 3 complete, built and validated locally — still not deployed
**Known Limitations:** 2 of 1,291 variants have no price in Shopify itself (not a fetch failure); remaining 5,490 rows still pending batches 2 and 3
**Next Steps:** Kuberan review; proceed to batch 2 (numeric/GTIN rows) next
**PASS / FAIL:** PASS
