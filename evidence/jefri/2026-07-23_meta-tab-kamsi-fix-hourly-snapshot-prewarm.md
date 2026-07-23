# Evidence — Jeffri Meta Tab, Kamsi Req6 Live Fix, Hourly July Snapshot Pre-warm

**Date:** 2026-07-23
**Commits:** `aa8673b` (feat), `f662096` (fix/revert)

## Purpose
Three bundled changes: give Jeffri a Meta (Facebook/Instagram) sales sub-tab alongside his existing Google Ads tab, fix Kamsi's Req6 summary cards which were static/dead text instead of updating on Refresh, and pre-warm all 15 live July sales tabs hourly so cold-start loads don't take 30-50s.

## Changes

### `reports/digital-marketing-member-pages/pages/sales.html`
- Added a Meta Ads sub-tab for Jeffri (Jan–June backfilled from static snapshots, July live), mirroring the existing Google Ads tab pattern.

### `reports/digital-marketing-member-pages/pages/kamsi.html`
- Fixed Req6 summary cards so they actually re-render from fetched data on Refresh, instead of showing static placeholder text.
- Added Kamsi's 10 new product IDs to the product allocation CSV (both the source CSV under `Kamsi/data/` and the deployed copy under `api/data/`).

### `reports/digital-marketing-member-pages/api/sales.js`
- Wired the `jeffri-meta` staff branch (Jan–June static snapshot, July live fetch) alongside the existing `jeffri-ads` branch.
- Fixed a Sukirtha Organic / Jeffri Ads double-count bug for January (3 orders, €174.30 counted in both).

### Hourly snapshot pre-warm (new)
- Added `.github/workflows/hourly-july-snapshot-refresh.yml` — a GitHub Actions cron that regenerates the 15 live-July `api/data/*-sales-2026-07.json` snapshot files every hour via `api/scripts/generate-july-snapshots.js`.
- Manual Refresh clicks are unaffected — they still hit Shopify live on demand; this only pre-warms the fallback snapshot so cold starts return in ~2s instead of 30-50s.

### Reverted same day (`f662096`)
- The workflow was added to the wrong repo (`aios-2`) — this project's actual deployed source lives in the separate `Staff-requirements` repo, not `aios-2`. The workflow file was removed here; the equivalent was set up in the correct repo instead (not tracked in this repo).

## Raw diff
See `git show aa8673b` and `git show f662096` for full diffs (29 files changed in the first commit, mostly regenerated snapshot JSON; 1 file removed in the revert).
