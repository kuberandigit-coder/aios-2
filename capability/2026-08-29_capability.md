# Capabilities — 2026-08-29

## Capability — ScheduledSnapshot Pattern (origin)

**Date:** 2026-08-29
**Owner:** Kuberan (dm-dashboard, first built for Jefri Req1)
**Project:** dm-dashboard
**Status:** Live; became the standard caching model for every slow page since

### Capability

A standard pattern for taking a slow, live-per-request data source and converting it to a
scheduled Postgres snapshot instead — with a visible countdown to the next run, a manual "Run Now"
trigger, and Sync Monitor visibility — rather than leaving every new slow page to invent its own
ad-hoc caching approach.

### What problem it solves

Real page-load times were measured across every Jefri requirement page (Req1-8) to decide what
actually needed caching versus what was already fast — rather than caching everything by default
or guessing which pages were slow.

### Technical implementation (first built, Jefri Req1)

- A dedicated Postgres table per snapshot.
- Hourly auto-sync initially, later changed to every 2 days at 9:00 AM Sri Lanka time, with a
  visible countdown to the next run shown in the UI.
- Its own Sync Monitor entry (confirmed as a live, proven pattern, not just designed).

### Originating task

`closure/dm-dashboard/2026-08-29_jefri-scheduled-snapshot-and-speed-analysis.md`

### Reuse — confirmed extremely widely applied since

Per the originating closure doc's own words: "This became the reusable `ScheduledSnapshot` pattern
applied to every slow page since (Jefri Req6/8, Hetheesha, Thivajini, Sukirtha, Mahima, and
more)." Independently confirmed still in active use as of 2026-09-29 (Hetheesha's Search Console
Indexing Monitor registered a `ScheduledSnapshot` "exactly like Task 15", see
`2026-09-29_capability.md`) and 2026-10-07 (Blog HTML Automation's geo-visibility/AI-GEO-visibility
work references the same convention) — this is one of the most foundational, longest-lived
reusable patterns found in the entire AIOS history.

### Current shared implementation (confirmed by direct file check, 2026-10-08)

The pattern now exists as an actual shared module: `backend/app/core/scheduled_snapshot.py` in the
dm-dashboard repo — confirmed present via direct file check during this capability backfill. Any
future snapshot-backed page should import and use this module rather than writing a new one.

### Limitations

The closure doc this is sourced from itself notes its origin is "a Claude session record (not git
log)" — the exact original Jefri Req1 implementation (table schema, first commit) was not traced
back further than this closure doc; only the current shared module's existence was independently
confirmed, not its full implementation detail.
