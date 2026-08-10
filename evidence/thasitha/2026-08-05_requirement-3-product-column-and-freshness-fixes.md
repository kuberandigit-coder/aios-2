# Evidence — Thasitha Req3 (SKU Overlap & CPC Inflation): Table Rebuild + Data-Freshness Fixes (2026-08-05)

**Purpose:** Record of `thasitha.html` Req3 changes made 2026-08-05, continuing iterative refinement of the SKU Overlap & CPC Inflation tab (built 2026-07-15).

## 1. Table rebuilt with 6 lean columns (`74884b2`)
Simplified the Req3 table to 6 core columns, replacing an earlier wider layout, per ongoing user feedback on readability.

## 2. Date range fix (`61760bf`)
Date range end was stuck on a stale hardcoded date instead of tracking the live current date — fixed.

## 3. `last_active` zero-activity fix (`f07df02`)
`last_active` logic was ignoring zero-activity placeholder rows (products with no spend), causing them to be miscategorized in the overlap check.

## 4. Overlap detection basis change (`bb80218`)
Overlap now checks live merchant-feed membership, not just spend recency — a product no longer in the merchant feed is correctly excluded from "currently overlapping" even if it had recent spend.

## Files touched
- `reports/digital-marketing-member-pages/pages/thasitha.html`

## Deployment
Deployed to production and spot-verified live, consistent with this project's deploy-then-verify workflow.

**Status:** PASS
**Reviewer:** Thasitha (pending review)
**Next step:** Product column formatting (SKU vs Google Ads item ID) continued to be iterated on 2026-08-05 into 2026-08-07 — see later commits for final state.
