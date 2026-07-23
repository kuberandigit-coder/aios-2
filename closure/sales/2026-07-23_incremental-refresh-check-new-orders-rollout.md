# Closure — Incremental July Live-Refresh + "Check New Orders" Rollout to All Member Tabs

**Date:** 2026-07-23

## Summary
Fixed the July live-month "Refresh" button re-scanning the entire month from Shopify on every click (up to ~52s for some tabs). Added an incremental cache (`updated_at`-based delta fetch, hourly full-resync safety net) to Mahima's module first, then extended it to Kamsi, Dilaksi, Sukirtha-UK, and Sukirtha-DE-Email — 5 handler modules total, covering all 14 member tabs. UX evolved in three steps per user direction: (1) two buttons — Refresh (full) + Check New Orders (fast) — on Mahima only, (2) same two-button pattern rolled out to all remaining 12 tabs, (3) Refresh button removed entirely everywhere, leaving "Check New Orders" as the sole control (shows "Refreshing…" while loading), with the hourly full-resync safety net still running automatically server-side.

## Linked files
- Evidence: `evidence/sales/2026-07-23_incremental-refresh-check-new-orders-rollout.md`
- Validation: `validation/sales/2026-07-23_incremental-refresh-check-new-orders-rollout.md`
- Commits: `c61ac4a`, `81c315f`, `be89ae8` (rollout portion), `863a41a`
- Related (bundled in `be89ae8`): `mahima/2026-07-23_req3-search-terms-live-relocation.md`

## Status: PASS — live-verified in production at every step before commit
**Reviewer:** User (directed each iteration).
**Next step:** None outstanding.
