---
title: Kamsi Sales — July Live Month Tab + Manual Refresh Button
requirement_id: SUK-KAMSI-SALES-4
type: evidence
date: 2026-07-17
---

# Title
Kamsi Sales — July Live Month Tab + Manual Refresh Button

# Purpose
User asked for a July 2026 month-to-date tab on Kamsi's dashboard that
reflects new organic orders as they come in, updated only when the user
explicitly clicks a Refresh button (no auto-polling/live-update).

# Business Question
When a Kamsi-owned product gets a new fully-organic (or other in-scope
group) order in July, can staff see it on the dashboard without waiting
for next session's static-snapshot rebuild — on demand, via a button?

# Change Made
`reports/digital-marketing-member-pages/api/sales-kamsi.js`:
- `SUPPORTED_MONTHS` extended to include `'2026-07'`.
- New `CURRENT_LIVE_MONTHS = ['2026-07']` — explicit, reviewable list (not
  a date-based auto-computation) of which months are "live" vs. closed
  historical. Adding August later means adding `'2026-08'` to both lists
  in this file, once August starts — not an automatic rollover.
- `resolveReportMonth()` now computes month-to-date end boundary
  (`Math.min(monthEndMs, Date.now())`) for live months, so a July fetch
  never claims data past "now" in Europe/London even mid-month. Label
  reflects this: e.g. "July 1–17 (month to date), 2026".
- No static snapshot file exists for `2026-07` (only `kamsi-sales-2026-0[1-6].json`
  exist) — the existing `fs.existsSync(staticPath)` check in the request
  handler naturally falls through to a live Shopify fetch for July with no
  further code change needed there.

`reports/digital-marketing-member-pages/pages/sales.html`:
- Added a "July (live)" month tab (now the default/active tab) alongside
  the existing Jan–Jun tabs.
- Added a `#kRefreshBtn` "Refresh" button next to the status chip — hidden
  for closed historical months, shown (and disabled while loading) only
  when the live month (`2026-07`, via client-side `K_LIVE_MONTHS`) is
  selected. Calls `kLoad(true)`, which passes `?refresh=1` to the API,
  bypassing both the in-memory 55s server cache and forcing a fresh
  Shopify fetch — no automatic/background polling anywhere in the page.
- Status chip and period sub-text now differentiate live vs. historical
  wording ("the current month, updated only when you click Refresh — not
  auto-updating" vs. "a completed, closed reporting period").
- Footnotes updated to document both behaviors distinctly.

# Verification
Not live-browser-tested in this session. Recommend the user load the
Kamsi tab → July tab and confirm: (a) it loads real July-to-date data on
first load, (b) the Refresh button appears only on the July tab, (c)
clicking Refresh re-fetches (button disables briefly, "Retrieved at"
timestamp updates), (d) switching to any Jan–Jun tab hides the Refresh
button and shows the original historical-data wording.

# Files Modified
`reports/digital-marketing-member-pages/api/sales-kamsi.js`,
`reports/digital-marketing-member-pages/pages/sales.html`

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Code change complete, pending live-browser verification and deploy.
