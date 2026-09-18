# Evidence — Internal Linking Suggestion Engine — Page Creation + Step 01 Content Index

Date: 2026-09-18
Repo: dm-dashboard (branch: dev-work at time of implementation)

## Audit performed before writing code

- `backend/app/dev_tasks/__init__.py` read — confirmed the dev-task package convention (one sub-package
  per task, each with `router.py`/`schema.py`, aggregated centrally via `include_router`/`ensure_schema`).
- `backend/app/dev_tasks/gsc_404_monitor/schema.py` and `csv_import.py` read — confirmed
  `ensure_schema()`/upsert/URL-normalization conventions to follow exactly.
- `frontend/src/taskRegistry.js` read — confirmed the generic `{ taskKey: 'tools.Dev<Name>', kind: 'tool' }`
  pattern used by every sibling Development Task (Content Gap Analysis, E27 Competitor Analysis,
  AI/GEO Visibility Gap Analysis, Alt Text Keyword Finder, Meta Title & Description Audit, GSC 404 URL
  Monitor), and Dilaksi's separate `ownerStaffKey: 'dilaksi'` personal-page entries (a different, unrelated
  pattern for her OWN staff dashboard pages, not used here since this is a Development Task).
- `frontend/src/admin/AdminLayout.jsx` and `frontend/src/dev/DevLayout.jsx` read — confirmed the exact
  triple-registration shape (import + sidebar `children` entry under `development-tasks` + `<LazyPanel>`).
- `frontend/src/hooks/useGrantedTasks.js` + `backend/app/access_grants.py` read — confirmed UAM is a
  generic `(task_key, granted_to_staff_key)` grant store keyed off `taskRegistry.js`'s `taskKey`; granting
  `tools.DevInternalLinkingSuggestionEngine` to `dilaksi` via the existing UserAccessManagement admin page
  automatically surfaces the page in her own portal (`DilaksiLayout.jsx` already renders any granted TOOLS
  generically via `useGrantedTasks('dilaksi')` — no code change needed there).
- `backend/app/shopify_client.py` read — confirmed `STORES["ledsone_uk"]` and `graphql(store, query, vars)`
  is the one Shopify client used project-wide; reused as-is, no new client created.

### Blog data source audit (critical finding)

- `backend/app/hetheesha.py` (Req 5 — Internal Links Coverage Audit, lines ~603-613) already documents,
  from a **live GraphQL call made in an earlier session**, that the configured Shopify Admin API token
  does NOT have the `read_content` scope required for `blogs`/`articles` GraphQL objects (ACCESS_DENIED).
- Project-wide grep for "blog" across `backend/app` found no CMS/database table/crawl infrastructure that
  holds LEDSone's own blog/article content. The one blog-adjacent table, `public.content_gap_result`
  (`content_type = 'blog'`), stores competitor-gap findings from a scheduled Claude web-search run — not
  an authoritative pull of LEDSone's own blog content — so it is not a valid source for this purpose.
- Conclusion, applied directly in code (`content_fetch.fetch_blog_pages()`): **no authoritative existing
  source for LEDSone blog content exists in this project.** Per explicit instruction, this was NOT
  worked around by scraping the live site. Blog Pages shows 0 in the UI with an explicit, visible
  limitation note — no blog rows are fabricated.

## Files created/changed

Backend (new package `backend/app/dev_tasks/internal_linking/`):
- `__init__.py` — audit-documentation docstring (data source audit, scope note)
- `schema.py` — `public.internal_linking_content_index` table, `ensure_schema()`/`upsert_pages()`/
  `list_pages()`/`summary()`
- `content_fetch.py` — `normalize_url()`, `html_to_text()`, `fetch_products()`, `fetch_collections()`,
  `fetch_blog_pages()` (documented no-op), `build_content_index()` — all Shopify calls are `Query`, never
  a mutation
- `router.py` — `GET /api/dev/internal-linking/content-index`,
  `POST /api/dev/internal-linking/content-index/refresh`,
  `GET /api/dev/internal-linking/content-index/refresh/status` (non-blocking, reuses `BackgroundJob`)

Backend (edited):
- `backend/app/dev_tasks/__init__.py` — added import/include_router/ensure_schema lines + docstring entry

Frontend (new):
- `frontend/src/admin/pages/dev-tasks/InternalLinkingSuggestionEngine.jsx` — 5-step tracker (Step 01
  active, Steps 02–05 visibly locked), KPI cards, filterable/searchable/sortable content-index table,
  loading/empty/error states, documented blog-limitation footnote. Uses only existing `jreq-*` CSS
  classes from `frontend/src/styles/dashboard.css` — no new CSS system.

Frontend (edited, triple-registration, mirroring every sibling dev task exactly):
- `frontend/src/taskRegistry.js` — added `{ taskKey: 'tools.DevInternalLinkingSuggestionEngine', kind: 'tool', ... }`
- `frontend/src/admin/AdminLayout.jsx` — import + `dev-task-internal-linking` sidebar child + `<LazyPanel>`
- `frontend/src/dev/DevLayout.jsx` — same

## Compile/build verification

- `python -m py_compile` on all 4 new backend files + edited `dev_tasks/__init__.py` — passed with no output.
- `npx vite build` (frontend) — succeeded (`✓ built in ~1.5-2.7s`). Only pre-existing
  `INEFFECTIVE_DYNAMIC_IMPORT` warnings appeared, identical in kind to every other dev-task page already
  in the codebase (a taskRegistry dynamic import + a layout static import of the same file) — not a new
  issue introduced by this change.
- Live end-to-end test against the real Shopify store / live server was NOT performed in this session
  (no SSH/server access from this machine — see standing project note); the user deploys and can run a
  live "Refresh Content Index" click themselves after deploying `dev-work`.

## No secrets

No API keys, tokens, or credentials appear in any AIOS file for this task. Shopify access is referenced
only as "existing Shopify Admin API integration reused (store `ledsone_uk`)".
