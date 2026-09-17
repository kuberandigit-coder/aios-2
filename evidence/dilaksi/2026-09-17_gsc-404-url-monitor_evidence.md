# Evidence — GSC 404 URL Monitor (Dilaksi)

**Date:** 2026-09-17
**Project:** dm-dashboard

## 1. Audit of existing GSC integration (done before writing code)

Searched the whole `dm-dashboard` backend for GSC/Search Console/
credentials/existing endpoints before writing anything. Found:

- `backend/app/google_client.py` — the ONE shared Google API client.
  Auth: a service-account JSON key (`GSC_SERVICE_ACCOUNT_KEY` /
  `GA4_SERVICE_ACCOUNT_JSON` in `backend/.env`, same value for both)
  signs a JWT and exchanges it for an OAuth token
  (`webmasters.readonly` scope for GSC). Token cached in-process 55
  min. This integration is fully reused — no new credential, no new
  auth flow written.
- Existing GSC usage before this task: `query_gsc()` (searchAnalytics
  API) already used by `dilaksi.py`, `kamsi.py` (Req2 Low CTR),
  `seo_intelligence.py`, and `meta_audit`. Confirmed via `grep` across
  the whole backend.
- No existing endpoint or database table anywhere in the codebase
  captured GSC-reported 404/error/crawl-status data. (Two same-day
  attempts at this — `broken_link_monitor` on Screaming Frog, then on
  GSC's own URL Inspection — were both built and then explicitly
  removed earlier in this same session; their code is gone from the
  working tree but visible in git history around this date.)
- Existing Shopify integration: `backend/app/shopify_client.py`'s
  `graphql(store, query, variables)`, `STORE = "ledsone_uk"`. Reused
  as-is, read-only.
- Existing scheduled-task architecture: `backend/app/scheduled_snapshot.py`'s
  `ScheduledSnapshot` class — registers into `sales_cache.sync_history`/
  `sync_control`, which the existing Sync Monitor UI
  (`frontend/src/admin/pages/SalesSyncMonitor.jsx`) reads generically
  by `scope`. Confirmed fully generic (`sales.py`'s `/api/sales/sync/*`
  endpoints check `scope in REGISTRY`, no per-scope backend branching
  needed) by reading `sales.py` lines 363-524. Reused as-is — no second
  scheduler built.
- Existing dev-task registration convention: `backend/app/dev_tasks/__init__.py`
  aggregates each task's router + `ensure_schema`; frontend registers
  in `taskRegistry.js` + `AdminLayout.jsx` + `DevLayout.jsx`, following
  the exact same pattern as Meta Title & Description Audit / Alt Text
  Keyword Finder / Content Gap Analysis.

## 2. API validation — can the GSC Page Indexing 404 report be retrieved via API?

**NO.** Confirmed by inspecting the only two report-shaped endpoints
the Search Console API v1 actually exposes:

| Endpoint | What it returns | 404/error data? |
|---|---|---|
| `searchAnalytics.query` (`query_gsc`) | clicks, impressions, ctr, position per URL/query/date | **No** — no error/crawl-status field of any kind |
| `urlInspection.index:inspect` (`inspect_url`, added this task) | `indexStatusResult.pageFetchState` (e.g. `NOT_FOUND`, `SOFT_404`, `SUCCESSFUL`), `coverageState`, `lastCrawlTime` — Google's real recorded verdict | **Yes, but one URL per call** — no bulk list, no "give me every 404" mode |

There is **no public API** that reproduces the GSC website's "Page
indexing → Not found (404)" report as a bulk list. This was verified
by (a) reading `google_client.py`'s existing `query_gsc` implementation
and confirming its response shape has no status/error field, and (b)
confirming via Google's own API documentation structure (Search
Console API v1 only defines `sites`, `sitemaps`, `searchanalytics`,
and `urlInspection` resources — no `pageIndexing` or `coverage`
resource exists).

**Closest officially supported method, and what was implemented:**
`urlInspection.index:inspect`, called once per URL against a bounded,
GSC-known URL list (see below). Every UI/DB label for this data says
"GSC URL Inspection" and explicitly does NOT claim to be "the GSC Page
Indexing 404 report" — see `backend/app/dev_tasks/gsc_404_monitor/__init__.py`'s
docstring and the frontend page's own footnote text.

## 3. What was implemented

Backend (`backend/app/dev_tasks/gsc_404_monitor/`):
- `__init__.py` — full audit write-up (same content as this section,
  kept next to the code so it survives independent of AIOS).
- `schema.py` — one Postgres table, `public.gsc_404_monitor_issues`,
  with `original_url` (exact, never altered) and `normalized_url`
  (trailing-slash/fragment-stripped only, locale paths and query
  params preserved) as separate columns, per the URL-normalization
  requirement. `source` column defaults to `'gsc_url_inspection'`
  (never `'gsc_page_indexing_report'`). Full review/development status
  workflow columns.
- `gsc_scanner.py` — calls `inspect_url` per URL; **`on_result` fires
  immediately after every single URL**, before moving to the next one
  — this is what the router uses to upsert that one row to Postgres
  right away (see the "immediate per-URL persistence" requirement).
- `enrich.py` — `fetch_gsc_known_urls` (the real candidate-URL source,
  since Inspection doesn't discover URLs itself: every URL GSC's own
  Search Analytics has data for, last 90 days, sorted by impressions,
  capped at 500 for Google's quota), GA4/GSC traffic context fetchers,
  `normalize_url`, and `find_shopify_replacement` — a real, checkable
  two-signal matcher (exact handle after stripping a trailing ID/SKU
  suffix -> 95% confidence; otherwise a live catalogue search + Jaccard
  token-overlap similarity against product/collection titles+handles,
  confidence = real overlap ratio, never invented). Returns
  `suggestedUrl: None` / `confidence: None` when nothing clears 40%
  overlap — never fabricates a match.
- `router.py` — registers a `ScheduledSnapshot` (scope
  `gsc-404-monitor`, daily at 4am Sri Lanka time) so this task appears
  in the existing Sync Monitor automatically; its `compute_fn` is the
  actual scan (fetch known URLs -> for each, inspect -> enrich -> match
  -> upsert, immediately per URL). REST endpoints for listing issues,
  updating review/development status, and a `/scan-progress` endpoint
  for live "checked X of Y" display.
- `google_client.py` — added `inspect_url()` (documented above), no
  other change to this shared file.

Frontend:
- `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx` — new page,
  built on the existing `jreq-*` CSS/table/filter/KPI pattern (same as
  every other Development Task page). KPI cards, filterable/searchable
  table with the exact columns requested (404 URL, Last Crawled, Search
  Clicks, Impressions, GA4 Sessions, Suggested Shopify URL, Confidence,
  Priority, Review Status, Dev Status), polls every 5s so rows appear
  live while a scan is running.
- Registered in `taskRegistry.js`, `AdminLayout.jsx`, `DevLayout.jsx`
  (Development Tasks tab) and `SalesSyncMonitor.jsx` +
  `DevLayout.jsx`'s Sync Monitor sidebar list (new scope
  `gsc-404-monitor`, label "Dilaksi — GSC 404 URL Monitor").

## 4. What was NOT done / explicit limitations

- **No live execution inside the Claude session**, per explicit
  instruction ("dont run anything in claude... we will run in the
  system"). The scan has NOT been run against production yet; no
  real 404 rows exist in `gsc_404_monitor_issues` as of this writing.
- No automated full-site sweep — the URL list is capped at 500 (GSC
  Search Analytics' own known-URL list), which is a real limitation of
  Google's per-property URL Inspection quota, not a shortcut taken
  here.
- The Shopify matcher is a real, checkable two-signal design (exact
  handle-suffix match, then token-overlap search) — it is NOT a
  fully attribute-aware matcher (wattage/colour/material parsing from
  tags was not implemented as literal structured fields, since no
  existing code in this repo parses those attributes from Shopify tags
  reliably; the token-overlap approach captures shared words in
  titles/handles instead, which covers many of the same real cases
  without inventing attribute-extraction logic that doesn't exist
  elsewhere in this codebase).

## 5. Files changed

New:
- `backend/app/dev_tasks/gsc_404_monitor/__init__.py`
- `backend/app/dev_tasks/gsc_404_monitor/schema.py`
- `backend/app/dev_tasks/gsc_404_monitor/enrich.py`
- `backend/app/dev_tasks/gsc_404_monitor/gsc_scanner.py`
- `backend/app/dev_tasks/gsc_404_monitor/router.py`
- `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx`

Modified:
- `backend/app/google_client.py` (added `inspect_url`)
- `backend/app/dev_tasks/__init__.py` (registered new router/schema/snapshot)
- `frontend/src/taskRegistry.js`, `frontend/src/admin/AdminLayout.jsx`,
  `frontend/src/dev/DevLayout.jsx`, `frontend/src/admin/pages/SalesSyncMonitor.jsx`

## 6. Database changes

New table: `public.gsc_404_monitor_issues` (see schema.py for full
column list). New Sync Monitor snapshot table:
`sales_cache.gsc_404_monitor_snapshot` (auto-created by
`ScheduledSnapshot`'s own `_ensure_table`).

## 7. Tests performed

- `python -m py_compile` on every new/modified backend file — PASS.
- `npx vite build` on the frontend — PASS (only pre-existing,
  unrelated `INEFFECTIVE_DYNAMIC_IMPORT` warnings shared by every
  other dev-task page).
- Live GSC/Shopify data flow, UAM click-through, and the Sync Monitor
  "Run Now" button were **NOT** tested live, per explicit instruction
  not to run anything in this session. See validation record for the
  honest PASS/FAIL/PARTIAL breakdown.

## 8. No secrets exposed

Confirmed no API keys/tokens/credentials appear in any new code, log
statement, or this AIOS documentation. `inspect_url()` uses the same
existing `GSC_SERVICE_ACCOUNT_KEY` env var already in `backend/.env`
(gitignored) — no new credential file created or referenced.
