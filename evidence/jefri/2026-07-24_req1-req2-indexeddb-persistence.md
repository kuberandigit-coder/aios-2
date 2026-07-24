# Evidence — Jefri Req1/Req2 Live Data Persistence (IndexedDB) + Restore Flash Fix

**Date:** 2026-07-24
**Commits:** `74be376`, `a1ee81d`

## Purpose
Jefri's Postgres-backed Req1/Req2 tabs had no client-side persistence. Req1/Req2 already auto-fetch on load, but an unforced load could be served from the server's hourly static-snapshot fallback, which may be older than the user's own last manual Refresh — silently regressing the displayed data.

## What Was Done
1. (`74be376`) Added `idbOpen/idbGet/idbSet` (`jefri_cache_db`). Req1/Req2 now restore their last live result on page load/tab switch, and compare `generatedAt` timestamps so a stale snapshot-fallback fetch never overwrites a more recent restored result — a forced Refresh always wins regardless of timestamp.
2. (`a1ee81d`) Fixed a follow-on bug: reopening `jefri.html` briefly showed the correct restored numbers, then immediately flashed back to a "Loading live data from PostgreSQL..." placeholder, because `load()`/`r2Load()` unconditionally reset the chip/table to a loading state on every call — including the automatic background freshness check that fires right after a successful restore. Guarded both the loading-placeholder reset and the error-path reset behind `force || no data already showing`. A manual Refresh (or a page with nothing restored yet) still shows loading/error as before; a background check on top of already-restored data now fetches silently and only updates the view if it returns something no older than what's already shown.

## Files Changed
- `reports/digital-marketing-member-pages/pages/jefri.html`

Note: `74be376` also touched `pages/mahima.html` in the same commit (Mahima Req1/Req3 IndexedDB) — documented separately in `evidence/mahima/2026-07-24_req1-req3-indexeddb-persistence.md` to keep per-person records distinct; same commit hash covers both.

## Status
Deployed/committed same day.

## PASS/FAIL
PASS (reconstructed).

## Next Step
None.
