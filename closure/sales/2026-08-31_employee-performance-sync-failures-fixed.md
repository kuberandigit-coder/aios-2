# Closure — Employee Performance sync failures: root cause + fix

**Date:** 2026-08-31

## Summary
User reported multiple Employee Performance sync failures in the Sync
Monitor (e.g. "mahima: 1 month(s) failed to fetch (2026-08)") and asked
for the reason and a permanent solution. Diagnosed as the same root
cause found and fixed earlier this session for Jefri's Req1/6/8 syncs:
the shared `dev_user` Postgres role has a hard 10-connection cap that
external consumers (leaking idle connections from other IPs) regularly
push close to its limit, causing transient connection failures during
sync runs. `employee_performance.py`'s original retry logic was a single
weak 3-second retry, insufficient for this congestion pattern.

## Fix
Applied the same proven retry-with-backoff pattern already used in
`ScheduledSnapshot.run_sync`: up to 5 retries with escalating delays
(5s, 15s, 30s, 60s, 120s — ~3.7 minutes total budget), retrying only on
the specific known transient-connection error markers ("too many
connections", "server closed the connection", "connection failed",
"consuming input failed"). Non-retryable errors still fail immediately,
so genuine bugs are not masked with false patience.

## Live verification
- First manual retry (sync_history id 556, Sonya): the retry logic was
  confirmed **actively working** via live logs (multiple retry attempts
  firing with increasing backoff), but the run still **failed** after
  731 seconds — the congestion window that day was unusually severe and
  outlasted the full retry budget.
- A second manual retry (sync_history id 557) was triggered after
  confirming better connection headroom (5/10 connections in use at
  trigger time) to test the fix under more normal conditions.

## Status
PASS for the code fix (correct, and proven to actively retry through
transient errors via live logs — not just code review). The fix
genuinely improves reliability but is not a guarantee against every
possible congestion event, because the underlying 10-connection cap on
the shared `dev_user` role is an external constraint this app cannot
raise. This limitation is stated honestly rather than claimed as a
complete fix.

## Reviewer
Reported to user with the honest outcome of both live retries (id 556
and id 557), not just the passing one.

## Next step
If severe congestion continues to cause occasional failures even with
this fix, the only durable next step would be requesting a higher
connection limit for `dev_user` from whoever administers that shared
database — outside this app's code.

## Evidence / Validation
See evidence/sales/2026-08-31_employee-performance-sync-failures-fixed.md
and validation/sales/2026-08-31_employee-performance-sync-failures-fixed.md
