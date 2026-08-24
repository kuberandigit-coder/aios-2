## Purpose
Fix two issues on the Refund Reason Category popup: (1) revert an unrequested keyword change made during the 2026-08-21 fix, (2) apply Kuberan's manually-reviewed category assignments (from two source files — an xlsx and a csv, 107 order IDs total) as authoritative overrides.

## Business Question
Kuberan flagged: "last time i input but you changed some others also why" — an unrequested change needed to be found and reverted, and the exact order-level category corrections from his review sheets needed to be applied without touching the general keyword system.

## Investigation
Diffed the 2026-08-21 commit (`1b03b20`) and found `'arrived damaged'`/`'arrived broken'` had been added to the Warehouse keyword list — not needed for any of the 3 originally-requested examples (LED55484/56013/55698), added on the assistant's own judgment as a "similar case" generalization. This was scope creep beyond what was asked.

Separately, Kuberan supplied `shopify-uk-refunds-last-60-days (5) h.xlsx` (12 rows) and `shopify-uk-refunds-last-60-days (3)g.csv` (96 unique rows) with manually-assigned categories. Comparing these against the live classifier found the source data itself contains internal contradictions (e.g. "damaged item" language tagged Warehouse in one row, Postage in another; colour-preference complaints tagged both Customer and Postage across different rows) — not usable to retrain the keyword rules without breaking already-confirmed-correct cases. Flagged this to Kuberan; his instruction was to apply the sheet's categories as **per-order overrides**, not as new keyword rules.

## Fix
- `pages/shopify-uk-refunds.html`: removed `'arrived damaged'`, `'arrived broken'` from the Warehouse keyword list (kept the requested `'scratch'`/`'scuff'` broadening).
- Added `CAT_OVERRIDES` — a map of 107 order names to their Kuberan-assigned category, checked first in `categorizeReason(reason, orderName)` before falling back to the keyword rules. Applied consistently to the filter dropdown, the table's Category column, and the percentage popup.

## Files Modified
- `pages/shopify-uk-refunds.html`

## Status
PASS — deployed to production, live-verified (`grep -c "CAT_OVERRIDES"` on the deployed page).

## Reviewer
Kuberan
