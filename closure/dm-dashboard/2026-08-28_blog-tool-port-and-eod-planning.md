# Closure — Blog Tool ported to React, EOD system planning begins

**Date:** 2026-08-28
**Project:** dm-dashboard
**Source:** Claude session record (not git log)

## What was done
- Diagnosed sync-status confusion (why a scheduled run "didn't run
  yesterday") and confirmed jobs need the environment actually running
  to fire — informed the plan to move to a real server.
- Fixed a stopped/failed sync re-run flow (retry only the failed items,
  not the whole batch again).
- Investigated Mahima Req1/2/5 "failed to fetch" — traced and explained
  root cause; produced a table of exactly which pages pull live from
  the API vs Postgres, for transparency on speed.
- **Blog Tool ported into React**, matching the old system pixel-for-
  pixel per explicit instruction (same functions, same buttons, same
  layout — no redesign): scoped to Admin + Dev only (not all staff),
  wired into **User Access Management** so admin can grant/revoke tool
  access per user, backed by Postgres (with a Save button, confirmed
  connected).
- Multiple rounds of exact-fidelity fixes: screen-fit on large vs small
  screens, removed an unwanted rounded corner, restored a missing
  "add block" button between content blocks, CSS fixes to match the old
  UI's spacing exactly.
- Diagnosed and fixed a real bug: the Blog Tool (and other Access-
  Management-gated features) intermittently disappeared from the nav
  after ~15 minutes or on refresh — traced and fixed.

## Open items at end of day
- EOD system conversion (admin + user sides) — analysis of the old
  system started, full build not yet begun (kicked off properly on
  2026-08-31).
