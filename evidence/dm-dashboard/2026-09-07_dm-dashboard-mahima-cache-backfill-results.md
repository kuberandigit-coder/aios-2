# Evidence — Mahima 2026 August cache backfill results

**Date:** 2026-09-07
**Project:** dm-dashboard

## Background check (before fixing)
Live query results confirming July/Aug/Sep 2026 had real data (contrary
to the "showing 0" report — root cause was an uncached month, not
missing data):

| Month | Organic orders | Organic net sales | Notes |
|---|---|---|---|
| 2026-07 | 84 | €2,295.26 | cached |
| 2026-08 | (blank on first check — `{"status": "computing"}`) | | not yet cached |
| 2026-09 | 8 (partial month) | €85.52 | live, current month |

## Backfill run (task b75tbozp1, exit code 0)

| Tab | Month | Result |
|---|---|---|
| Organic | 2026-01→07 | Already cached |
| Organic | 2026-08 | Synced in 35.3s |
| Ads | 2026-01→07 | Already cached |
| Ads | 2026-08 | Synced in 32.7s |
| Total | 2026-01→07 | Already cached |
| Total | 2026-08 | Synced in 31.5s |

Confirms only August was the actual gap; now fixed and verified by
direct Postgres cache read after backfill.
