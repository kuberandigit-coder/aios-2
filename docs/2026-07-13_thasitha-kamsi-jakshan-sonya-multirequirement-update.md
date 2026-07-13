---
date: 2026-07-13
type: requirement-summary
staff: Thasitha, Kamsi, Jakshan, Sonya
status: see per-section below
---

# 2026-07-13 — Multi-Requirement Update: Thasitha, Kamsi, Jakshan, Sonya

Single session covering four separate workstreams on the Digital Marketing
Member Reports site (`reports/digital-marketing-member-pages/`). Each is
documented in full detail in its own evidence/validation/closure/handover
files (linked below) — this doc is the requirement-summary index for the day.

---

## 1. Thasitha — Requirement 1: Hourly Live-Data Refresh

| Field | Value |
|---|---|
| Staff | Thasitha |
| Requirement | Requirement 1 — Campaign Performance & ROAS Action |
| Title | Automate the existing static dashboard into an hourly self-refreshing page |
| Business Objective | Keep Google Ads campaign performance data (THT + MT campaigns) current without manual daily rebuilds; give staff visibility into how fresh the data is |
| Date | 2026-07-13 |
| Final Status | **PASS — live in production** |

**What changed:** Manually refreshed data through 2026-07-13 first (one-time),
then replaced the manual refresh process with a Claude Code scheduled cloud
routine (`trig_01Hr3tZ2DD2dSEYMqPgZygzs`, "Thasitha Req1 Hourly Data Refresh")
that runs every hour at :15 past. It queries Postgres, rebuilds the embedded
`DAY` data object, validates (Node syntax check + div-balance check), and only
commits/pushes to both repos if the data actually changed — skipping no-op
runs to avoid empty commits. Added a `GENERATED_AT` timestamp constant and a
client-side "Last updated: X mins/hours ago" badge that self-refreshes every
30 seconds in-browser without needing a page reload.

Full detail: [`evidence/thasitha/requirement-1-hourly-live-refresh-routine-evidence.md`](../evidence/thasitha/requirement-1-hourly-live-refresh-routine-evidence.md)

---

## 2. Kamsi — Requirement 2: Live GSC Low-CTR Dashboard

| Field | Value |
|---|---|
| Staff | Kamsi |
| Requirement | Requirement 2 — Low CTR Page Identification |
| Title | New live-query version of the existing static Low CTR report |
| Business Objective | Give Kamsi/SEO team a Low-CTR page report that reflects Google Search Console's current data on every visit, instead of a stale one-time snapshot (previous version was frozen at 2026-07-08) |
| Date | 2026-07-13 |
| Final Status | **PASS — live in production** |

**What changed:** Built a brand-new page (`pages/kamsi-req2-low-ctr-live.html`)
plus a new serverless function (`api/gsc-low-ctr.js`) that authenticates to
Google Search Console's Search Analytics API with a service-account JWT and
queries live on every page load / date-range change. Filters match the
existing static page's UX exactly (Flag / Page Type / CTR Range / date-range
picker / pagination) for consistency. Added a green "Live Dashboard" chip to
the existing static page (`kamsi-req1-slow-moving-products.html`, Req2 tab)
linking to the new live version, styled to match the page's existing chip
design language rather than a custom floating card (iterated through several
design rounds based on direct feedback).

Also fixed a freshness bug found during build: the date picker's `max` was
locked to Google's *last confirmed* data date (introducing an artificial
extra lag), changed to lock to *yesterday* instead so it advances
automatically every day regardless of when Google actually publishes.

Full detail: [`evidence/Kamsi/2026-07-13_kamsi_req2_live_gsc_dashboard_evidence.md`](../evidence/Kamsi/2026-07-13_kamsi_req2_live_gsc_dashboard_evidence.md)

---

## 3. Jakshan — Requirement 1 & 2: Production Regression Fix

| Field | Value |
|---|---|
| Staff | Jakshan |
| Requirement | Requirement 1 & 2 (Live GSC + Shopify auto-update, built by another contributor "Piranav") |
| Title | Fix accidental production regression + structural HTML bug |
| Business Objective | Restore Jakshan's live dashboard after it was unintentionally overwritten, and fix a broken DOM structure bug in the same file |
| Date | 2026-07-13 |
| Final Status | **PASS — fixed, live, synced to both repos** |

**What happened:** A manual `vercel --prod` deploy (run from the local
`aios-2` checkout to publish unrelated Kamsi/Thasitha changes) redeployed
`jakshan.html` from local disk, which still had an old 24-line stub —
silently overwriting another contributor's already-live 511-line
Piranav-built dashboard (Req1 live GSC/Shopify data + Req2 SEO Optimization
Tracker). Caught by comparing local vs the `Staff-requirements` repo's
version before pushing an unrelated request ("push jakshan.html also to
vercel"), which surfaced the discrepancy.

**Root cause of the regression:** local working directory (`aios-2` checkout)
was not synced with the `Staff-requirements` repo before running
`vercel --prod` — the Vercel CLI deploys whatever is on local disk, not
necessarily the latest git state.

**Also found while restoring:** a genuine structural bug in Piranav's
version — `<div id="req1-section">` was opened but never closed before the
Req2 section began, leaving the DOM tree unbalanced (76 open vs 75 close
`<div>` tags). Fixed with a single added `</div>`.

Full detail: [`evidence/jakshan/2026-07-13_jakshan_req1_req2_regression_and_divfix_evidence.md`](../evidence/jakshan/2026-07-13_jakshan_req1_req2_regression_and_divfix_evidence.md)

---

## 4. Sonya — Requirement 5: Stop Waste Spend Tab Bug Fix

| Field | Value |
|---|---|
| Staff | Sonya |
| Requirement | Requirement 5 — Stop Waste Spend (built by "Piranav") |
| Title | Fix leftover placeholder markup breaking DOM structure |
| Business Objective | Ensure Sonya's new Req5 tab (20 campaigns, wasteful assets, negative keyword candidates, GSC geo review candidates, Active/Paused status filter) renders correctly alongside the existing Req1-4 tabs |
| Date | 2026-07-13 |
| Final Status | **PASS — fixed, live, synced to both repos** |

**What happened:** While deploying an unrelated request, `git fetch` on the
`Staff-requirements` clone surfaced a new remote commit from Piranav adding
the Req5 tab to `sonya.html`. Validated the file's div balance before
deploying (per this session's established habit of checking structural
integrity before any Vercel push) and found it broken: 213 opening `<div>`
tags vs 215 closing — a leftover, never-cleaned-up placeholder from an old
stub version of the Requirement 3 "Trend" tab (`<h2>Trend</h2><p>Coming
soon — awaiting requirement specification.</p>` plus 2 stray extra
`</div>` tags) that should have been deleted when the real Trend table was
built out above it, but wasn't. Removed the dead markup and the 2 extra
closing tags; verified balance returned to 0/213-213.

Full detail: [`evidence/sonya/2026-07-13_sonya_req5_trend_tab_bugfix_evidence.md`](../evidence/sonya/2026-07-13_sonya_req5_trend_tab_bugfix_evidence.md)

---

## 5. index.html — Member Directory Roster Update

Moved Jakshan from "Awaiting Requirements" (pending) to "Active Dashboards"
(now showing "2 Reports Live"), positioned as the last card in the active
roster (after Thasitha, per explicit ordering instruction). Updated header
stats: Active Dashboards 7→8, Live Reports 25→27, Updated date → 2026-07-13.
Updated matching section-title counts and footer date.

---

## Cross-Cutting Discovery Notes

- **Google Search Console API access**: two service-account keys exist on
  this PC — `C:\Users\PC\.keys\ga4-service-account.json`
  (`aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, confirmed
  granted access to `sc-domain:ledsone.co.uk` since 2026-07-03, **the one
  actually used** for the new live Kamsi dashboard) and
  `ledsonede-gsc-7af8d5684e71.json` (repo root, project `ledsonede-gsc`,
  unverified/unused, possibly redundant — not relied on).
- **GSC API reporting lag confirmed empirically**: queried Google directly
  on 2026-07-13 for July 5–13 broken down by day — zero rows exist for
  July 11, 12, 13. Google's own processing lag is real (~2-3 days), not an
  artificial limit we imposed. This is documented as reusable AI knowledge
  (see below).
- **Vercel deploy-vs-git-sync risk discovered**: manually running
  `vercel --prod` from the local `aios-2` checkout deploys whatever is on
  local disk for the *entire* `digital-marketing-member-pages` directory,
  including files unrelated to the current task (e.g. other staff members'
  pages). If local disk isn't synced with the `Staff-requirements` repo
  (which other contributors also push to and which has Vercel's Git
  integration), a manual deploy can silently regress their work. This
  caused the Jakshan regression above and is now a documented risk (see AI
  Knowledge doc).

See reusable knowledge captured in:
[`docs/2026-07-13_ai-knowledge-gsc-live-api-and-multi-repo-deploy-patterns.md`](2026-07-13_ai-knowledge-gsc-live-api-and-multi-repo-deploy-patterns.md)
