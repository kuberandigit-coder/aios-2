# Capability — Hourly Snapshot Auto-Refresh Workflow (GitHub Actions)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** All 14 sales-dashboard member tabs + Jefri/Mahima Postgres tabs
**Store/Project:** digital-marketing-member-pages (Vercel) / GitHub Actions
**Status:** Partial — built and committed same day, then found deleted (uncommitted) from the working tree by the time of this AIOS sync; disposition unresolved

## Capability
A scheduled job that regenerates all live-month sales snapshots and the Postgres-backed Jefri/Mahima snapshots every hour, then redeploys to Vercel production automatically, without a human needing to run `generate-snapshots.js` manually or remember to redeploy.

## What Was Implemented
`.github/workflows/hourly-sales-snapshot-refresh.yml`: cron-triggered hourly, runs `node api/scripts/generate-snapshots.js july` and `... postgres` (which call the deployed site's own API endpoints with `?refresh=1` — no separate Shopify/Postgres credentials needed in the workflow itself), commits the updated `api/data/*.json` files, and redeploys to Vercel prod.

## Technical Knowledge
- The snapshot-generation scripts are designed to call the *deployed* site's own API (not local credentials), which is what makes them safe to run from a CI runner with only `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` as secrets — the actual Shopify/Postgres auth stays server-side on Vercel.
- A near-identical workflow was added and then removed the previous day (2026-07-23, commit `f662096`) because it had been added to the wrong repo (`aios-2` instead of `Staff-requirements`). Today's version was again removed from the working tree (uncommitted) before this sync ran, with no commit message explaining why — this may be a repeat of the same wrong-repo issue, or something else entirely. **Not confirmed either way.**

## Important Rules / Logic
- Any snapshot-refresh CI workflow that regenerates and commits data files must live in the repo whose deployment it's supposed to keep in sync with — verify the target repo before adding, given this has gone wrong twice now.

## Files / Components
- `.github/workflows/hourly-sales-snapshot-refresh.yml` (status: not present in working tree as of 2026-07-24 sync time — see Limitations)
- `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js` (has an uncommitted addition of `jefri-req3`/`mahima-search-terms` Postgres targets as of this sync)

## Data Sources / Tools
GitHub Actions, Vercel CLI/API, the deployed site's own `/api/*?refresh=1` endpoints.

## Validation
Not independently re-verified — the workflow's own commit (`17dc616`) states its design but there is no evidence in this sync that it ever executed successfully before being removed from the working tree.

## Reuse
The `?refresh=1`-based, no-separate-credentials CI pattern is reusable for any other scheduled snapshot job, provided the wrong-repo mistake from 2026-07-23/24 is avoided.

## Evidence
`evidence/sales/2026-07-24_hourly-workflow-and-indexeddb-rollout.md`

## Limitations
As of this sync, the workflow file does not exist in the working tree — this capability is **not currently active**. Manual verification required before relying on it.
