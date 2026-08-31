# Closure — EOD Reports "0 reports loaded" + tab freeze

**Date:** 2026-08-31

## Summary
Diagnosed live in the browser (not guessed from screenshots): the real
root cause was the shared `EOD_GITHUB_TOKEN`'s hourly quota (5000/hour)
being genuinely exhausted, confirmed via raw GitHub rate-limit headers
(0 remaining). The cause of the exhaustion: every cold "view team
history" load cost one GitHub API call per historical report file, with
no long-term caching -- a member with 100+ days of history cost 100+
calls just to open their page once. Fixed permanently with a
per-(member, date) content cache (6h TTL, invalidated immediately on any
write to that date) plus a process-wide concurrency cap. A companion
issue found during the same investigation -- unbounded row rendering
freezing the tab -- was also fixed (400-row cap, current-month default,
lazy-mounted panels).

## Status
PASS for the code fix. Data will only be fully re-verifiable once the
already-exhausted hourly quota naturally resets (no fix can restore an
already-spent quota).

## Reviewer
Pending user confirmation after quota reset.

## Evidence / Validation
See evidence/eod-tool/2026-08-31_eod-reports-github-quota-fix.md and
validation/eod-tool/2026-08-31_eod-reports-github-quota-fix.md
