## Purpose
Update `MAHIMA_EXCLUDED_PRODUCT_IDS` with Kuberan's latest full product-ID list for Mahima.

## Business Question
Kuberan supplied a 678-ID list ("this is the mahima latest update") and asked to add anything missing and remove anything in the old list not present in the new one.

## Method
Diffed the supplied list programmatically against the current 660-entry `MAHIMA_EXCLUDED_PRODUCT_IDS` constant (defined identically in `api/sales.js` and `api/salesde25.js`). Result: 18 IDs to add, 0 to remove (every previously-listed ID is still present in the new list). Confirmed with Kuberan before editing (AskUserQuestion), since this list drives Mahima's DE sales attribution across multiple report tabs AND Sukirtha's organic-sales exclusion.

## Fix
Added the 18 new IDs to both files (kept in sync, as they always must be — duplicated constants, not a shared import).

## Files Modified
- `api/sales.js`, `api/salesde25.js`

## Status
PASS — both files verified at 678 unique IDs post-edit, `node -c` syntax clean, deployed to production.

## Reviewer
Kuberan
