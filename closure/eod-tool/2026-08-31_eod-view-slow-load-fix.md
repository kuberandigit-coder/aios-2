# Closure — EOD Tool: "View EOD" popup slow load fixed

**Date:** 2026-08-31

## Summary
The "View EOD" popup's slow "Fetching your reports..." was caused by
`_list_member_reports()` making one sequential GitHub API call per past
report file (106 files for Jefri = 106 round-trips). Fixed via parallel
fetches (24 workers), a pooled/reused HTTP session, and a 2-minute
per-member cache invalidated on that member's own writes. Cold load went
from 40.35s to 5.80s; repeat opens are ~20ms.

## Status
PASS. Backend restarted and live-tested via curl.

## Reviewer
Pending user confirmation in the live UI.

## Evidence / Validation
See evidence/eod-tool/2026-08-31_eod-view-slow-load-fix.md and
validation/eod-tool/2026-08-31_eod-view-slow-load-fix.md
