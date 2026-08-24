## Purpose
Close out the refund-reason-category misclassification fix on `pages/shopify-uk-refunds.html`.

## Summary
Kuberan gave 4 real refund orders with their correct categories, contradicting the live keyword classifier. Root cause: overly generic keywords (`'wrong item'`, `'colour'`) catching customer-side language, and missing damage-on-arrival phrasing (`scratch`/`scuff`) for a genuine Warehouse case. Fixed the keyword lists directly, verified against all 4 examples, deployed to production.

## Evidence
See `evidence/muguntha/2026-08-21_refund-category-misclassification-fix.md`

## Validation
See `validation/muguntha/2026-08-21_refund-category-misclassification-fix.md`

## Status
PASS — deployed to production, verified live.

## Reviewer
Kuberan

## Next step
None outstanding from this task. (A later session caught that the "scratch/scuff broadening" fix had also introduced two unrequested keywords — `arrived damaged`/`arrived broken` — see `2026-08-24_refund-category-override-map-and-scope-revert.md`.)
