# Validation — Kamsi Requirement 6: Duplicate Listing & Price Check

**Title:** Validation checklist for the full-catalog duplicate SKU / price mismatch audit
**Purpose:** Confirm all logic and functionality checks pass before deployment approval
**Requirement Source:** GPT planning layer instruction, 2026-07-08
**Business Question:** Across the full Shopify product catalog, which SKUs appear on more than one product listing URL, and do those duplicated listings have price differences?
**PostgreSQL Sources Checked:** Not used
**External Sources Checked:** None

| Check | Result |
|---|---|
| Existing assets checked | PASS — no prior Req6/duplicate-SKU/price-mismatch report found anywhere in AIOS |
| Duplicate risk documented | PASS — GREEN, no prior report of this kind |
| Shopify connector used read-only | PASS — `bulkOperationRunQuery` only, no mutation calls |
| Full Shopify catalog included | PASS — 5,179 products, 22,721 raw JSONL records |
| All variants included | PASS — 17,542 variant/listing rows (one row per variant per listing URL) |
| Blank SKUs excluded from duplicate logic | PASS — 109 blank-SKU rows forced to Duplicate?=No, Price Mismatch?=No, counted separately |
| SKU grouping is correct | PASS — 17,433 non-blank rows grouped into 14,264 unique SKUs |
| Duplicate? condition applied correctly | PASS — spot-checked 3+ examples (2, 3, 5-listing cases) |
| Price Mismatch? condition applied correctly | PASS — spot-checked same-price (No) and different-price (Yes) duplicate examples |
| Same SKU across 2, 3, or more listings handled | PASS — confirmed via `LDMG80E274` (5 listings) example |
| Matching listing URLs populated | PASS — sorted, deduped, verified in samples |
| Current price is Shopify variant price | PASS — taken directly from `variants.price`, no invention |
| Compare price displayed but not used for mismatch condition | PASS — shown as-is or "-" if null; mismatch logic only ever reads Current Price |
| Search works | PASS — functional simulation, "CRFF108YB" search returned 14 rows |
| Filters work | PASS — Duplicate?=Yes → 5,571 rows (exact KPI match); Price Mismatch?=Yes → 1,430 unique SKUs (exact KPI match); Status=DRAFT → 602 rows (exact match) |
| Sorting works | PASS — functional simulation confirmed ascending sort by Product Title |
| CSV export works | PASS — functional simulation confirmed export runs without error, all 12 columns present |
| AIOS files saved | PASS — prompts/evidence/validation/handover/vercel all created |
| No deployment performed | **PASS — genuinely not deployed this time** (confirmed no `vercel deploy` command run) |

## Additional verification
- Div balance: 189 open / 189 close
- `node --check` syntax validation on the full ~17.6 MB combined script: passed, exit 0
- Zero id collisions confirmed (`q6`, `dupsel6`, `mismatchsel6`, `statussel6`, `tbody6`, `pageInfo6`, `prevPage6`, `nextPage6` each appear exactly once)
- Quantified the multi-variant-same-SKU edge case: 34 SKU+URL combinations, all spot-checked as genuine same-price colour/style variants (no false price mismatches introduced)

**Validation result:** PASS — all checks pass, including the "no deployment" requirement this time.
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Built and validated locally — awaiting deployment approval
**Known Limitations:** see evidence file (3 items: snapshot staleness, 34-case multi-variant-same-SKU quantified, Compare Price display-only)
**Next Steps:** Kuberan review and deployment approval
**PASS / FAIL:** PASS
