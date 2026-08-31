# Evidence — EOD Reports "0 reports loaded": GitHub API quota exhausted, permanent fix

**Date:** 2026-08-31
**Purpose:** User reported the new React EOD Reports team-log pages (TEC/
SEO/ADS) showing "0 Reports Loaded" / "No tasks match the current filter"
for every member, and asked for a careful root-cause analysis and a
permanent fix, matching the old system exactly.

## Investigation (live, in-browser, not guessed)
Used the Chrome extension to log in as an actual admin/dev session and
reproduce the bug directly, rather than reasoning from screenshots alone:

1. Confirmed the fetch layer and ported parsers both work correctly in
   isolation (dynamically imported the real `tecParsers.js` module in the
   browser console, fetched Kuberan's real data, parsed 5 correct tasks).
2. Confirmed the browser was NOT actually frozen during the reported
   "hang" -- `document.readyState` and arbitrary JS both responded
   instantly even while screenshot capture timed out; the screenshot tool
   itself was the flaky part, not the page.
3. Directly queried the live `/api/eod/admin/history?member=Sajeepan`
   endpoint from the browser and got a **502** wrapping a real GitHub
   **403**: `"API rate limit exceeded for user ID 272722972"`.
4. Checked the raw GitHub response headers via curl:
   `X-RateLimit-Limit: 5000`, `X-RateLimit-Remaining: 0`,
   `X-RateLimit-Used: 5001`, `X-RateLimit-Reset: 1788168643` (~37 minutes
   away at the time of the check).

## Root cause (confirmed, not assumed)
The `EOD_GITHUB_TOKEN`'s hourly quota (5000 requests/hour, shared across
every EOD feature: staff EOD Tool, EOD Admin, and these new team-log
pages) was genuinely exhausted -- not a bug, not a burst/secondary limit.
The real reason it got exhausted so easily: **every cold load of a
member's full history made one GitHub API call per historical report
file**, and a member with 100+ days of history costs 100+ calls just to
open their page once. Opening all 3 team logs (TEC 2 members + SEO 5 +
ADS 8 = 15 members, most with 70-110+ files each) in one session could
plausibly cost 1000+ calls by itself, on top of everything else the EOD
Tool does across the whole app.

The only existing cache (`_REPORTS_CACHE`, a 120-second whole-history
cache) only helped *repeat* loads of the *same* member within 2 minutes
-- it did nothing to reduce the cost of the first, cold load, which is
the expensive one.

## Permanent fix (`backend/app/eod.py`)
1. **Per-(member, date) content cache**, `_FILE_CONTENT_CACHE`, with a
   6-hour TTL: once a specific day's report file has been fetched once,
   it's served from memory on every subsequent load instead of hitting
   GitHub again -- a past day's report can never legitimately change on
   its own. Today's file is deliberately excluded from this cache (always
   fetched live, since a submit/leave right now would change it).
   This turns "105 GitHub calls every cold load" into "105 calls the
   first time ever, ~1-2 calls (just the directory listing) every load
   after that."
2. **Explicit invalidation on writes**: all 4 write paths (staff submit,
   staff leave, admin submit-on-behalf, admin leave-on-behalf) now purge
   the specific `(member, date)` cache entry they just wrote, so the
   6-hour TTL is a safety net, not the only correctness guarantee --
   editing a past day's report (something only admin-on-behalf can do)
   is reflected immediately, not up to 6 hours later.
3. **Process-wide concurrency cap** (`GLOBAL_GITHUB_CONCURRENCY = 8` via
   a `threading.Semaphore`): every outbound GitHub call, regardless of
   which member/page triggered it, now shares one global limit, so a
   team-log page loading 8 members at once can never fire 190+
   simultaneous requests again -- a real, independently-confirmed
   contributing risk factor even though the primary quota exhaustion
   turned out to be the dominant cause this time.
4. **Short retry on the specific rate-limit response** (`_github_get_with_retry`,
   2 retries at 2s/5s) for genuine transient/edge-case bursts, separate
   from the hourly-quota case above (which no retry can fix -- it
   requires waiting for the actual reset).

## What this does NOT fix
The current hour's quota was still 0/5000 remaining at the time of this
fix (confirmed live) and had to wait out its natural reset (~37 minutes
from when it was checked) -- no code change can restore an already-spent
hourly quota. Going forward, the caching fix means this specific failure
mode (cold-loading full team histories burning the shared quota) should
not recur under normal usage.

## Companion fix found during the same investigation: unbounded row rendering
While reproducing the bug live, the tab also became genuinely unresponsive
(CDP screenshot timeouts) when a team-log panel first mounted. Root cause:
`frontend/src/admin/pages/EodTeamLog.jsx` rendered every parsed task as a
raw `<tr>` with no limit -- ADS alone (8 members, 100+ reports each) can
parse into several thousand rows, and committing that many DOM nodes
synchronously blocks React's main thread hard enough to look like a crash.
Fixed with two changes, independent of the GitHub-quota fix above:
- Defaults the month filter to the **current month** instead of "All
  months" on first load (a sane default regardless).
- Hard-caps rendering to 400 rows no matter what filter is chosen, with a
  clear banner ("Showing the most recent 400 of N tasks...") instead of
  silently truncating or ever attempting an unbounded render again.
- Converted the 3 team-log panels (TEC/SEO/ADS) in `AdminLayout.jsx` /
  `DevLayout.jsx` from eagerly-mounted `<div>`s to `LazyPanel` (the
  existing app-wide convention for exactly this kind of expensive tab) --
  they no longer all three fetch+render simultaneously the moment
  Admin/Dev logs in.

## Reviewer
Pending user confirmation once the quota window has reset -- reload EOD
Reports -> ADS Team and confirm real data loads; the *second* load of the
same page (or any team) should now feel close to instant.
