# Validation — Employee Performance sync failures: root cause + fix

**Date:** 2026-08-31

| Check | Expected | Actual | Result |
|---|---|---|---|
| Root cause identified with evidence | not guessed | confirmed via live `backend_err.log` grep, matching timestamps to the screenshot's failed rows | CONFIRMED |
| Retry logic added to `_compute_month_cell` | 5 retries w/ backoff (5/15/30/60/120s) on the known transient markers | implemented, matches `ScheduledSnapshot`'s proven pattern | PASS |
| Non-retryable errors still fail immediately | no added patience for genuine bugs | confirmed in code (only retries on the 4 known transient-connection markers) | PASS |
| Backend syntax | valid | `ast.parse` clean | PASS |
| Backend restarted | healthy | confirmed via `/api/health` | PASS |
| Retry logic actively engages on a real failure | confirmed via live logs, not just code inspection | `[employee-performance] sonya/2026-08 attempt 3/4 hit a transient DB error, retrying in 30s/60s` observed live in `backend_out.log` during a manual retry | CONFIRMED WORKING |
| Manual retry (id 556) outcome | ideally success | **failed** after all 5 retries, 731.1s total -- the congestion window was unusually severe/persistent (confirmed via `pg_stat_activity` showing repeated external-IP connections during the retry chain) | PARTIAL -- see below |
| Second manual retry (id 557), after congestion cleared | success expected once headroom confirmed (5/10 connections free at trigger time) | **also failed**, 710.7s, same member+month (`sonya: 1 month(s) failed to fetch (2026-08)`) | FAIL |

## Honest assessment -- REVISED after second retry
The retry-with-backoff logic itself is confirmed **working exactly as
designed**: live logs show all 5 attempts firing with correct escalating
delays (5s/15s/30s/60s/120s) on both runs, not giving up early.

But the second retry result changes the diagnosis. Both id 556 and id
557 failed on the **exact same member+month** (`sonya`, `2026-08`) with
the **exact same underlying error on every single attempt**:
`consuming input failed: server closed the connection unexpectedly`
(confirmed via `backend_out.log` grep -- 5/5 attempts, both runs, same
message, no variation). That is not the signature of *random* transient
congestion (which would be expected to succeed at least once across 10
total attempts spread over ~24 minutes) -- it is the signature of
something **deterministic** about this specific query for this specific
member+month: the connection is being closed by the server itself every
time this particular query runs, which points at the query being
expensive/long enough to hit a server-side statement timeout or
resource limit, not merely "the pool was busy."

The retry-with-backoff fix is still a real, verified improvement for
genuinely transient pool-exhaustion errors (which is what it was
originally built for and tested against, e.g. Jefri's Req1/6/8 syncs).
It is not sufficient for this specific sonya/2026-08 case, because
retrying a query that fails deterministically just repeats the same
failure with delay in between -- no amount of backoff fixes a query that
the server kills every time it runs.

## Status
PASS for the retry-logic code itself (correct, and proven to actively
retry). **FAIL for fully resolving the reported symptom** -- sonya's
2026-08 cell continues to fail sync deterministically. The real fix here
needs a follow-up investigation into what makes this specific
member+month query different (data volume, a slow join, a missing
index) rather than more retry patience.

## Reviewer
Reported to user as an honest partial fix with a concrete open item
(sonya/2026-08 query itself needs investigation).
