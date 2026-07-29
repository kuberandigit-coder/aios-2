# Vercel Notes — salesuk.html: Not Assigned Order Assignment UI

**Title:** Assign-from-UI — deployment
**Purpose:** Record the deploy path and the required env var.

## Required env var (user action, pending)
`GITHUB_ASSIGN_TOKEN` — a GitHub Personal Access Token with write (contents) access to `digitalmarketing69140951-sys/Staff-requirements`. Add on the `digital-marketing-member-pages` Vercel project (Settings → Environment Variables), all environments. Optional overrides also supported: `GITHUB_ASSIGN_REPO` (defaults to the repo above), `GITHUB_ASSIGN_BRANCH` (defaults to `main`).

## Function count check
Added a 5th serverless function (`api/assign-order.js`, `maxDuration: 30`) to `vercel.json` — still well under Vercel's Hobby 12-function limit (previously: `sales.js`, `requirement.js`, `salesuk.js`, `sales25.js`).

## Deploy path
1. Built `api/assign-order.js`, `api/data/order-overrides.json`, overrides-check changes to `salesuk.js`/`sales25.js`, and the assign UI in `salesuk.html`.
2. Synced all to `staff-sync28`, committed, rebased onto `staff/main`, pushed — auto-deployed.
3. Live-verified via curl that `salesuk.html` now serves the `assignColHeader` element (confirms the new UI deployed).
4. Synced to the primary `aios-2` repo.

## Status
Deployed and live. Functionally inert until `GITHUB_ASSIGN_TOKEN` is added — the endpoint fails gracefully with a clear config-missing error in that state, never silently.
