# Validation — Muguntha Dashboard: Kamsi/Dilaksi/Jefri Tabs + Performance & Cost Fixes (2026-08-05)

| Check | Result |
|---|---|
| Kamsi tab renders with £0 ad cost, 2025+2026 snapshots present | PASS |
| Dilaksi tab renders with £0 ad cost, 2025 snapshots backfilled (`sales25-dilaksi`) | PASS |
| Jefri tab: `/api/muguntha?member=jefri` cost reflects full 61-campaign "Jefri" group, not 5 hardcoded IDs | PASS (post `e2fb798` fix) |
| Jefri Sales figure includes tax+shipping (per explicit request, differs from UK convention) | PASS — confirmed against `2025DE.html`/muguntha wiring |
| `muguntha.html` Sales column for Sonya/Sajeepan/Kamsi matches `salesuk.html` Net Sales figure for same member/month | PASS |
| Page load network requests for default view reduced (lazy-load, no more eager 120-request load) | PASS |
| `loadAll()` concurrent fetch cap (5 per group) confirmed in source | PASS |
| `api/muguntha.js` DM cost query no longer times out (sargable date-range filter) | PASS |
| "Refresh (live)" only re-fetches current live month, not all 20 | PASS |
| `sales25-kamsi` 2025-02..12 snapshots present after backfill | PASS |
| Kamsi/Dilaksi cost breakdown shows no DM 46 line item | PASS |
| All incremental production deploys returned READY | PASS |

**Status:** PASS
