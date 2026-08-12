# Evidence — Hourly Snapshot Cron Stuck on a Closed Month for 11 Days (2026-08-11)

**Purpose:** Record of a data-freshness bug affecting the hourly snapshot-refresh cron across ~13 staff dashboards.

## Root cause
`api/scripts/generate-snapshots.js` (run hourly by the GitHub Action `hourly-july-snapshot-refresh.yml`) had hardcoded month constants — `JULY_MONTH`, `SALESUK_LIVE_MONTH`, `CURRENT_LIVE_MONTHS` — all pinned to `'2026-07'`. When August became the actual live month, these constants were never updated, while `api/sales.js` itself had already correctly moved to treating August as live. Net effect: for 11 days, the hourly cron kept re-refreshing an already-closed month (July) that no longer needed refreshing, while the real live month (August) never got its scheduled snapshot refresh at all — every August tab load fell back to slow live Shopify/Postgres queries instead of a fast static-snapshot read.

Separately: `api/sales.js`'s jeffri-meta handler had a closed-month early-return (`if (staff === 'jeffri-meta' && !monthConfig.isLive)`) that did not check `forceRefresh`. Since jeffri-meta was never "live" for July specifically, there was no possible code path — not even a manual forced refresh — that could ever backfill a snapshot for that month.

## Fix (`486f7b5`)
- Bumped `JULY_MONTH` and `SALESUK_LIVE_MONTH` from `'2026-07'` to `'2026-08'`.
- Added `'2026-08'` to `SUPPORTED_MONTHS`, replaced `'2026-07'` with `'2026-08'` in `CURRENT_LIVE_MONTHS`.
- Added `&& !forceRefresh` to the jeffri-meta closed-month gate in `api/sales.js`, so a forced refresh can now bypass it.
- Added a new `runJeffriMetaBackfill(monthArgs)` function and a `jeffri-meta-backfill` CLI mode (defaults to `['2026-07']`) to `generate-snapshots.js`, giving jeffri-meta a way to backfill the July snapshot it was never able to get before this fix.

## Files touched
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js`

## Deployment
Code fix deployed to production same day.

**Confirmed NOT run:** checked `api/data/jeffri-meta-sales-2026-07.json` directly — it is a placeholder file dated 2026-08-04 (before this fix even existed), `cacheStatus: "not-available"`, `"note": "This month has not been backfilled yet."`, all zero values. The backfill script mode was added but never executed. This is a real, confirmed open item, not just unconfirmed documentation.

**Status:** PARTIAL PASS (code fix confirmed deployed; backfill confirmed NOT run as of 2026-08-12)
**Reviewer:** Muguntha (pending review)
**Next step:** Run `node api/scripts/generate-snapshots.js jeffri-meta-backfill 2026-07` and confirm the resulting snapshot file in `api/data/` has real data (non-zero `combinedSummary`, `cacheStatus` other than `not-available`).
