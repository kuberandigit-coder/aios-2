# Handover — salesuk.html: Bulk Assign in Not Assigned Tab

**Title:** Bulk assign
**Status:** PASS — live and verified in production (2026-07-29)
**Reviewer:** Not recorded.

## What's new
The Not Assigned tab now has checkboxes per row + a "select all" header checkbox, plus a bulk action bar showing the live selection count, which month/year tab you're on ("Tab: <label>"), a "Belongs to" dropdown, and an Assign Selected button. Select multiple orders, pick one destination, click once — all of them get committed to `order-overrides.json` in a single GitHub commit.

## How to use it
1. Go to the Not Assigned tab for whichever month/year you're reviewing.
2. Tick the orders that belong to the same person.
3. Pick that person from "Belongs to".
4. Click "Assign Selected".
5. Same limitation as the single-order assign: for already-generated historical months, the assignment saves immediately but won't visibly move until the affected month's snapshot is regenerated (I'll do that after a batch of assignments).

## Files touched
- `reports/digital-marketing-member-pages/api/assign-order.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`

## Next steps
None outstanding for this feature itself. Same standing next step as the single-assign build: after the user does a round of real assignments, regenerate the affected month's snapshots via the bulk-refresh scripts.
