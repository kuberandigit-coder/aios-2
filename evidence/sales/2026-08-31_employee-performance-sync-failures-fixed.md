# Evidence — Employee Performance sync failures: root cause + permanent fix

**Date:** 2026-08-31
**Purpose:** User asked why several Employee Performance sync runs were
failing (screenshot: mahima, dilaksi, kamsi, sajeepan, sonya all showing
"Error: <member>: 1 month(s) failed to fetch (2026-08) -- not caching a
partial table"), and asked for the root cause + a permanent fix.

## Root cause
Confirmed via `backend/backend_err.log`, the exact same underlying issue
diagnosed and fixed earlier this session for Jefri's Req1/Req6/Req8
syncs: the shared `BUSINESS_DATABASE_URL` role (`dev_user`) has a hard
10-connection server-side limit this app can't raise, and other
consumers of that same role occasionally fill it right as a sync runs:

```
error connecting in 'pool-2': connection failed: connection to server at
"169.58.91.229", port 5432 failed: FATAL: too many connections for role "dev_user"
```

**Why this sync specifically kept failing while Jefri's had already been
fixed**: Employee Performance uses an older, separate sync path
(`backend/app/employee_performance.py`'s `_compute_month_cell`, orchestrated
by `sales.py`'s `_run_one_sync` / hourly loop) that never received the
retry-with-backoff treatment applied to Jefri's `ScheduledSnapshot` class.
It only had a single retry, 3 seconds later -- nowhere near enough for
connection-limit congestion that (confirmed live in the error log) was
still present many seconds to minutes later. One failed month (almost
always the current live month, `2026-08`, which is the one month
re-fetched live on every cycle instead of served from cache) aborted the
*entire* member's table build, even though the other 19 months were
already cached fine -- by design (`_build_employee_table` deliberately
refuses to cache a partial table so a transient blip can never silently
corrupt the cached data with a false zero for that month).

The one outlier -- `sajeepan: 1 month(s) failed to fetch (2026-06)` at
731.3s -- is the same root cause hitting a different month during an
especially bad congestion window (duration confirms multiple stalls).

The `28/08 09:54:58 -- interrupted (server restarted mid-sync)` row is
unrelated: simply this session's own backend restarts during earlier
feature work landing mid-sync, not a code bug.

## Permanent fix
`backend/app/employee_performance.py`'s `_compute_month_cell` now uses
the same proven retry pattern as Jefri's `ScheduledSnapshot`:
- Detects the specific transient markers ("too many connections", "server
  closed the connection", "connection failed", "consuming input failed").
- Retries up to 5 times with backoff: 5s, 15s, 30s, 60s, 120s (~3.7
  minutes total) before giving up and surfacing a real failure.
- Non-retryable errors (a genuine bug, bad data, etc.) still fail
  immediately as before -- this only adds patience for the one failure
  mode actually observed.

## Verification
- Confirmed root cause via live log grep (dozens of matching
  "too many connections for role dev_user" entries at the exact failure
  timestamps shown in the screenshot).
- Confirmed the fix is syntactically valid and the backend restarted
  clean.
- Manually triggered a retry for Sonya (`POST /api/sales/sync/run-tab?staff=sonya&tab=employee-performance`,
  the same "↺ Retry" action the Sync Monitor UI's button uses) after the
  fix was deployed -- result recorded in the follow-up validation note.

## What this does NOT fix
The underlying 10-connection cap on `dev_user` itself is still not
something this app can raise without database-admin access -- a genuine
external constraint, same as documented for Jefri's syncs. This makes
Employee Performance self-heal from transient spikes against that cap
instead of losing an entire member's sync cycle to one bad moment.

## Reviewer
Pending user confirmation -- next scheduled Employee Performance cycle
should show far fewer (ideally zero) of these failures.
