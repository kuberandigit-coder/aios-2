# Evidence — Hourly Auto-Refresh Workflow + IndexedDB Rollout (All 14 Sales Tabs)

**Date:** 2026-07-24
**Commit:** `17dc616`

## Purpose
Fix "stuck from yesterday" sales snapshots (no job was actually regenerating them) and extend the IndexedDB persistence pattern proven on Kamsi/Dilaksi/Sukirtha/Jefri/Mahima to all remaining member tabs on `sales.html`.

## What Was Done
1. Added `.github/workflows/hourly-sales-snapshot-refresh.yml`: runs every hour, regenerates all 14 live-July `sales.html` snapshots plus the 4 Postgres-backed Jefri/Mahima snapshots (`node api/scripts/generate-snapshots.js july / postgres`, calling the deployed site's own API with `?refresh=1`), commits the updated `api/data/*.json` files, and redeploys to Vercel prod. Required `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` repo secrets (documented in the workflow file itself) as the one manual setup step.
2. `pages/sales.html`: added the same IndexedDB persistence pattern to all 14 member tabs (Mahima Organic+Ads, Jefri, Kamsi, Dilaksi, Sukirtha UK/DE/Email, and others).

## Files Changed
- `.github/workflows/hourly-sales-snapshot-refresh.yml` (added, then see Notes)
- `reports/digital-marketing-member-pages/pages/sales.html`

## Notes — workflow file status as of this sync (2026-07-24, later same day)
`git status` at the start of this AIOS sync shows `.github/workflows/hourly-sales-snapshot-refresh.yml` as **deleted, uncommitted**. This is the same category of issue documented in yesterday's log for commit `f662096` ("removed hourly snapshot workflow — added to wrong repo, `aios-2` instead of `Staff-requirements`"). No commit message explains today's deletion (it happened after the last commit, before this sync ran). Flagged in the daily log as **manual verification required** — do not assume it was intentionally abandoned or that it needs to be restored; ask the user.

Separately, `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js` has an uncommitted change adding `jefri-req3` and `mahima-search-terms` to the `POSTGRES_ENDPOINTS` list used by this same workflow's `postgres` mode — consistent with keeping the hourly job in sync with the day's new Jefri Req3 tab, but also uncommitted.

The IndexedDB-rollout half of this commit (14-tab persistence in `sales.html`) is unaffected by the workflow-file deletion and remains committed/live.

## Status
Partial — IndexedDB rollout: committed and live. Hourly workflow: committed same day, then deleted from the working tree (uncommitted) as of this sync; disposition unresolved.

## PASS/FAIL
PASS (reconstructed) for the IndexedDB rollout. UNRESOLVED for the workflow file — see Notes.

## Next Step
Ask user whether to restore, re-target (different repo), or leave the workflow file deleted; decide whether to commit `generate-snapshots.js`'s Postgres-endpoint additions.
