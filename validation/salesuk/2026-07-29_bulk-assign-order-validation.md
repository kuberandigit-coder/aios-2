# Validation — salesuk.html: Bulk Assign in Not Assigned Tab

**Title:** Bulk assign validation

## Checks performed
1. `node --check` on `api/assign-order.js` — syntax valid.
2. `salesuk.html`'s embedded `<script>` parsed via `new Function()` — valid.
3. Live end-to-end test: bulk-assigned 2 real orders in one request — confirmed `assignedCount:2` in the response and both entries present together in a single GitHub commit (`e7d64d5`), then reverted (`6192d3a`).
4. Confirmed the single-order assign path (built earlier) still works unchanged — `assign-order.js`'s bulk handling falls back to a 1-item array when the old single-order shape (`orderId` at top level) is sent, so no regression.
5. Confirmed selection state resets on tab/month switch (`SELECTED_ORDER_IDS.clear()` in `selectMonth`/`selectGroup`) so a selection made on one month's Not Assigned list can never be silently applied to a different month.

## Result
**PASS** — bulk assign works end-to-end, backward-compatible with the single-order flow, and the "Tab: <label>" chip directly shows which month/year a bulk action applies to.
