# Capabilities — 2026-08-27

## Capability — Live-vs-Historical Postgres Caching Split

**Date:** 2026-08-27
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Decided, built, large backfill executed and monitored

### Capability

A standing architectural convention for dm-dashboard's Postgres caching: **live/ongoing data
(2026, auto-syncs hourly) and historical data (2025 and anything before Aug 2026, gathered once,
never needs a live refresh) get separate, standalone tables** — not one shared table doing both
jobs.

### What problem it solves

Sales sync and Employee Performance sync had been sharing one table
(`sales_cache.snapshots`), which meant pausing one accidentally affected the other, and mixed
genuinely-live data with frozen historical data in the same structure with no clear boundary.

### Technical implementation

- Split into separate standalone tables, each with its own independent pause switch.
- Corrected the sync schedule to Sri Lanka time (confirmed, not assumed).
- A properly structured historical table was built for 2025 + pre-Aug-2026 data, rather than
  reusing the live 2026 table for both purposes — this was a design decision discussed and
  approved before building, not a default.
- A large historical backfill was run for 2025 data, monitored end-to-end for failures/completion.

### Originating task

`closure/dm-dashboard/2026-08-27_postgres-architecture-split-and-2025-backfill.md`

### Related

`2026-08-29_capability.md` (`ScheduledSnapshot`, the live-side mechanism this split complements —
this capability is about *which table* a snapshot belongs in, not the snapshot mechanism itself).

### Reuse

Any future staff/metric with both a live-ongoing component and a historical/frozen component
should follow this same split — a separate table per data lifetime, not one table trying to serve
both.

### Limitations

Some 2025/pre-Aug data backfill validation was still ongoing at the end of the day this was
written — not independently confirmed complete as part of this capability-ization.
