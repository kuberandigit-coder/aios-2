## Purpose
Close out the DM-46 display exclusion for Sonya/Sajeepan, Jan-Jun 2025.

## Summary
After a multi-turn design discussion (partly in Tanglish) about why Organic/Ads always shows one column zero, Kuberan decided the DM 46 campaign's contribution should be fully invisible for Jan-Jun 2025 on the Performance tab specifically. First fix targeted the wrong code path (a server-side batch endpoint the frontend never actually calls); corrected by finding and fixing the real client-side data flow (`fetchGroupSales`/`fetchCost`/`openCostPopup`).

## Evidence / Validation
See corresponding files in `evidence/muguntha/` and `validation/muguntha/`.

## Status
PASS — deployed to production, user asked to hard-refresh and confirm.

## Reviewer
Kuberan

## Next step
None outstanding; user to confirm visually after hard refresh if not already done.
