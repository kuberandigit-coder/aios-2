# Vercel Notes — salesuk.html: 2025 January Backfill

**Title:** Jan 2025 backfill — deployment
**Purpose:** Record the deploy path, including the new-serverless-function check.

## Function count check (important given past Hobby-plan limit incident)
Before adding `api/sales25.js`, confirmed only 3 existing top-level files under `api/`: `sales.js`, `requirement.js`, `salesuk.js`. Adding a 4th (`sales25.js`) stays well under Vercel's Hobby-plan 12-function cap (previous incident: `24b3960` had to remove 4 obsolete files to get back under that limit). Added `api/sales25.js` to `vercel.json`'s `functions` block with `maxDuration: 300`, matching the other three.

## Deploy path
1. Built `api/sales25.js` + `vercel.json` change in `kuberan web`, synced to `staff-sync28`, pushed to `staff/main` — auto-deployed.
2. Live-tested the new endpoint (`?group=remaining&month=2025-01`) immediately — confirmed working before running the full bulk backfill.
3. Ran `scripts/bulk-sales25-refresh.js 2025-01` locally (hits the live production endpoint via curl, writes snapshot JSON files locally) — all 11 groups succeeded.
4. Wired `salesuk.html`'s new "Jan 2025" tab + `apiEndpointFor()` routing, synced both the HTML and the 11 new snapshot files to `staff-sync28`, pushed, verified live via curl (`Jan 2025` tab text present).
5. Synced everything to the primary `aios-2` repo.

## Status
Live in production. No manual `vercel --prod` needed — git-linked auto-deploy handled both pushes.
