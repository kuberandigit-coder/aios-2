# Validation — Thasitha Requirement 2: Show 0.00/€0.00 instead of N/A

**Date:** 2026-07-16
**Reviewer:** AIOS (self-checked before deploy)

## Checks performed

- Confirmed `eur()` helper (`&euro;'+Number(v).toLocaleString(...,{minimumFractionDigits:2,maximumFractionDigits:2})`) correctly formats `0` as `€0.00`, so passing `0` explicitly instead of `null` is safe.
- Verified only the R2 (`renderR2()`) row template was touched — R1 and R3 N/A displays untouched (per standing rule).
- Verified this is purely a display change — the underlying `ctr`/`avgCpc`/`convRate`/`roas` calc logic (division-by-zero guards) was NOT altered, only how a `null` result renders in the table cell.

## Result: PASS

## Next step
None — cosmetic display fix confirmed logically correct; optional live visual spot-check.
