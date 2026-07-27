# Capability — Meta UK Tab + Cross-Tab Order Overlap Discovery Method

**Date:** 2026-07-27
**Owner:** Kuberan
**Staff/Requirement:** Meta UK (new tab), discovery affects Kamsi/Dilaksi/Sajeepan/Sonya/DM
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (Meta UK tab live); overlap issue documented, not yet resolved on the main dashboard

## Capability
Detect whether multiple staff dashboard tabs are silently double-counting the same underlying orders, by directly comparing order-name sets across each tab's raw JSON — not just eyeballing summary totals.

## What Was Implemented
Added a Meta UK tab (Social-channel orders not claimed by any existing Ads tab). While investigating it, ran a direct order-name intersection across 6 UK tabs' January data and found 48% of orders appear in 2+ tabs.

## Technical Knowledge
- Two tabs can each have a "correct" total sales number individually, yet still double-count real orders when their underlying definitions aren't mutually exclusive (product-scope vs. traffic-source-scope). Summary-level totals alone cannot catch this — only an order-ID-level set comparison across the raw data can.
- Reusable check: for any set of dashboard tabs claiming to report on "the same store," pull each tab's `all*Orders` array, build a `Map<orderName, [tabsThatMatched]>`, and flag any entry with more than one tab.

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js` (Meta UK handler, `socialAudit`/`paidSearchGapAudit`/`firstSessionSplit` on `ukTotalDebugHandler`)
- `reports/digital-marketing-member-pages/pages/sales.html`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), existing per-tab JSON snapshots in `api/data/`.

## Validation
Live-verified Meta UK tab; overlap finding independently reproduced via direct file comparison (not just a one-off claim).

## Reuse
Run the same order-name-set comparison before trusting any "combined total across tabs" figure on this dashboard — the answer directly motivated a whole new page (`salesuk.html`).

## Evidence
`evidence/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`

## Limitations
Meta UK tab has no static snapshot yet (live-fetch only, slow cold load). The overlap problem itself is not fixed on the main dashboard — only worked around via the new standalone page.
