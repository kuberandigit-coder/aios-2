# Capabilities — 2026-09-07

## Capability — API Health Monitor Pattern

**Status:** Built and live this day — **removed entirely 3 days later (2026-09-10)**, see Status
note below.

### Capability

A single Dev-nav page checking every external API/service the dashboard depends on (Shopify
DE/UK/FR, Gemini, Groq, NVIDIA DeepSeek, Local LLM, GitHub ×2 tokens, Postgres App + Business),
checked every 15 minutes on a background thread, with a card per API showing a danger/warning/no-
issue/not-configured severity pill, a latency sparkline, which staff pages depend on it, and full
check history on click.

### Originating task

`closure/dm-dashboard/2026-09-07_dm-dashboard-api-health-monitor.md`

### Status note — removed same month

Per `closure/dm-dashboard/2026-09-10_competitor-lens-search-and-analysis.md`: "API Health Monitor
page removed entirely (frontend + backend)" on 2026-09-10, 3 days after being built. Documented
here anyway because the *pattern* (per-dependency health card with severity + latency + dependent-
pages + history) is reusable if a future need for this kind of monitoring returns, even though the
specific implementation no longer exists in the live app.

---

## Capability — Deploy Button: Built, Tested, Reverted by Deliberate Decision

### Capability (a documented decision, not a feature)

A semi-automated Deploy button (merge + log the request to a `dev_deploy_requests` table + hand
back a copy-paste SSH deploy command) was built, live-tested end-to-end, and then **fully reverted
by explicit user decision** — manual deploy was judged safer than any automated path, including the
semi-automated one that required no server access at all.

### Originating task

`closure/dm-dashboard/2026-09-07_dm-dashboard-deploy-button.md`

### Reuse

Before building any future deploy-automation feature for this project, check this decision first —
it was deliberately rejected once already, not merely never finished.

---

## Capability — Closed-Month Cache Gap (a real caching bug class)

### Capability (a documented bug class)

This project's closed-month Postgres caching only **proactively** runs for the current live month;
a lazy first-view fallback path computes the data live but **never persists it to cache** — so any
closed month that nobody has viewed yet silently recomputes from scratch (~45s) on every single
view, indefinitely, until someone notices.

### Originating task

`closure/dm-dashboard/2026-09-07_dm-dashboard-mahima-2026-cache-backfill.md`

### Reuse

Flagged as likely affecting other staff's never-yet-viewed closed months too (see
`handover/2026-09-07_dm-dashboard-open-items.md`) — worth checking for this exact gap on any
staff/metric combination that hasn't been viewed since its month closed.
