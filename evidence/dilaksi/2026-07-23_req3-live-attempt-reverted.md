# Evidence — Dilaksi Req3 Live-Data Attempt (Built, Then Fully Reverted Same Day)

**Date:** 2026-07-23
**Commits:** `5057d54` (Dilaksi Req3 WIP portion), `697731a` (feat — snapshot-method pivot), `68d5093` (revert — all removed)
**Final status: REVERTED. Req3 is back to its original fully-static state, exactly as it was before today.**

## Purpose
Attempted to make Dilaksi Req3 (SEO/GA4/GSC collection report) live-refreshable, same as Req1/Req2. Documenting the full attempt and revert here since the intermediate commits (`5057d54`, `697731a`) are still in git history but the resulting code no longer exists — this file exists so the AIOS record doesn't imply Req3 is live when it isn't.

## What was tried

### Attempt 1 (`5057d54`) — direct live endpoint
- Added `fn=dilaksi-req3-live` to `api/requirement.js`: full live check (Shopify collections + GA4 12-month + GSC 12-month + a paced HTTP-liveness check across 482 collection URLs).
- Confirmed **unable to finish inside a single Vercel serverless invocation** — the full check takes 5-7 minutes, but this project's functions have a hard 300-second execution limit (`vercel.json`). Not wired to the frontend.

### Attempt 2 (`697731a`) — snapshot-method workaround
- Moved the computation out of the Vercel function into a standalone script (`api/scripts/generate-dilaksi-req3-snapshot.js`) that talks to Shopify/GA4/GSC directly from GitHub Actions, which has no 300s limit.
- The Vercel handler would only ever serve whatever that job last wrote — no live/`refresh=1` path, unlike every other "live" tab; freshness capped at the last hourly run.
- Added a Refresh button to `dilaksi.html` that re-fetched the snapshot (re-displaying the last-generated timestamp, not triggering a new computation).

### Revert (`68d5093`) — fully undone
- Removed the `fn=dilaksi-req3-live` endpoint and its helper functions from `requirement.js`.
- Removed the Refresh button/JS from `dilaksi.html`.
- Deleted the standalone snapshot script and the frozen backlinks data file (`dilaksi-req3-backlinks-frozen.json`).
- Explicitly confirmed unaffected: Req1, Req2, and Kamsi Req4 live cards (separate work, see `2026-07-23_req1-req2-live-refresh-fixes.md` and `2026-07-23_kamsi-req4-live-summary-cards.md`).

## Raw diff
See `git show 5057d54` (Dilaksi Req3 portion), `git show 697731a`, `git show 68d5093`.
