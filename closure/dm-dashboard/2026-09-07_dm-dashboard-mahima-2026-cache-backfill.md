# Closure — Mahima 2026 August cache backfill (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Done — data fix, no code change, live now

## Request
"check mahima 2026 from july to dec showing 0 why where is her sales??"

## What was found
July, August, September 2026 all had real Shopify data. October–December
correctly show 0 (future months, today is 2026-09-07). The real gap:
August 2026 had never been cached in Postgres — the app's closed-month
caching only proactively runs for the current live month, and the lazy
first-view fallback path computes live but never persists to cache, so
August was recomputing from scratch (~45s) on every view.

## What was delivered
Ran a one-time backfill (no code change) using the existing sync engine
to compute + cache Mahima's 3 tabs for August 2026 — now instant on
every future view.

See `evidence/2026-09-07_dm-dashboard-mahima-cache-backfill-results.md`
for the sync timing results.

## Open item
Same gap likely affects other staff's never-yet-viewed closed months —
see `handover/2026-09-07_dm-dashboard-open-items.md`.
