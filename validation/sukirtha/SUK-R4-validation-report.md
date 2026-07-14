---
title: SUK-R4 — Validation Report
requirement_id: SUK-R4
type: validation
---

# Title
SUK-R4 — Validation Report

# Requirement ID
SUK-R4

# Purpose
Validate the Requirement 4 tab against the requirement's validation
checklist.

# Business Question
Which landing pages on ledsone.de receive Organic Search traffic, how
are users engaging with those pages, and what search queries generate
that traffic during the last 30 days?

# GA4 Property
`462018160` (ledsone.de, confirmed live).

# GSC Property
`https://ledsone.de/` (confirmed live).

# Checklist

| # | Item | Result |
|---|---|---|
| 1 | GA4 Property is correct | PASS — verified live via test `runReport` call; top hostname returned was `ledsone.de`, not `ledsone.co.uk` |
| 2 | GSC Property is correct | PASS — reused SUK-R1's confirmed grant on `https://ledsone.de/` |
| 3 | Organic Search filter applied | PASS — `sessionDefaultChannelGroup EXACT "Organic Search"` dimensionFilter on the GA4 request |
| 4 | Date Range = Last 30 Days | PASS — GA4 `30daysAgo`–`today`; GSC computed as `dateNDaysAgo(30)`–`dateNDaysAgo(0)`, both dynamic per request |
| 5 | Landing Pages successfully matched | PASS — live run matched 869 GA4 landing pages against 8,016 GSC queries by normalized URL path |
| 6 | No duplicate pages | PASS — GA4 `runReport` returns one row per distinct `landingPage`; no client-side or server-side duplication introduced in the join |
| 7 | Requirement 1, 2 and 3 still work | PASS — re-tested live after deploy: `gsc-sukirtha-low-ctr` (R1) 200, `sukirtha-req2-duplicate-check` (R2) 200, `sukirtha-req3-slow-moving-stock` (R3) 200 |
| 8 | Table columns match spec | PASS — Landing Page, Page Type, Top Query, Sessions, Users, Engagement Rate, Avg Engagement Time, Pages/Session, Purchase Revenue, Clicks, Impressions, CTR, Avg Position, Last Refreshed |
| 9 | Summary cards match spec | PASS — Organic Sessions, Organic Users, Landing Pages, Queries, Purchase Revenue, Avg Engagement Rate, Avg Engagement Time, Pages/Session |
| 10 | Filters match spec | PASS — Search Landing Page, Search Query, Page Type, Sessions, Revenue, CTR |
| 11 | Table features | PASS — responsive (`.scroll` overflow-x), pagination (r4pg/r4psize), sorting (`r4sortBy`), search (page/query inputs), sticky header (`thead th{position:sticky}` added repo-wide), CSV export (`r4exportCsv`) |
| 12 | No sample/dummy/hardcoded data | PASS — every row is live GA4/GSC API output; zero hardcoded arrays |
| 13 | No new HTML page created | PASS — only `pages/sukirtha.html` modified; tab 4 added inside the existing tab structure |
| 14 | Credentials not exposed client-side | PASS — `GA4_SERVICE_ACCOUNT_JSON`/`GA4_PROPERTY_ID` read via `process.env` only inside the serverless function; absent from the HTML/JS shipped to the browser |
| 15 | No production GA4/GSC config changed | PASS — read-only `runReport`/`searchAnalytics.query` calls only; zero writes |

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req4-ga4-seo.js`,
`reports/digital-marketing-member-pages/index.html` (Sonya 5, Sukirtha
4 report-count update — unrelated card-count sync, same deploy).

# Evidence
`evidence/sukirtha/SUK-R4-ga4-gsc-source-map.md`

# Validation Result
PASS — 15/15, confirmed against live production GA4/GSC data on
2026-07-14.

# Owner
Kuberan (AIOS) / Claude Code session

# Reviewer
Sukirtha — pending

# Status
Built, deployed, live-validated.

# PASS / FAIL
PASS

# Next Step
User to spot-check a few landing pages/queries against the GA4 and
Search Console UIs directly for a final human sign-off.
