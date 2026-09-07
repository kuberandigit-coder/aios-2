# Closure — DE 2025 Sales extended through December (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Done, pushed to `dev-work`

## Request
"the 2025 sales data of de is only available until june... need until
july to dec also in the same method... need to do one person by person
and need to balance with the shopify sales."

## What was delivered
- Extended Mahima's DE 2025 ads attribution rules (`MAHIMA_ADS_RULES_25`)
  from June-only to cover July–December, using the same recurring
  medium/term combos already confirmed for Mar–Jun, plus 2 newly
  confirmed combos (`cpc/{searchterm}`, `cpc/bestselling`) and one user-
  confirmed exception (`shoptimised/sep_25` → Mahima instead of Not
  Assigned).
- Fixed a separate frontend bug: DE 2025's 4 month dropdowns (Mahima,
  Sukirtha, Jeffri, Not Assigned) were hardcoded to only show Jan–Jun
  regardless of backend support — this was the actual visible symptom.

## Files
- `backend/app/sales.py`
- `frontend/src/admin/pages/Sales2025.jsx`

See `evidence/2026-09-07_dm-dashboard-de2025-balance-check.md` for the
verification numbers.
