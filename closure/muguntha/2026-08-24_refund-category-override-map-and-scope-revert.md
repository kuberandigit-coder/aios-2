## Purpose
Close out the refund-category scope revert and per-order override map.

## Summary
Found and reverted an unrequested keyword addition from the 2026-08-21 fix. Applied Kuberan's 107 manually-reviewed order-category assignments as an explicit override map, after determining the source sheets themselves weren't internally consistent enough to safely retrain the general keyword rules.

## Evidence / Validation
See corresponding files in `evidence/muguntha/` and `validation/muguntha/`.

## Status
PASS — deployed to production.

## Reviewer
Kuberan

## Next step
None outstanding.
