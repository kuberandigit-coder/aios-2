## Purpose
Validate the refund-category scope revert and override map.

## Checks performed
1. Confirmed `'arrived damaged'`/`'arrived broken'` no longer present in `CAT_RULES` after the fix (`grep`).
2. Built the 107-entry override map from both source files programmatically (not by hand-typing), cross-checked for conflicts between the xlsx and csv for the same order ID — 0 conflicts found across 107 unique IDs.
3. `node -e "new Function(...)"` syntax check on all script blocks — no errors.
4. Live-verified all 3 call sites of `categorizeReason()` (filter, table cell, percentage popup) pass `r.orderName` so the override applies everywhere consistently.

## Result
PASS.

## Reviewer
Kuberan
