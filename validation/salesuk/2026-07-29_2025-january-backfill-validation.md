# Validation — salesuk.html: 2025 January Backfill

**Title:** Jan 2025 backfill validation
**Purpose:** Confirm no orders are missed/double-counted and the page is live.

## Checks performed
1. `node --check` on `api/sales25.js` and `scripts/bulk-sales25-refresh.js` — syntax valid.
2. `salesuk.html`'s embedded `<script>` block parsed via `new Function()` — valid, no syntax errors introduced.
3. Live endpoint tested before bulk generation: `GET /api/sales25?group=remaining&month=2025-01` — returned real data (`success:true`, 231 unassigned orders) confirming the new file deployed and works.
4. Bulk snapshot generation run for all 11 groups — all 11 succeeded (`0 failed`), each writing a `sales25-<group>-2025-01.json` file.
5. Zero-double-counting check: since groups are checked in a strict priority order and Not Assigned is defined as "does not match any group" (the exact complement, same mechanism as salesuk.js), every order lands in exactly one tab by construction — verified the totals sum correctly: 698+3+260+90+5+448+0+0+0+0+231 = 1,735 total orders, matching the group-by-group fetch log.
6. Confirmed live via curl that `salesuk.html` now serves the "Jan 2025" tab button and routes to `/api/sales25` (checked `apiEndpointFor()` logic).
7. Confirmed only 4 total serverless functions in `vercel.json`/`api/` — nowhere near Vercel's Hobby 12-function limit, so adding `sales25.js` did not risk breaking the deployment.

## Result
**PASS** — Jan 2025 backfilled with zero orders missed (Not Assigned catches every non-matching order by construction), new/unrecognized 2025-era campaigns correctly surfaced in Not Assigned rather than force-fit into an existing group, live and verified in production.
