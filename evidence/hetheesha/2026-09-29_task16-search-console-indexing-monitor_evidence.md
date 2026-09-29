# Evidence — Task 16: Search Console, Sitemap & Indexing Monitor (Hetheesha, Phase 1)

**Date:** 2026-09-29
**Prompt:** [[2026-09-29_task16-search-console-indexing-monitor_original-prompt]]
**Repo:** dm-dashboard, branch `dev-work`, commit `36c2fb7`.

## What was built

A read-only Phase 1 Development Task for ledsone.fr: sitemap + indexing
issue detection, priority classification, and a current-vs-previous-period
trend — no Request Indexing, no GSC write, no fix workflow.

## Inspection performed first (per the prompt's mandatory step)

- Confirmed the Development Tasks nav pattern in `frontend/src/admin/AdminLayout.jsx`
  and `frontend/src/dev/DevLayout.jsx` (a `children` array + `LazyPanel`),
  and the task-registry/UAM pattern in `frontend/src/taskRegistry.js`
  (`UserAccessManagement.jsx` reads this file directly — no separate UAM
  list to touch).
- Found the existing GSC integration: `backend/app/google_client.py`
  (`get_gsc_ledsone_fr_access_token`, dedicated ledsone.fr service account)
  and the existing per-URL Search Console cache Task 15 already built:
  `structured_data_validation.schema.GSC_INSPECTIONS` +
  `structured_data_validation.gsc` (`choose_sample`, `run_inspections`,
  `inspect_url` — reads `coverageState`/`indexingState`/`robotsTxtState`
  from the real URL Inspection API response).
- Found the existing sitemap crawler: `structured_data_validation.discovery`
  (real ledsone.fr sitemap parsing + template classification).
- Found an existing GSC impressions signal already stored per page URL:
  `french_keyword_research_seed_keywords.gsc_metrics` (Task 13).
- Found `gsc_404_monitor` (Dilaksi) — a different mechanism (manual CSV
  upload of GSC's 404 export, UK store) — confirmed it is not a duplicate of
  this task and left untouched.
- Searched AIOS for GSC/Search Console/Hetheesha/Sitemap/Indexing/
  Development Tasks/User Access Management/URL Inspection: found Task 13
  and Task 15 (both ledsone.fr, both referenced above) and the GSC 404
  Monitor (Dilaksi, UK, unrelated mechanism). No existing "indexing monitor"
  documentation existed; this is a new task record (Task 16), not a
  duplicate.

## Reuse, not duplication

- **GSC authentication**: reused `google_client.get_gsc_ledsone_fr_access_token`
  — no new credential, no new OAuth code.
- **Per-URL indexing verdicts**: reads the SAME `structured_data_validation_gsc_inspections`
  table Task 15 writes to, and can add to it via the SAME `choose_sample`/
  `run_inspections` helpers — one shared Search Console quota budget across
  both tasks, not a second one.
- **Sitemap URL list + template**: reused `structured_data_validation.discovery.discover_urls()`
  as-is.
- **High-value signal**: reused Task 13's already-stored GSC impressions
  (`french_keyword_research_seed_keywords.gsc_metrics`) instead of adding a
  new external data source.
- **Access control**: reused `auth.verify_token` + `access_grants` (same
  model as `structured_data_validation.authorization`), new task key
  `tools.DevSearchConsoleIndexingMonitor`.
- **UI**: reused the shared `jreq-*` CSS classes (cards, table, pills,
  tabs, modal) already used by every other Development Task page; only a
  small `SearchConsoleIndexingMonitor.css` was added for page-specific
  pieces (priority boxes, action-flow steps) that have no existing class.
- **Sync Monitor**: registered as a `ScheduledSnapshot` exactly like Task 15
  (weekly, Run Now, `resume_if_interrupted=True`).
- **New, not a duplicate**: the GSC Sitemaps API call (`sitemaps.list`) is
  genuinely new — no existing code reads that endpoint; it is real Search
  Console data, separate from crawling the sitemap XML ourselves.

## Files created

Backend — `backend/app/dev_tasks/search_console_indexing/`:
`__init__.py`, `authorization.py`, `schema.py`, `sitemaps_api.py`,
`value_signal.py`, `detection.py`, `pipeline.py`, `trends.py`, `router.py`,
`scheduler.py`.

Frontend:
`frontend/src/admin/pages/dev-tasks/SearchConsoleIndexingMonitor.jsx`,
`frontend/src/admin/pages/dev-tasks/SearchConsoleIndexingMonitor.css`.

## Files modified

- `backend/app/dev_tasks/__init__.py` — import, `include_router`, and
  `start_dev_task_snapshots()` line (4-line shape, same as every other task).
- `frontend/src/taskRegistry.js` — one entry, task key
  `tools.DevSearchConsoleIndexingMonitor` (this is what makes the task
  appear in User Access Management — no separate UAM file exists).
- `frontend/src/admin/AdminLayout.jsx` — nav child + `LazyPanel`.
- `frontend/src/dev/DevLayout.jsx` — nav child, page `LazyPanel`, and a
  Sync Monitor sub-tab + panel (`sync-monitor-search-console-indexing`).
- `frontend/src/admin/pages/SalesSyncMonitor.jsx` — scope registration
  (`search-console-indexing` -> staff/tab/label), same shape as every other
  scope in that file.

## API routes (`/api/dev/search-console-indexing`)

- `GET /overview` — KPI counts, priority breakdown, exclusion-reason
  breakdown, sitemap errors, "not yet checked" count.
- `GET /run/status`, `POST /run` (protected: `require_task_access`) —
  starts a background check; Phase 1's only "action", and it only reads.
- `GET /sitemaps` — real GSC Sitemaps API data.
- `GET /issues` — filtered/paginated issue list (priority, template,
  indexed/not-indexed, search, pagination).
- `GET /url-detail` — the detail-drawer payload (priority, reason, why it
  matters, source, detected date, Next Action steps).
- `GET /trends` — current-vs-previous-period comparison, or "Historical
  comparison unavailable" honestly when there is no earlier snapshot.

## Detection rules implemented

- A URL's `indexed` state is read literally from Search Console's
  `coverageState` (`Submitted and indexed` / `Indexed, not submitted in
  sitemap` = indexed; anything else = not indexed). The `gsc_reason` shown
  to the user is always that exact Google string — never invented or
  reworded.
- URLs Search Console has not been asked about yet are excluded from the
  counts and never guessed at; the Overview banner states how many of the
  sitemap's URLs are still unchecked and that URL Inspection is
  quota-limited.
- A fetch/inspection error for a URL is shown as its own MEDIUM issue with
  "Data unavailable from Search Console API" instead of being silently
  dropped or mis-classified.

## Priority rules implemented (`detection._priority`)

- **NO_ACTION**: indexed; or an explicitly intentional exclusion
  (`Alternate page with proper canonical tag`, `Excluded by 'noindex' tag`,
  `Blocked by robots.txt`, `Page with redirect`).
- **HIGH**: Soft 404 or a 5xx server error on a high-value page; any
  not-indexed URL that is high-value (see below).
- **MEDIUM**: Soft 404 / 5xx on a low-value page; `Crawled — currently not
  indexed` or `Discovered — currently not indexed` on a low-value page;
  any `Duplicate...` state.
- **LOW**: anything else not indexed.

## High-value URL logic

A URL counts as high-value when it already has at least 10 total Search
Console impressions recorded in Task 13's stored data. If NO impression
data exists anywhere yet (Task 13 hasn't populated `gsc_metrics` for this
store), the page falls back to the dashboard's existing SEO priority
convention: Homepage/Collection/Product pages are treated as high-value,
Blog/Page are not. This fallback is a labelled, existing convention, not an
invented signal — see `value_signal.is_high_value`'s docstring.

## Historical trend logic

A new table, `public.search_console_indexing_daily_snapshot`, records one
row per calendar day (sitemap URL count, checked count, indexed,
not-indexed, 5xx count, priority counts, exclusion-reason counts) each time
the monitor runs. `/trends` compares today's row against the most recent row
at least 7 days old. With only one day of data (today, the first run), there
is nothing to compare against, so the endpoint correctly returns
`"available": false, "reason": "Historical comparison unavailable"` — this
was confirmed by reading the code path, not by observing 7 days of real
data (see Known Limitations).

## Tests performed

- `python -m py_compile` and `ast.parse` on all 10 new backend files: PASS.
- `npx vite build`: PASS (no new errors; only the pre-existing
  informational `INEFFECTIVE_DYNAMIC_IMPORT` warning shared by every other
  Development Task page, unchanged in nature).
- A full `import app.dev_tasks` (to exercise every route registration and
  every `ScheduledSnapshot` construction) was attempted locally but could
  not complete: this dev machine has no live Postgres connection, and an
  UNRELATED existing task (`collection_thin_content`) opens a real database
  connection at import time before this task's own import is ever reached.
  This is a pre-existing limitation of testing this backend outside the
  server, not something introduced by this change; it was hit the same way
  earlier in this project's history for other tasks.
- No live run against the real ledsone.fr Search Console property was
  performed from this session (no server access from here). See Known
  Limitations and Manual Checks Remaining in the handover.

## Known limitations

1. **No bulk index-coverage export exists in the public Search Console
   API.** The "Excluded" reason breakdown you see in the Search Console UI
   has no API. This task's reasons come only from the URL Inspection API,
   one URL at a time, bounded by the same ~2,000/day quota Task 15 already
   uses — shared, not doubled, but still bounded. Sitemap URLs that have
   never been inspected (by either task) show as "not yet checked", not as
   an issue.
2. **Sitemaps API "submitted/indexed" counts** are Google's own aggregate
   per sitemap file, not a per-URL list — shown as-is on the Sitemaps tab.
3. **High-value fallback** uses template type only when Task 13 has no
   impression data yet for this store; it is not GA4 or revenue data
   (neither is currently wired into a page-URL-keyed dataset in this
   project for ledsone.fr).
4. **Trend requires 7+ days of runs** before it can show anything; day one
   correctly shows "Historical comparison unavailable".
5. Not deployed; not run against live Search Console from this session.

## References

Related: [[2026-09-25_task15-structured-data-validation_evidence]],
[[2026-09-25_task13-post-phase10-changes_evidence]].
