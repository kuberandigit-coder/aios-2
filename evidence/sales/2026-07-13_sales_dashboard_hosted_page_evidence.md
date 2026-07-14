---
title: LEDSone UK Sales Dashboard — Hosted Page Build Evidence
date: 2026-07-13
type: evidence
---

# Title
LEDSone UK Sales Dashboard — Hosted Page Build Evidence

# Purpose
Build a hosted, standalone version of the existing LEDSone UK sales
dashboard (currently only accessible via the Google Apps Script web app
URL or the separate iframe wrapper at
`C:\Users\PC\OneDrive\Desktop\Sales Dashboard`) as a proper member page
inside `reports/digital-marketing-member-pages/`, matching the site's
existing structure.

# Business Question
Give staff a directly-hosted sales/attribution dashboard (revenue,
orders, channel splits for Meta / Google Ads / Google Organic / Organic
/ Email) without depending on the standalone iframe deployment.

# Requirement Source
User-provided task spec, 2026-07-13, including full existing
`code.gs` (webhook order-sync script), `dashboard.gs` (doGet +
getDashboardData + getAvailableMonths), and `Dashboard.html` pasted
directly into the session.

# PostgreSQL Sources Checked
None — this dashboard's data source is a Google Sheet ("Shopify UTM
Report - UK") populated by a separate Apps Script webhook pipeline, not
PostgreSQL.

# Shopify Sources Checked
Not directly — the existing webhook pipeline (unmodified, out of scope
for this task) already handles Shopify Admin GraphQL calls
(`fetchOrderJourney`, `fetchOrdersForRange`) to populate the Sheet.

# Security Handling

The user pasted `code.gs`, which contained what appeared to be a live
Shopify Admin API token and a webhook shared secret in plain text
(`CONFIG.SHOPIFY_TOKEN`, `CONFIG.WEBHOOK_SECRET`). Per explicit
instruction:
- Confirmed with the user **before any implementation** that both had
  already been rotated in Shopify Admin (user confirmed: "Yes, both
  rotated").
- Neither value was echoed, copied, or written into any file in this
  repository at any point.
- `sales.html` and the `doGet` change do not require either credential —
  the new `?action=data` / `?action=months` endpoints are read-only and
  only call `getDashboardData()` / `getAvailableMonths()`, which read
  from the Sheet directly (no Shopify API call, no webhook secret
  needed).
- The only value embedded in `sales.html` is the Apps Script **web app
  `/exec` URL** itself, which is a public deployment endpoint (not a
  secret) — the same URL already used in the pre-existing, separately
  deployed iframe dashboard.

# Implementation

**Apps Script change (not directly editable — no tool access to Google
Apps Script's cloud editor; provided as a paste-in snippet for the
user):** replaced `doGet(e)` in `dashboard.gs` to add two JSON action
branches ahead of the existing HTML-serving fallback:
- `?action=data&month=YYYY-MM` → `ContentService.createTextOutput(JSON.stringify(getDashboardData(month))).setMimeType(ContentService.MimeType.JSON)`
- `?action=months` → same pattern calling `getAvailableMonths()`
- No-action case unchanged (still serves `Dashboard.html` via
  `HtmlService`).
- The existing `DASHBOARD_KEY` access-gate check is preserved ahead of
  the action branch, so it still applies to both HTML and JSON access
  paths consistently.

**New file**: `reports/digital-marketing-member-pages/pages/sales.html`
— built by reusing `Dashboard.html`'s CSS, DOM structure, and all
Chart.js/table rendering logic verbatim, with exactly two functional
changes:
1. `loadMonthList()`: replaced
   `google.script.run.withSuccessHandler(...).getAvailableMonths()`
   with `fetch(APPS_SCRIPT_EXEC_URL + '?action=months').then(r=>r.json())...`
2. `load()`: replaced
   `google.script.run.withSuccessHandler(render).withFailureHandler(...).getDashboardData(__selectedMonth)`
   with `fetch(APPS_SCRIPT_EXEC_URL + '?action=data&month=' + encodeURIComponent(__selectedMonth||'')).then(r=>r.json()).then(render).catch(...)`

All other behavior preserved unchanged: 15-minute auto-refresh
countdown, day-filter strip (heat-map chips), 5 KPI cards, Chart.js line
chart + per-channel mini charts, channel/campaign tables, and the
existing customer name/email redaction (`••••••` placeholders already
present in the source `Dashboard.html` — carried over as-is, not added
by this task).

Added a small top bar (back-to-index link + "Developed by Kuberan"
badge, matching the styling convention already used on the other 9
member pages) above the existing dashboard header.

**`index.html`**: added a new "Sales Dashboard" roster card in the
Active Dashboards section (after Sukirtha), linking to `pages/sales.html`.
Updated header stats (Active Dashboards 9→10, Live Reports 28→29) and
the section-title count.

# Files Modified
- `reports/digital-marketing-member-pages/pages/sales.html` (new)
- `reports/digital-marketing-member-pages/index.html`
- Apps Script `dashboard.gs` `doGet` — **not directly modified by this
  session** (no tool access to Google's cloud editor); exact replacement
  snippet handed to the user to paste and redeploy themselves. See
  Next Step.

# Evidence Location
This file.

# Validation Result
See `validation/sales/2026-07-13_sales_dashboard_validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user to confirm the Apps Script `doGet` change is applied,
redeployed, and the `/exec` URL in `sales.html` matches the live
deployment before this goes live.

# Status
Built and validated locally. **Not yet deployed or pushed** — awaiting
explicit user confirmation per task instructions ("push only with
explicit permission") and confirmation that the Apps Script side has
been updated/redeployed.

# PASS / FAIL
PASS on structural validation (HTML balance, JS syntax). **Untested
against the live Apps Script endpoint** — the `doGet` change hasn't been
applied/redeployed yet by the user, so `sales.html`'s fetch calls
haven't been exercised against a real, updated deployment.

# Next Step
1. User pastes the provided `doGet` replacement into `dashboard.gs`.
2. Redeploy via **Deploy → Manage deployments → Edit → New version**
   (not "New deployment", to keep the same `/exec` URL sales.html
   already points to).
3. Confirm the `/exec` URL embedded in `sales.html` still matches the
   live deployment's URL.
4. Manually verify `?action=months` and `?action=data&month=...` both
   return JSON, and the no-action URL still serves the original HTML
   dashboard unchanged.
5. Once confirmed working, this session will git add/commit per
   CLAUDE.md; push only on explicit user confirmation.

---

## Update (appended 2026-07-14) — CORS diagnosis, then approach change

**First fix attempt**: user tested the fetch-based `sales.html` on the
live Vercel deployment (not a local file — that earlier "Failed to
fetch" was diagnosed and ruled out separately) and hit the same error
again. Diagnosed directly:

```
curl -sI -L <exec-url>
→ no Access-Control-Allow-Origin header present at all
```

Confirmed root cause: **Google Apps Script web app responses never
include CORS headers**, so a browser `fetch()` from a different origin
(our Vercel page) is always blocked, regardless of what the Apps Script
`doGet` code returns. This is a platform limitation, not fixable from
the Apps Script side.

**Fix built**: `reports/digital-marketing-member-pages/api/sales-proxy.js`
— a Vercel serverless function that fetches the Apps Script `/exec` URL
server-side (not subject to browser CORS) and hands the JSON back to
the browser from our own domain. Verified working end-to-end (the proxy
itself reached Google's servers correctly; the response was still the
old HTML because the `doGet` update hadn't been applied yet — confirming
both issues were real and independent).

**Approach change (user decision)**: the user replaced `sales.html`
entirely with a simpler **iframe embed** of the Apps Script `/exec` URL
directly — the same proven pattern already used by the separate,
pre-existing iframe deployment (`C:\Users\PC\OneDrive\Desktop\Sales
Dashboard`). This sidesteps CORS entirely (an `<iframe src="...">` is
not subject to fetch-based CORS restrictions the same way, and the
Apps Script side already sets `XFrameOptionsMode.ALLOWALL`) and removes
the need for the JSON `doGet` action branches, the fetch-based rewrite,
and the `api/sales-proxy.js` function — all three are now unused/moot
for the shipped version. `api/sales-proxy.js` was removed from disk.

**Final shipped `sales.html`**: a minimal iframe wrapper page (title,
favicon, full-viewport `<iframe>` pointing at the Apps Script `/exec`
URL). Validated (div-balance clean, structurally sound) and deployed to
Vercel production — confirmed live via curl (200 OK, iframe present).

**Git status**: deployed to Vercel only. Git commit/push still pending
per the task's explicit "push only with explicit permission" instruction.
