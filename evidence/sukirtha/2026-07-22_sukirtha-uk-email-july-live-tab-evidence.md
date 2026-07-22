# Evidence — Sukirtha UK Email Tab: July (Live)

**Date:** 2026-07-22
**Commit:** `41ce912`

## Root cause
The UK Email sales tab's backend (`api/sales.js` post-consolidation) had `SUPPORTED_MONTHS` capped at June, and `resolveReportMonth` had no live/month-to-date branch — it always queried a full closed calendar month. This was missed both at original build time and during the same-day 15-file API consolidation (`456feb2`), which preserved existing behavior rather than adding new scope.

## Fix implemented
- Added `CURRENT_LIVE_MONTHS` constant (same pattern as other tabs already on live months).
- Added month-to-date date capping so July's query window stops at "today" rather than end-of-month.
- Added an `isLive` flag surfaced to the client.
- Added a July tab button and manual Refresh button to the Sukirtha UK Email UI, mirroring the Refresh-button pattern used on Kamsi/Dilaksi July tabs (07-17 commits).

## Files changed
- Backend: `api/sales.js` (per commit message; single consolidated API file post-`456feb2`)
- Frontend: Sukirtha UK Email tab markup/JS (July tab + Refresh button)

## Status
Evidence limited to the commit message and stated diff; no independent live query re-run was performed as part of this same-day AIOS recovery pass. See validation file for what was and wasn't checked.
