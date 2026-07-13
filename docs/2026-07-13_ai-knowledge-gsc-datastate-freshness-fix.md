---
title: AI Knowledge — GSC dataState freshness fix
date: 2026-07-13
type: ai-knowledge
tags: [gsc-api, google-search-console, kamsi, sukirtha, data-freshness]
---

# Title
AI Knowledge — GSC `dataState` Freshness Fix (supplement to the earlier
multi-repo/GSC knowledge doc)

# Purpose
Capture a correction to earlier guidance in this session: the claim that
GSC's ~2-3 day reporting lag was an unavoidable hard limit was **wrong**
for the API's default behavior — there's a documented parameter that
narrows it. Recording this so future work doesn't repeat the same
overly-conservative assumption.

# Business Question
N/A — cross-cutting technical knowledge, applies to any GSC live-query
dashboard (currently Kamsi Req2 and Sukirtha Req1).

# Requirement Source
Discovered while building/refining Kamsi Req2 and Sukirtha Req1 live
dashboards, 2026-07-13.

# PostgreSQL Sources Checked
Not applicable — this is a GSC API finding.

# Shopify Sources Checked
Not applicable.

# The finding

`searchAnalytics.query` accepts a `dataState` request parameter:
- `dataState: 'final'` (the implicit default when omitted) — only
  returns fully-processed, settled data. This is what produces the
  commonly-cited "2-3 day lag."
- `dataState: 'all'` — also includes fresh/provisional data Google has
  ingested but not fully finalized yet. This matches what the **GSC web
  UI** shows by default (including its "24 hours" / recent-days view).

Verified directly: for `ledsone.de` on 2026-07-13, `dataState: 'final'`
returned data only through 2026-07-10. Adding `dataState: 'all'` returned
data through 2026-07-12 (yesterday), with the response's
`metadata.firstIncompleteDate` field telling us exactly which day(s) are
still provisional (`"2026-07-11"` in this case — meaning July 11 and
July 12 are fresh/unsettled, July 10 and earlier are final).

# Implication for dashboards

Using `dataState: 'all'` gets meaningfully fresher data (yesterday,
rather than 3 days back) at the cost of the most recent 1-2 days'
numbers being provisional and subject to small revision. The honest
approach — used in both `api/gsc-low-ctr.js` and
`api/gsc-sukirtha-low-ctr.js` — is to surface **both** dates:
`latestAvailable` (includes provisional) and `finalDataThrough`
(fully settled only, derived as `firstIncompleteDate - 1 day`), and
disclose the distinction in the UI rather than silently picking one.

# Why this wasn't caught initially

Earlier in this session (Kamsi Req2 build), the API was queried without
`dataState`, which silently defaults to `'final'`. Testing at the time
(direct per-day query for July 5-13) showed genuinely zero rows for July
11-13 — that test was accurate **for the default `dataState`**, but the
conclusion drawn from it ("this is an unavoidable Google limit") was
incomplete — it was a limit of the *default parameter choice*, not of
the API/platform itself. The user caught this by comparing our dashboard
against the live GSC UI directly (a "24 hours" view screenshot showing
fresher data than our page), which was the right way to catch it — cross-
checking a live integration against the source system's own UI.

# Files Modified
`reports/digital-marketing-member-pages/api/gsc-low-ctr.js`,
`reports/digital-marketing-member-pages/api/gsc-sukirtha-low-ctr.js`,
`reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-live.html`,
`reports/digital-marketing-member-pages/pages/sukirtha.html`.

# Evidence Location
`evidence/sukirtha/2026-07-13_req1_live_dashboard_build_evidence.md`
(contains the before/after `dataState` test results).

# Validation Result
Verified via direct handler tests against the live GSC API before and
after the fix — see evidence file for exact before/after JSON.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
N/A — technical knowledge capture.

# Status
Complete — fix applied and deployed to both affected dashboards.

# PASS / FAIL
PASS

# Next Step
If building further GSC live dashboards in future, default to
`dataState: 'all'` with the final/provisional disclosure pattern from
the start, rather than rediscovering this each time.
