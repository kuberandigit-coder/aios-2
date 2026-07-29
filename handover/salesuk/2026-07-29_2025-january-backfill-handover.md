# Handover — salesuk.html: 2025 January Backfill

**Title:** Jan 2025 backfill
**Status:** PASS — live and verified in production (2026-07-29)
**Reviewer:** Not recorded.

## What changed
`salesuk.html` now has a "Jan 2025" month tab alongside the existing 2026 months. It routes to a **new, separate backend file** `api/sales25.js` (per explicit user instruction — not an extension of `salesuk.js`), which reuses the exact same 11-group, mutually-exclusive, priority-ordered classification rules already confirmed for 2026 — nothing was re-derived or guessed for 2025.

## Results
1,735 total orders for January 2025 across 11 groups, £44,828.83 net sales. 231 orders (13%) landed in Not Assigned — expected, since several 2026-era campaigns (CPPC, Thishoban, Theekshy, Thanishtika) didn't exist yet in 2025. A genuinely new campaign name not seen in any 2026 data ("Klarna_ALL_P_SAJEE", 35 orders) surfaced correctly in Not Assigned rather than being force-matched.

## Where
- Backend: `api/sales25.js` (new file), `scripts/bulk-sales25-refresh.js` (new file), `vercel.json` (added function entry).
- Frontend: `pages/salesuk.html` — new month tab + `apiEndpointFor()` routing.
- Data: `api/data/sales25-*-2025-01.json` (11 files).
- Deployed via push to `staff/main` (Vercel auto-deploy), synced to `aios-2`.

## Next steps
- Not Assigned for Jan 2025 (231 orders, £7,306.05) needs the same manual ownership-assignment review the 2026 months went through, when the user is ready.
- Extending further into 2025 (Feb onward, or the full year) is a separate future task — only January was in scope this time.
