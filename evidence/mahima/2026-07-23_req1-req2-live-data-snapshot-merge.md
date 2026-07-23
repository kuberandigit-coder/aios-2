# Evidence — Mahima Req1/Req2 Live Data + Snapshot Script Merge

**Date:** 2026-07-23
**Commit:** `2ef10d0`

## Purpose
Finish interrupted Mahima work: Req1 (Product Performance) backend was already wired to a Refresh button but had no static snapshot file, so every cold start hit a slow live query. Req2 (Stock Management) had no live endpoint at all.

## Changes

### Req1 — snapshot added
- Generated `api/data/mahima-req1-snapshot.json` so cold starts serve the snapshot instead of running the full query.

### Req2 — new live endpoint
- Added a live `mahima-req2` endpoint in `api/requirement.js`, sourced from paginated Shopify GraphQL (catalog + 30-day orders) instead of the original async bulk export.
- Wired a matching Refresh button, live status chip, and KPI card update in `pages/mahima.html`.
- Generated `api/data/mahima-req2-snapshot.json`.

### Snapshot script consolidation
- Merged three near-duplicate snapshot-generation scripts (`generate-snapshots.js`, `generate-july-snapshots.js`, `generate-jefri-snapshots.js`) into a single `generate-snapshots.js` with `postgres`/`july`/`<staff>` modes.
- Added Mahima Req1/Req2 to the hourly Postgres refresh list.
- Removed the now-superseded `.github/workflows/jackshan_daily.yml`.

## Verification (per commit message)
Deployed to Vercel prod and verified both endpoints serve live data and fall back to the static snapshot in under 2 seconds.

## Raw diff
See `git show 2ef10d0` (10 files changed, 659 insertions / 262 deletions).
