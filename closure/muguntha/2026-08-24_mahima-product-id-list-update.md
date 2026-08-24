## Purpose
Close out the Mahima product-ID list update.

## Summary
Updated `MAHIMA_EXCLUDED_PRODUCT_IDS` (660 → 678 IDs) in both `api/sales.js` and `api/salesde25.js`, based on Kuberan's supplied latest list. Diffed programmatically; 18 additions, 0 removals.

## Evidence / Validation
See corresponding files in `evidence/muguntha/` and `validation/muguntha/`.

## Status
PASS — deployed to production.

## Reviewer
Kuberan

## Next step
None outstanding. This list also fed directly into building Mahima's new Performance tab the same day.
