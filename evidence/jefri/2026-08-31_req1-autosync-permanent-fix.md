# Evidence — Jefri Req1 auto-sync: permanent resilience fix

**Date:** 2026-08-31
**Purpose:** User reported Jefri Req1's auto-sync failing (Sync Monitor
showed two consecutive "Failed" runs, 0.2s duration, no orders/net sales)
and asked for a permanent fix.

## Root cause
Confirmed via `backend/backend_err.log` and a live `pg_stat_activity`
check against the business database:
```
psycopg.OperationalError: consuming input failed: server closed the connection unexpectedly
error connecting in 'pool-2': ... FATAL: too many connections for role "dev_user"
```
This is the same known, previously-diagnosed limitation: the shared
`BUSINESS_DATABASE_URL` role (`dev_user`) has a hard server-side
10-connection limit that this app cannot raise (`ALTER ROLE` needs
`CREATEROLE` + admin option this role doesn't have). Other consumers of
that same role -- an external IP and an AWS accounting job seen in
`pg_stat_activity` -- occasionally fill the budget right at the scheduled
9:00 AM run, and the sync failed instantly (0.2s) with no retry, meaning
the snapshot then stayed stale until the *next* scheduled run (up to 2
days away) unless someone manually clicked "Run Now" again.

## Fix (as durable as possible without DB-admin access)
`backend/app/scheduled_snapshot.py`:
- `ScheduledSnapshot.run_sync()` now retries automatically on the specific
  transient-connection error markers ("too many connections", "server
  closed the connection", "connection failed", "consuming input failed"),
  with backoff: 15s, 30s, 60s, 120s, 240s (5 retries, ~7 minutes total)
  before giving up and recording a real failure. A successful retry logs
  as a normal "success" row (with a "(succeeded on retry N)" note in the
  server log) -- the Sync Monitor UI just sees it succeed.
- Wrapped the whole run in `try/finally` so the "currently running" lock
  always releases even if the final failure-logging write itself throws
  (previously a crash there could have left the sync permanently stuck
  "running").

`backend/app/db.py`:
- `_business_pool`'s `min_size` reduced from 2 to 1 -- frees one more
  slot of headroom in the shared 10-connection budget (this pool is
  rarely fully idle anyway, so the extra warm connection wasn't buying
  much).

## Verification
- Manually triggered `POST /api/jefri/req1/sync/run-now` after the fix and
  restart -- succeeded in 16.3s (`sales_cache.sync_history` id 520,
  status `success`), confirming the connection budget had recovered and
  the pipeline is healthy end to end.
- Confirmed the live snapshot now serves fresh data:
  `GET /api/jefri/req1` returns 2,508 products.
- Prior failed runs (ids 516, 519) remain visible in history as an honest
  record of the earlier outage window -- not deleted or hidden.

## What this does NOT fix
The underlying 10-connection cap on `dev_user` is still not something this
app can raise -- that remains a genuine external constraint. This change
makes the scheduled sync self-heal from *transient* spikes against that
cap (the actual failure mode observed), which is the practical ceiling of
"permanent fix" achievable from the application side.

## Reviewer
Pending user confirmation -- Sync Monitor should show the pipeline back
to "Idle"/success after the next scheduled or manual run.
