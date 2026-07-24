# Capability — IndexedDB Live-Data Persistence Pattern

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Kamsi (Req1/4/5/6), Dilaksi (Req2), Jefri (Req1/Req2), Mahima (Req1/Req2/Req3) — rolled out dashboard-wide to all 14 `sales.html` tabs
**Store/Project:** digital-marketing-member-pages (Vercel)
**Status:** Completed

## Capability
Any live-fetched dataset (Shopify GraphQL or Postgres-backed) on a member requirement page can survive a full page reload/navigation-away-and-back without refetching or falling back to a stale hardcoded/static snapshot.

## What Was Implemented
A shared client-side IndexedDB cache pattern (`idbOpen/idbGet/idbSet`, single `'kv'` object store per page, e.g. `kamsi_cache_db`, `dilaksi_cache_db`, `jefri_cache_db`, `mahima_cache_db`) that:
- Persists fetched rows/summary on a successful Refresh.
- Restores automatically on page load, showing a "(restored)"/"[restored]" chip.
- On Jefri specifically, compares the restored payload's `generatedAt` against any background freshness-check response so a stale hourly-snapshot fallback never silently overwrites a more recent restored result; a forced manual Refresh always wins regardless.
- Avoids a loading-spinner flash on restored data (guard: reset the loading/error UI only when `force` is true or nothing is already showing).

## Technical Knowledge
- sessionStorage/localStorage were tried first (Kamsi, same day) and abandoned — payloads of thousands of rows / multiple MB of JSON can silently exceed browser storage quota, throwing a `QuotaExceededError` that a naive `try/catch` swallows with no visible failure. IndexedDB has no such practical ceiling at this data size.
- The pattern originated on `sukirtha.html` (pre-existing, proven) and was ported without modification to each subsequent page — reuse over reinvention.
- `idbOpen/idbGet/idbSet` must be declared at top level (not inside a per-tab IIFE) when multiple script blocks on the same page need the shared cache (e.g. Kamsi Req1/5/6 block + separate Req4 block).

## Important Rules / Logic
- A forced Refresh (`?refresh=1` equivalent) always overwrites the cache, regardless of any timestamp comparison.
- Background/automatic freshness checks must never regress a more recently restored value — compare `generatedAt`/fetch timestamps before applying.
- Loading/error UI resets are conditional: only show them on a manual force-refresh or when there is genuinely nothing to display yet.

## Files / Components
- `reports/digital-marketing-member-pages/pages/kamsi.html`
- `reports/digital-marketing-member-pages/pages/dilaksi.html`
- `reports/digital-marketing-member-pages/pages/jefri.html`
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/digital-marketing-member-pages/pages/sales.html` (all 14 member tabs)
- `reports/digital-marketing-member-pages/pages/sukirtha.html` (original reference implementation, pre-dates today)

## Data Sources / Tools
Browser IndexedDB API (no external library). Backing data: Shopify Admin GraphQL (Kamsi/Dilaksi) and Postgres (Jefri/Mahima) via `api/requirement.js`.

## Validation
Reconstructed from commit messages/diffs across `6669fee`, `11fc7cc`, `845ff94`, `74be376`, `6fc1ebf`, `a1ee81d`, `17dc616` — not independently re-tested live in this sync.

## Reuse
This is now the standard pattern for any new live-fetch tab on this dashboard — apply directly rather than re-deriving sessionStorage/localStorage first.

## Evidence
- `evidence/Kamsi/2026-07-24_kamsi-req1-4-5-6-indexeddb-persistence.md`
- `evidence/dilaksi/2026-07-24_req2-indexeddb-persistence.md`
- `evidence/jefri/2026-07-24_req1-req2-indexeddb-persistence.md`
- `evidence/mahima/2026-07-24_req1-req3-indexeddb-persistence.md`
- `evidence/mahima/2026-07-24_req2-stock-management-indexeddb-persistence.md`
- `evidence/sales/2026-07-24_hourly-workflow-and-indexeddb-rollout.md`

## Limitations
IndexedDB is per-browser/per-device — does not sync a "restored" view across different machines or browsers for the same staff member. Not a substitute for the server-side snapshot/cache layer, which still exists independently.
