# Closure — Meta UK Tab + Order Overlap Discovery

**Date:** 2026-07-27

## Summary
Built a Meta UK tab for previously-unclaimed Facebook/Instagram/Pinterest orders, and along the way discovered the main dashboard's per-staff tabs can double-count the same order (SEO product-scope vs ad-click attribution). This finding led directly to the new standalone `salesuk.html` page (separate closure doc).

## Linked files
- Evidence: `evidence/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`
- Validation: `validation/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`
- Commit: `6153245` (plus a follow-up `firstSessionSplit` diff to `api/sales.js` committed same day under `/update-aios`)

## Status: PASS — Meta UK tab live; overlap issue documented and acted upon (see salesuk.html closure)
**Reviewer:** Not recorded.
**Next step:** Meta UK tab snapshot backfill (Jan-Jun); user decision on whether to reconcile/redefine Kamsi/Dilaksi vs. Ads-tab overlap on the main dashboard itself.
