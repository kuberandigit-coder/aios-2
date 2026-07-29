# Vercel Notes — salesuk.html: Bulk Assign in Not Assigned Tab

**Title:** Bulk assign — deployment
**Purpose:** Record the deploy + live test path.

## Deploy path
1. Extended `api/assign-order.js` to accept a bulk `orders: [...]` array, built the checkbox/bulk-bar UI in `salesuk.html`.
2. Synced to `staff-sync28`, committed, rebased onto `staff/main`, pushed — auto-deployed.
3. Live-verified via curl that `salesuk.html` serves the new `bulkAssignBar` element.
4. Ran a real end-to-end test: bulk-assigned 2 real orders via direct API call, confirmed the single-commit behavior in the GitHub repo, then reverted immediately (this was a mechanism test, not a real ownership call for those two orders).
5. Synced to the primary `aios-2` repo.

## Status
Live and confirmed working end-to-end (GITHUB_ASSIGN_TOKEN already configured from the earlier single-assign build).
