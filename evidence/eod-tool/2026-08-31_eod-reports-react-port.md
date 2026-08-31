# Evidence — EOD Reports (team logs) converted from static HTML into React

**Date:** 2026-08-31
**Purpose:** User clarified they didn't want the earlier static-HTML port
of the old "EOD Reports" team-log pages -- wanted it properly converted
into React, matching how EOD Tool/EOD Admin were built. Removed the HTML
version and rebuilt as a real dm-dashboard feature.

## What was removed
- `frontend/public/eod-reports/` (the 4 static HTML files ported last
  turn) -- deleted entirely.
- The `external: true` nav item + `window.open()` handling in
  `AdminLayout.jsx` / `DevLayout.jsx`.

## What was built (React, reusing the existing EOD backend)

The old team-log pages (`eod-tec.html`/`eod-seo.html`/`eod-ads.html`) each
run member-specific regex parsers -- refined over months of format drift
in real people's EOD-writing habits -- turning free-text markdown into
task-level rows (description, hours, tier classification, verification
status). This logic is genuinely large (18 parser strategies across 3
files, ~2000 lines) and specific to real historical data, so it was
**ported verbatim** (copy-pasted, not rewritten) rather than
reimplemented from scratch, to avoid silently breaking edge cases that
took months to handle correctly:

- `frontend/src/admin/eodReports/tecParsers.js` -- Kuberan + Piranav
  (2 members, 1 + 4 parser strategies + shared helpers).
- `frontend/src/admin/eodReports/seoParsers.js` -- Kamsi/Dilaksi/
  Sukirtha/Hetheesha/Jakshan (5 members, 1 shared parser with a
  cascading pattern list + 3 fallbacks).
- `frontend/src/admin/eodReports/adsParsers.js` -- Sajeepan/Sonya/
  Thivagini/Thishoban/Mahima/Jefri/Thasitha/Theekshy (8 members, 10
  cascading parser strategies). Ripson and Thanishtika (present in the
  old page's member list) were excluded -- same call already made this
  session for the EOD Tool build ("no login account"), and the backend's
  `ALL_MEMBERS` doesn't recognize them either.

**Key architectural change from the old page**: instead of each team-log
page doing its own direct-to-GitHub fetching (as `eod.html` did), the new
React pages fetch report data from the **existing** EOD backend endpoint
(`GET /api/eod/admin/history?member=`) -- already built, already
verified working earlier this session. The ported parser functions then
run client-side on the returned report text. No new backend code was
needed for this feature.

`frontend/src/admin/pages/EodTeamLog.jsx` -- shared React table component
(KPI strip, person/month filters, tier-colored pills, refresh button),
styled with the same `jreq-header`/card conventions used everywhere else
in the app. `EodTeamLogTec.jsx` / `EodTeamLogSeo.jsx` / `EodTeamLogAds.jsx`
are thin wrappers passing each team's members + parser function.

`AdminLayout.jsx` / `DevLayout.jsx`: "EOD Reports" nav item restored as a
proper main-tab/sub-tab group (TEC Team / SEO Team / ADS Team), same
pattern as "Sales 2026" and "EOD Admin" -- no scrollable page, no
external link/new-tab.

## Verification
- `npx vite build` -> `✓ built in 5.69s`, no errors.
- Ran the ported parsers directly against real historical report data
  fetched from the live backend (Node, not a browser, to isolate the pure
  parsing logic):
  - **Kuberan (TEC)**, 2026-07-13 report -> 5 tasks parsed correctly,
    matching the source markdown exactly (e.g. "Thasitha Req1 – Live Data
    Automation & Refresh Enhancement", 1.5h, Tier A).
  - **Kamsi (SEO)**, all 93 historical reports -> 401 tasks parsed total.
  - **Jefri (ADS)**, all 109 historical reports -> 375 tasks parsed
    total, sample rows verified correct (e.g. "Google Ads Performance
    Analysis", 2h, metric PROCESS_QUALITY).

## Reviewer
Pending user confirmation in the live UI -- Admin/Dev -> "EOD Reports" ->
each of the 3 team sub-tabs, confirm data loads and looks right.
