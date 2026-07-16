# Validation — Thasitha Requirement 3: External-overlap-only filter

**Date:** 2026-07-16

## Checks performed
- Confirmed via Node script: after the fix, `R3_DATA.filter(o => o.camps.some(c => !c.isThasi))` yields exactly 231 rows (down from 327), matching the manual count of 96 SKUs with zero external campaigns.
- Confirmed 0 SKUs anywhere in `R3_DATA` reference a non-ENABLED campaign (live-verified against `google_ads.campaigns` for all 9 distinct campaign IDs in the dataset).
- Confirmed the KPI card (`r3kpiTotal`) is computed from `rows.length` post-filter dynamically — no hardcoded number to fix there.
- Fixed 2 hardcoded prose references ("328 overlapping SKUs", "All 327 overlapping SKUs") in the status-note to the correct 231.
- Both `<script>` blocks re-validated via Node `Function()` parse — no syntax errors introduced.

## Result: PASS
