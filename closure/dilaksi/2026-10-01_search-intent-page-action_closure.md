# Closure — Search Intent → Page Action (Dilaksi)

**Date:** 2026-10-01
**Developer:** Kuberan
**SEO task owner:** Dilaksi
**Location:** DM Dashboard → Development Tasks → "Search Intent → Page Action (Dilaksi)"

## Requirement

Find GSC queries where the search intent doesn't match the type of page
currently ranking for it, and turn that into an actionable, trackable SEO
task list, per the AIOS task spec "DM DASHBOARD — DILAKSI — SEARCH INTENT →
PAGE ACTION".

## What was already available (reused, not duplicated)

- Real, already-populated GSC query+page data: business DB,
  `google_search_console.query_page` (site_url, date, query, page, clicks,
  impressions, ctr, position) — 8 real sites, 2025-03-24 through 2026-09-28,
  confirmed live. The app DB's `gsc_live`/`google_search_console` schemas
  referenced in `backend/app/gsc_live_sync.py` exist only in code — those
  tables have never actually been created/populated in production, so they
  were **not** used; `google_search_console.query_page` was used instead,
  since it's the real source already powering the business's GSC reporting.
- Existing dev-task package convention (`backend/app/dev_tasks/__init__.py`
  aggregation pattern) — followed exactly, no new wiring pattern invented.
- Existing `jreq-*` CSS/component conventions from `dashboard.css` and
  sibling dev-task pages (`ContentGapAnalysis.jsx`, `ProductOwnership.jsx`)
  — table, filter bar, KPI cards, pill badges, right-side detail drawer all
  reuse these classes directly; no new design system.
- Existing `get_business_conn()` / `get_conn()` DB helpers.
- Existing "Development Tasks" flat sub-nav pattern in `DevLayout.jsx` (every
  sibling dev task, including several already owned by Dilaksi —
  Collection Thin-Content Detector, Internal Linking, Content Gap Analysis —
  lives as a flat entry there, not nested under a per-staff menu level).
  The requested "Development Tasks → Dilaksi → ..." path is implemented as
  the page's own breadcrumb text plus a visible "Developer: Kuberan" line,
  matching how ownership is shown elsewhere, rather than adding a new nested
  navigation level that doesn't exist anywhere else in the dashboard.

## What was newly implemented

**Backend** — `backend/app/dev_tasks/search_intent_page_action/`:
- `classify.py` — deterministic (no AI) rules: `classify_intent` (keyword
  patterns, checked Navigational → Informational → Commercial →
  Transactional, with a documented Transactional fallback for queries
  matching no pattern), `classify_page_type` (URL path only), `compute_match`
  (the task's own intent→page-type appropriateness table), and
  `compute_priority_and_action` (the exact HIGH 1/2, MEDIUM 3/4/5/6,
  MONITOR, NO ACTION rules from the spec, each returning its own
  recommended-action text — never one hard-coded message for every row).
- `schema.py` — one table, `public.search_intent_page_action_task`
  (site, query, page, owner, due_date, status), the only new storage; it
  holds task-tracking fields only — nothing from GSC is duplicated into it.
- `router.py` — `GET /sites` (real sites found in the live data, not
  hard-coded), `GET /weeks` (real available week-starts for the chosen
  site), `GET /summary` (KPI counts), `GET /queries` (filtered, searched,
  paginated), `GET /queries/detail` (full detail + real before/after vs the
  nearest available earlier/later week, `null`→`"-"` in the UI when no such
  week exists — never fabricated), `POST /task` (owner/due-date/status
  upsert).
- Wired into `dev_tasks/__init__.py` exactly like every sibling task
  (router include + `ensure_schema` call), no new aggregation pattern.

**Frontend** — `frontend/src/admin/pages/dev-tasks/SearchIntentPageAction.jsx`:
- Breadcrumb + header with visible "Developer: Kuberan", Refresh, Last
  updated.
- Filter bar: Site, Week, Intent, Page Type, Match, Priority, free-text
  search, and a configurable impression Threshold (not hard-coded in
  multiple places — one number flows through to both the summary and
  queries calls).
- 4 real KPI cards (High / Medium / Monitor / No action), computed from the
  live classified data, not fake numbers.
- Main table: Query, Landing Page, Clicks, Impressions, Position, Intent,
  Page Type, Match, Priority, Status — pill badges for the categorical
  columns, a "split" badge when a query ranks more than one page in the
  same week.
- Right-side detail drawer: full stats, the "why" reason text, a
  Recommended Action card that changes per row (not static), the real
  Before→After table, an "Open in Search Console" link (clearly a manual
  action — the dashboard never claims to request indexing itself), and the
  Owner/Due date/Status editor that calls `POST /task`.
- Pagination (server-side; the frontend never loads a whole site-week of
  GSC rows at once).
- Registered in `DevLayout.jsx` under the existing "Development Tasks" list
  (`dev-task-search-intent-page-action`), lazy-loaded like every sibling tab.

## Performance design (documented, not hidden)

Classifying every query+page pair in a site-week in Python would mean
pulling potentially tens of thousands of rows per request. To keep this
fast and avoid loading noise, the aggregation SQL itself filters to
`SUM(impressions) >= MIN_ROWS_FLOOR` (5) before any row is classified in
Python; of those, the task's own 50+ impression threshold (configurable via
the UI) then decides whether a mismatch is High/Medium-actionable or
Monitor. A query with 1-2 impressions in a week is real data but isn't
worth classifying every week — this is a pragmatic, stated limitation, not
missing functionality.

## Live deployment — real bug found and fixed

First live deployment crashed with `500 Internal Server Error` on every
endpoint. Server traceback (`journalctl -u dm-dashboard`) pinpointed it
exactly: `router.py` line 50, `list_sites`, `KeyError: 0` on
`{r[0] for r in rows}`. Root cause: both `get_conn()` and
`get_business_conn()` (`backend/app/db.py`) are configured with psycopg's
`dict_row` factory — every fetched row is a dict keyed by column name,
never a plain tuple. The router was written throughout assuming tuple
rows (`r[0]`, `for a, b, c in rows`). Fixed every row-access point across
`list_sites`, `list_weeks`, `_fetch_and_classify`, `list_queries` and
`query_detail` to use dict-key access, and added explicit `AS` aliases to
the `query_detail` aggregate queries that previously relied on Postgres's
implicit column naming. Confirmed fixed live after redeploy — Site/Week
dropdowns populate with real data, no further 500s.

This is exactly the gap flagged under "Known limitation" below before
deployment (no live smoke test possible from the dev machine) — deploying
and checking it for real is what caught this, underscoring why that
caveat was called out rather than claiming the task was fully verified
beforehand.

## Access control

Registered in `frontend/src/taskRegistry.js` (`dilaksi.SearchIntentPageAction`)
so it can be granted to other staff via the admin User Access Management
matrix, using the same mechanism as Dilaksi's other task pages — no new
access-control system built.

## Validation performed

- `classify.py` unit-tested in isolation against the task spec's own worked
  examples (the "how to choose a chandelier size" / "best led pendant
  lights" / "buy black pendant light" / "ledsone pendant lights" / bare
  "pendant lights" cases) — all 5 produced the exact intent/page-type/
  match/priority the spec itself describes.
- The exact aggregation SQL used by the router was run live against the
  real business DB (`google_search_console.query_page`) and returned
  correct, sensible real rows for ledsone.co.uk.
- `python -m py_compile` clean on all new/modified backend files.
- `npx vite build` clean — no new errors or warnings (pre-existing
  `INEFFECTIVE_DYNAMIC_IMPORT` warnings on unrelated pages are unchanged).
- **Not performed / known gap:** a full live request through the actually
  running FastAPI app on this development machine. Starting `uvicorn`
  locally hung without binding a port or producing output, consistent with
  the business DB's documented hard connection cap / network restriction to
  the production server rather than a code defect — the underlying SQL and
  classification logic were each verified independently instead (see
  above). This should be confirmed with one real click-through once
  deployed, before marking this fully done end-to-end.

## Known limitations

- Only sites with real GSC data already in `google_search_console.query_page`
  are selectable (`/sites` reflects live data, never a hard-coded list) —
  currently ledsone.co.uk, ledsone.us, ledsone.de, ledsone.fr, dcvoltage.co.uk,
  vintagelite.co.uk, electricalsone.co.uk, besbet.co.uk.
- The Transactional fallback for unmatched queries (section in `classify.py`'s
  docstring) is a documented design decision, not a hidden guess — worth a
  look if Dilaksi finds it miscategorising a real query pattern.
- No live end-to-end smoke test from this dev machine (see Validation above)
  — recommend one real pass after deployment.
- Brand/navigational detection uses a small hard-coded token list per site
  (`BRAND_TOKENS` in `classify.py`) rather than reading a brand name from a
  config table — no such table exists yet to reuse; flagged for future
  reuse if one is added.

## Files changed

- `backend/app/dev_tasks/search_intent_page_action/__init__.py` (new)
- `backend/app/dev_tasks/search_intent_page_action/classify.py` (new)
- `backend/app/dev_tasks/search_intent_page_action/schema.py` (new)
- `backend/app/dev_tasks/search_intent_page_action/router.py` (new; fixed post-deployment, see above)
- `backend/app/dev_tasks/__init__.py` (modified — wiring)
- `frontend/src/admin/pages/dev-tasks/SearchIntentPageAction.jsx` (new)
- `frontend/src/dev/DevLayout.jsx` (modified — nav entry + lazy import)
- `frontend/src/taskRegistry.js` (modified — User Access Management grant entry)

Commits: `ce2b20c` (initial build), `1b60b37` (dict_row fix), `5d018d6`
(User Access Management registration). All on `dev-work`, merged to
`main` and deployed.

## Status

**Deployed and working.** Site/Week dropdowns populate with real data,
the 500 error from the dict_row bug is fixed and confirmed live. Granted
via User Access Management like Dilaksi's other tasks. Open items: decide
whether the 5-impression floor (`MIN_ROWS_FLOOR`) should be removed per
a request to show literally every row with no limit (currently
unresolved — tradeoff explained to the user, awaiting their decision);
no automated test suite exists for this task (matches the rest of the
codebase, not a new gap).
