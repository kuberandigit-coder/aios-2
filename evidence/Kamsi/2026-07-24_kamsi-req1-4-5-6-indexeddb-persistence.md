# Evidence — Kamsi Req1/4/5/6 Live Data Persistence (IndexedDB)

**Date:** 2026-07-24
**Commits:** `6669fee` (sessionStorage, superseded), `11fc7cc` (IndexedDB, final)

## Purpose
Reported bug: clicking Refresh on Req6, navigating to another member and back to Kamsi, showed the old static snapshot again instead of the live result just fetched. Root cause: fetched rows/summary only lived in a JS variable, reset on every full page reload.

## What Was Done
- First pass (`6669fee`) added `sessionStorage` persistence (`kamsi_r{1,4,5,6}_live` keys) — restores on load with a "fetched Xm ago (restored)" chip.
- Same day, replaced with IndexedDB (`11fc7cc`) after recognizing this shares the exact failure mode Sukirtha's Req2/3/4 already hit: these payloads (thousands of rows, multiple MB of JSON) can exceed sessionStorage/localStorage quota, throwing a silently-swallowed `QuotaExceededError`. Ported the same `idbOpen/idbGet/idbSet` ('kv' object store) pattern already proven on `sukirtha.html`. Also fixed a scoping bug: these helpers are now declared at top level so both the Req1/5/6 script block and the separate Req4 script block share one definition instead of duplicating it.

## Files Changed
- `reports/digital-marketing-member-pages/pages/kamsi.html`

## Status
Deployed/committed same day. IndexedDB version is the final shipped state; sessionStorage version was fully superseded within the same session.

## PASS/FAIL
PASS (reconstructed).

## Next Step
None.
