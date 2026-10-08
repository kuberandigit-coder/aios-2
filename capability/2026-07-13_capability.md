# Capabilities — 2026-07-13

## Capability — Scheduled-Trigger Live Data Refresh (Vercel staff-pages variant)

**Date:** 2026-07-13
**Owner:** Kuberan (Thasitha Req1)
**Project:** digital-marketing-member-pages (Vercel-hosted static pages, not dm-dashboard/FastAPI)
**Status:** Closed, deployed

### Capability

Replace a manually-refreshed static page with a fully automated hourly refresh routine, driven by
a Claude Code scheduled trigger rather than a backend cron job or a client-side poll — for a
project (the Vercel staff-requirements pages) that has no backend server of its own to host a
scheduler.

### Technical implementation

- A named scheduled trigger (`trig_01Hr3tZ2DD2dSEYMqPgZygzs`) runs hourly: queries Postgres,
  rebuilds the static page, validates it, and pushes to both repos (this project's known dual-repo
  setup) **only when the underlying data actually changed** — not an unconditional push every
  hour.
- A live "Last updated: X mins/hours ago" badge on the page itself, which self-refreshes
  client-side in the browser without needing a page reload.

### Relationship to the later `ScheduledSnapshot` pattern (2026-08-29)

This is an earlier, architecturally distinct scheduled-refresh pattern — a Claude Code scheduled
trigger pushing a rebuilt static page to two git repos — not the same mechanism as the later
`ScheduledSnapshot` (a Postgres-table-backed snapshot read by a live FastAPI backend, built for
dm-dashboard). The two solve the same underlying problem (stop refreshing slow/stale data on every
request) for two structurally different projects: this one for a static-site-on-Vercel project
with no backend of its own, `ScheduledSnapshot` for a project that already has a FastAPI backend
and Postgres. Worth distinguishing so a future "which refresh pattern do I use" question picks the
one that matches the project's actual architecture.

### Originating task

`closure/thasitha/2026-07-13_hourly-live-refresh-closure.md` (evidence file referenced there as
`evidence/thasitha/requirement-1-hourly-live-refresh-routine-evidence.md` — not independently
re-read as part of this capability-ization, see Limitations).

### Reuse

The "conditional push only when data changed" + "self-refreshing relative-time badge" combination
is reusable for any future Vercel-hosted static page needing a scheduled refresh without a backend
server to host the scheduler itself.

### Limitations

Written up primarily from the closure doc rather than the full evidence file (path referenced
above but not located/read during this backfill pass) — the exact Postgres query and push-only-on-
change diffing logic were not independently verified.
