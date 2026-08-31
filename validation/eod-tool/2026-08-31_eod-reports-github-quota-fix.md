# Validation — EOD Reports GitHub quota + row-cap fixes

**Date:** 2026-08-31

| Check | Expected | Actual | Result |
|---|---|---|---|
| Root cause identified with evidence | not guessed | confirmed via live browser repro + raw GitHub headers | CONFIRMED |
| Real quota state | 0/5000 remaining at time of bug | confirmed via `X-RateLimit-Remaining: 0` | CONFIRMED |
| Per-(member,date) content cache added | past days never re-fetched needlessly | implemented, 6h TTL | PASS |
| Today's file excluded from long cache | always fetched live | implemented (`report_date != today` check) | PASS |
| Writes invalidate specific date | not just whole-member cache | all 4 write endpoints updated | PASS |
| Global concurrency cap | no more 190+ simultaneous GitHub calls | `threading.Semaphore(8)` wraps every call | PASS |
| Retry on rate-limit response | short safety net for transient bursts | 2 retries (2s/5s) | PASS |
| Row-cap fix (companion) | never renders >400 rows | implemented with banner | PASS |
| Default filter | current month, not all | implemented | PASS |
| Lazy-mounted panels | no simultaneous 3-team fetch on login | converted to `LazyPanel` | PASS |
| Backend syntax | valid | `ast.parse` clean | PASS |
| Backend restarted | healthy | confirmed via `/api/health` | PASS |

## Status
PASS for the fix itself. Full end-to-end re-verification (real data
loading in the UI) pending the GitHub quota's natural reset, since no
fix can restore an already-spent hourly quota.

## Reviewer
Pending user confirmation after quota reset.
