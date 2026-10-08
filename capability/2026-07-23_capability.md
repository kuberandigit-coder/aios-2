# Capabilities — 2026-07-23

An unusually dense day — the point where the team converged on standardized live-refresh/caching
patterns across the entire Vercel sales-dashboard project. 3 distinct reusable capabilities below,
plus reusable gotchas found along the way.

---

## Capability — Incremental Delta-Fetch Refresh Pattern ("Check New Orders")

**Owner:** Kuberan, rolled out across Mahima/Kamsi/Dilaksi/Sukirtha-UK/Sukirtha-DE-Email
**Status:** Live, rolled out to 5 handler modules covering all 14 member tabs

### Capability

Replace a "Refresh" button that re-scans an entire month's orders from Shopify on every click
(up to ~52s for some tabs) with an **incremental, `updated_at`-based delta fetch** — only pulling
orders that changed since the last fetch — backed by an **hourly full-resync safety net** running
automatically server-side, so a missed delta can never silently drift the data permanently stale.

### UX evolution (3 steps, each live-verified before the next)

1. Two buttons on Mahima only: "Refresh" (full re-scan) + "Check New Orders" (fast, incremental).
2. Same two-button pattern rolled out to all remaining 12 tabs.
3. "Refresh" removed entirely everywhere — "Check New Orders" (showing "Refreshing…" while
   loading) became the sole control, since the hourly full-resync safety net already covers the
   case the old Refresh button existed for.

### Originating task

`closure/sales/2026-07-23_incremental-refresh-check-new-orders-rollout.md`

### Reuse

This is the standard live-refresh UX for this project going forward — any new member tab added
later should follow this same incremental-fetch + safety-net-resync + single-button pattern, not
reintroduce a full-rescan "Refresh" button.

---

## Capability — Durable Snapshot + Refresh-Button Semantics (fn=-style endpoints)

**Owner:** Kuberan, Jefri/Mahima `fn=`-dispatched endpoints
**Status:** Live

### Capability

For the `requirement.js`/`fn=`-dispatched endpoints (a separate codebase from the `sales.html`
incremental-refresh system above), add a durable hourly-refreshed static snapshot for any
endpoint that was previously live-only and slow on cold start — and fix a specific refresh-button
bug class along the way: **a Refresh button that doesn't explicitly pass `?refresh=1` only on
manual click is indistinguishable from the initial page load, and can silently serve stale cached
data** without the user ever knowing the click did nothing.

### Related technique — snapshot pre-warm

Added an hourly pre-warm job for all 15 live-July snapshot files so cold starts return in ~2s
instead of 30-50s. (Initially added to the wrong repo (`aios-2`) and reverted the same day — see
the dual-repo deploy hazard capability, `2026-07-29_capability.md`, for the broader pattern this
is one more confirmed instance of.)

### Related technique — script consolidation

Three duplicate snapshot-generation scripts were consolidated into one with mode flags, and a
superseded GitHub Actions workflow (`jackshan_daily.yml`) was removed rather than left orphaned.

### Originating tasks

`closure/jefri/2026-07-23_postgres-snapshots-refresh-fix.md`,
`closure/jefri/2026-07-23_meta-tab-kamsi-fix-hourly-snapshot-prewarm.md`,
`closure/mahima/2026-07-23_req1-req2-live-data-snapshot-merge.md`

### Reuse

Check any future "Refresh button" implementation against this exact bug class — the button must
be the only thing that sends `?refresh=1`, never the initial page load.

---

## Capability — CDN-Cache-Busting for Refresh Endpoints

**Owner:** Kuberan, Dilaksi Req1
**Status:** Live

### Capability

A refresh button can appear to work (the app-level cache correctly bypasses) while still serving
stale data, because **Vercel's CDN layer caches the response independently of the app's own
cache logic.** Fix: the `?refresh=1` path must also set `Cache-Control: no-store` on the response,
not just skip the in-memory/app cache.

### Originating task

`closure/dilaksi/2026-07-23_req1-req2-live-refresh-fixes.md`

### Reuse

A reusable checklist item for any future refresh-button implementation on this Vercel project:
app-level cache bypass alone is not sufficient if the response can also be CDN-cached.

---

## Other reusable notes from the same day

- **Exact-duplicate-data reuse, no backend duplication**: Kamsi Req4's live summary cards reuse
  Dilaksi Req2's existing live endpoint (`fn=dilaksi-req2-live`) directly, since Req4 was confirmed
  to be an exact data duplicate — a reminder to check for this before building a second endpoint.
  (`closure/Kamsi/2026-07-23_kamsi-req4-live-summary-cards.md`)
- **What NOT to do, documented from a same-day reversal**: Dilaksi Req3's live-data attempt (both
  a direct Vercel-function endpoint and a GitHub-Actions-generated snapshot) was fully reverted
  the same day — the full check (Shopify + GA4 + GSC + 482-URL liveness probe) takes 5-7 minutes,
  exceeding the project's 300-second Vercel function limit. Documented explicitly so a future
  session doesn't assume this was ever shipped, and so any future attempt knows to use the
  GitHub-Actions-snapshot approach, never a direct long-running Vercel function.
  (`closure/dilaksi/2026-07-23_req3-live-attempt-reverted.md`)
- **Static-to-live migration reusing all existing UI code unchanged**: Mahima Req3 was ported from
  a ~4.2MB hardcoded static dataset to a live PostgreSQL-backed endpoint while reusing all existing
  filter/render/pagination code — a reusable migration shape (swap the data source, keep the
  presentation layer) for any future static-to-live conversion.
  (`closure/mahima/2026-07-23_req3-search-terms-live-relocation.md`)
