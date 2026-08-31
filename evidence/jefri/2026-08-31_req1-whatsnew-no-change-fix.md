# Evidence — Sync Monitor "What's New" always showing "No change"

**Date:** 2026-08-31
**Purpose:** User pointed out that after a successful Jefri Req1 sync, the
Sync Monitor's Orders/Net Sales columns showed "—" and "What's New" said
"No change" even though the underlying data had actually changed, and
asked for an analysis.

## Root cause
`ScheduledSnapshot.run_sync()` (the generic scheduler used by Jefri
Req1/Req6/Req8, in `backend/app/scheduled_snapshot.py`) never wrote
`orders_count`/`net_sales` into `sales_cache.sync_history` on success --
only the older `_run_all_tabs_once` flow (used by Sales / Employee
Performance) populated those columns. The "What's New" diff logic in
`sales.py` (`GET /api/sales/sync/history`) compares each successful run's
`orders_count`/`net_sales` against the previous successful run's -- with
both always `NULL` for every ScheduledSnapshot-based sync, the diff was
always `0 - 0 = 0`, so it always read "No change" regardless of whether
the actual snapshot payload had genuinely changed.

## Fix
`backend/app/scheduled_snapshot.py`:
- Added an optional `metrics_fn(payload) -> (count, amount)` to
  `ScheduledSnapshot`. When supplied, it's called right after a
  successful `compute_fn()` + `write()`, and the result is written into
  `sync_history.orders_count`/`net_sales` (wrapped so a broken
  `metrics_fn` can never fail an otherwise-successful sync).

`backend/app/jefri.py` -- wired a `metrics_fn` for each scheduled page,
picking the most meaningful available pair for that page's own data shape
(none of Req1/Req6 are literal order feeds, so these are deliberately the
closest useful stand-in, not literal orders):
- **Req1** (product/ad-tag listing, not orders): `(totalProducts,
  totalConvValue)` from the payload's own `summary`.
- **Req6** (tracked-listing sales tracker): `(len(rows),
  sum(totalSalesSinceUpdate))`.
- **Req8** (a real order feed): `(count, sum of non-cancelled
  orderValueExclShipping)` -- these ARE literal orders_count/net_sales.

`backend/app/sales.py`'s `GET /api/sales/sync/history` -- added a small
`metric_labels` map so the diff text says "product"/"conv. value" or
"tracked listing"/"sales" for Req1/Req6 instead of literally "orders"/
"net sales", which would have been misleading now that real numbers are
flowing through those columns.

## Verification
Restarted backend, triggered a manual Req1 sync
(`POST /api/jefri/req1/sync/run-now`), then confirmed via direct SQL and
the API:
```
sync_history id 521: status=success, orders_count=2508, net_sales=29977.68
GET /api/sales/sync/history -> whatsNew: "+2508 products, +€29977.68 conv. value"
```
(The prior two runs, 519/520, still show `null`/"No change" -- expected,
since they ran before this fix existed and have no metrics to diff
against; going forward every run will carry real numbers.)

## Reviewer
Pending user confirmation in the Sync Monitor UI -- Orders/Net Sales
columns and "What's New" should now show real, changing values for Jefri
Req1 (and Req6/Req8) going forward.
