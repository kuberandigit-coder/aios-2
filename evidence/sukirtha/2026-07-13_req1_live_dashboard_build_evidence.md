---
title: Sukirtha Req1 — Live GSC Dashboard Build Evidence
date: 2026-07-13
type: evidence
---

# Title
Sukirtha Requirement 1 — Live GSC Dashboard Build Evidence

# Purpose
Record implementation evidence for the live Low CTR Blog Posts &
Collections dashboard, following the discovery phase
(`evidence/sukirtha/2026-07-13_req1_discovery_and_gsc_access_gap_evidence.md`)
and the GSC access grant for `ledsone.de`.

# Business Question
Which blog posts and collection pages on ledsone.de have a CTR below 1.5%
during the last 6 months and should be prioritised for SEO optimisation?

# Requirement Source
Sukirtha Requirement 1 (business requirement provided 2026-07-13).

# PostgreSQL Sources Checked
None used in the final implementation — per explicit instruction ("get
all sukirtha asked data from gsc only do not use postgress"), the build
is 100% live GSC API, no PostgreSQL dependency. (PostgreSQL was checked
during discovery only — see discovery evidence file.)

# Shopify Sources Checked
Not applicable.

# GSC Access Grant Confirmation

User granted the service account (`aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`)
access to the `ledsone.de` property in Google Search Console (Restricted
permission level), confirmed via screenshot showing "Users (9)" list
including the service account. Verified programmatically immediately
after:

```json
// GET https://www.googleapis.com/webmasters/v3/sites
{
  "siteEntry": [
    {"siteUrl": "https://ledsone.de/", "permissionLevel": "siteRestrictedUser"},
    {"siteUrl": "sc-domain:ledsone.co.uk", "permissionLevel": "siteRestrictedUser"}
  ]
}
```

6-month range confirmed available directly from Google (URL-prefix
property `https://ledsone.de/`, not a domain property):

```json
// searchAnalytics.query, dimensions:['date'], 2026-01-09 to 2026-07-10
// → 183 rows (183 days with data), earliest 2026-01-09, latest 2026-07-10
```

# Implementation

**File created**: `reports/digital-marketing-member-pages/api/gsc-sukirtha-low-ctr.js`
- JWT auth (RS256, `webmasters.readonly` scope) — same pattern as Kamsi's
  `api/gsc-low-ctr.js`.
- `SITE_URL = 'https://ledsone.de/'`, `CTR_THRESHOLD = 0.015` (1.5%, per
  requirement — distinct from Kamsi's 2% threshold).
- Scope filter: `/collections/`, `/blogs/`, `/blog/` only.
- `typeOf()` maps to exactly `'Blog'` / `'Collection'` / `'Other'` (title
  case, matching the requirement's exact column spec).
- Results sorted by CTR ascending by default, matching the requirement's
  explicit "Sort by CTR ascending" instruction.
- `status` field set to exactly `'Low CTR'` / `'OK'` string values per
  the requirement's status rule.
- Uses `dataState: 'all'` (added after a follow-up freshness fix — see
  below) plus `firstIncompleteDate` tracking for honest provisional-vs-
  final disclosure.

**File created**: `reports/digital-marketing-member-pages/pages/sukirtha.html`
(replaced the 24-line pending-placeholder stub)
- Summary cards: Total Pages Checked, Low CTR Pages, Average CTR, Total
  Impressions, Total Clicks.
- Filters: Status (All/Low CTR/OK), Page Type (All/Collection/Blog),
  sort selector, date-range picker with "Clear (Full Range)".
- Search box (URL text search).
- **Export CSV** button — client-side CSV generation of currently
  filtered/sorted rows, exact columns per requirement (Page URL, Type,
  Impressions, Clicks, CTR %, Average Position, Status).
- Responsive table with pagination (50/100/250/500 rows, prev/next/
  first/last).
- **Last refresh timestamp** — shown in the footnotes section, updated
  from `generatedAt` on every live fetch.
- **Evidence section** — footnotes link directly to this evidence file
  and the discovery evidence file.

# Freshness follow-up fix (same session)

User compared against the live GSC UI (screenshot showing a "24 hours"
view with hourly data, "Last update: 3 hours ago") and questioned why our
dashboards' confirmed-data date lagged behind what the UI showed. Found
the cause: the GSC API defaults to `dataState: 'final'`
(fully-settled-only data), while the UI's default view includes
provisional data via `dataState: 'all'`. Fixed both `gsc-low-ctr.js`
(Kamsi) and `gsc-sukirtha-low-ctr.js` (Sukirtha) to request
`dataState: 'all'`, and to surface Google's own `firstIncompleteDate`
metadata so the UI can honestly show which day(s) are still provisional.

Verified before/after:
```
Before: dateRange latestAvailable = 2026-07-10 (finalized-only)
After:  dateRange latestAvailable = 2026-07-12, finalDataThrough = 2026-07-10,
        firstIncompleteDate = 2026-07-11
```

# Validation

```
node --check api/gsc-sukirtha-low-ctr.js         → OK
node --check <extracted <script> from sukirtha.html> → OK
div-balance check (sukirtha.html)                 → 30 open / 30 close
```

Direct handler test against live GSC API (before deploy):
```
totalPages: 2939 (initial), 2958 (after dataState:'all' fix)
collectionCount: 2718/2737, blogCount: 221
dateRange confirmed correct (6-month window, CTR-ascending sort verified
in sample output)
```

# Files Modified
- `reports/digital-marketing-member-pages/pages/sukirtha.html` (new
  build, replacing placeholder stub)
- `reports/digital-marketing-member-pages/api/gsc-sukirtha-low-ctr.js`
  (new file)
- `reports/digital-marketing-member-pages/api/gsc-low-ctr.js` (Kamsi's
  function, freshness fix applied in the same pass)
- `reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-live.html`
  (freshness disclosure update, same pass)
- `reports/digital-marketing-member-pages/index.html` (Sukirtha moved to
  Active Dashboards, header stats updated: 9 dashboards, 28 live reports)

# Evidence Location
This file, plus
`evidence/sukirtha/2026-07-13_req1_discovery_and_gsc_access_gap_evidence.md`
(discovery phase).

# Validation Result
See `validation/sukirtha/2026-07-13_req1_live_dashboard_validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — Sukirtha / SEO team review of the live dashboard.

# Status
Complete — deployed to production, verified live, both repos synced.

# PASS / FAIL
PASS — full requirement delivered: GSC-only (no Postgres), correct
columns/thresholds/sort, all required dashboard features (summary cards,
filters, search, CSV export, responsive table, last-refresh timestamp,
evidence section) present and working.

# Next Step
Await Sukirtha/SEO team review. No further action required unless
feedback requests changes.
