# Evidence — EOD Tool: "View EOD" popup slow load fixed

**Date:** 2026-08-31
**Purpose:** User reported the "View EOD" popup stuck on "Fetching your
reports..." for a long time.

## Root cause
`backend/app/eod.py`'s `_list_member_reports()` fetched every past report
file one at a time, sequentially, from the GitHub Contents API (one full
network round-trip per `.md` file). Jefri alone has 106 daily report files
in the `eod-reports` GitHub repo, so a cold "View EOD" open made 106
sequential GitHub API calls before rendering anything.

## Fix
1. Parallelized the per-file fetches via `ThreadPoolExecutor` (up to 24
   concurrent workers).
2. Added a shared, connection-pooled `requests.Session` (`pool_maxsize=32`)
   reused across all GitHub calls — concurrent threads now reuse TLS
   connections instead of each paying a fresh handshake, which is most of
   the real speedup once parallelized.
3. Added a 2-minute in-memory cache per member
   (`_REPORTS_CACHE` / `_REPORTS_CACHE_TTL`), invalidated immediately on
   that member's own submit/leave (staff or admin-acting-on-behalf).
4. `GET /api/eod/mine` and `/api/eod/admin/history` now accept
   `?refresh=1` to force-bypass the cache; the popup's Refresh button uses
   it.

## Measured result (curl against Jefri, 106 report files)
- Cold load, before fix: not parallelized, sequential -- 40.35s
- Cold load, after fix (parallel + pooled session): 5.80s
- Warm load (cached, within 2 min): 0.02s
- Data correctness verified: 106 reports returned, sorted newest-first,
  content intact (spot-checked latest entry).

## Reviewer
Pending user confirmation (please re-open "View EOD" and confirm it now
loads quickly).
