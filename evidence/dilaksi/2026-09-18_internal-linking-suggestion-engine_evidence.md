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

## UPDATE (2026-09-18, later) — Local dev environment set up + bugs found/fixed + blog fetch built

User set up a local dev environment (backend + frontend running on this machine) to verify the task before
deploying, instead of testing directly on the production server as had been the pattern. Work done:

### Local environment
- Backend started locally: `venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8199`.
  Connects to the SAME production Postgres (`158.220.99.127`) as the deployed server — there is no
  separate local/test database in this project. This is safe for this task specifically because Step 01
  is read-only against Shopify and only writes to the new `internal_linking_content_index` table.
- Frontend started locally: `npx vite --port 5199` (matches `backend/.env`'s `CORS_ORIGIN=http://localhost:5199`
  — the default Vite port 5173 does NOT match and causes a CORS "Failed to fetch" on login).

### Bugs found and fixed during local setup (environment-only, not app logic bugs)
1. **CORS port mismatch** — first local frontend run used Vite's default port 5173, but
   `backend/.env`'s `CORS_ORIGIN` is pinned to `5199`. Fixed by starting Vite with `--port 5199`.
2. **Duplicate/orphaned local processes** — an earlier failed backend start attempt left a stale extra
   uvicorn process running, and an old frontend instance was still bound to port 5173. Both killed;
   confirmed only one backend + one frontend process remained.
3. **`--reload` self-restart loop** — running uvicorn with `--reload` while its own stdout log file
   (`backend_local.log`) lived inside the watched `backend/` folder caused every log write to trigger a
   reload, killing in-flight requests intermittently ("Failed to fetch" appearing randomly across
   unrelated pages, not specific to this task). Fixed by dropping `--reload` for local testing and
   writing the log outside the watched folder.
4. **Windows console encoding crash (real, in-app-adjacent)** — `GET /api/dev/internal-linking/content-index`
   returned HTTP 500 locally only. Root cause: Python's default stdout on Windows uses the `cp1252`
   codepage; some real Shopify product/collection titles/descriptions contain Unicode characters that
   crash when the server process tries to log them, killing that request. Fixed locally by starting the
   backend with `PYTHONIOENCODING=utf-8` (a launch-environment fix, not a code change — the deployed
   Linux server's default UTF-8 locale does not have this problem, consistent with the user's report
   that "the deployed system all working").

### Blog data source — resolved (scope gap fixed at the source, not worked around)
- User provided Shopify Admin screenshot showing real blog posts exist (Content → Blog posts, multiple
  visible posts under blog "BLOG"), prompting a second live audit rather than trusting the earlier
  2026-09-17 hetheesha.py finding as still current.
- Re-ran a live GraphQL call from this session against the `ledsone_uk` token: confirmed `ACCESS_DENIED`
  for the `blogs` field STILL held as of 2026-09-18 (the finding was current, not stale) — the blogs
  genuinely exist in Shopify, but the configured Admin API token lacked the scope to read them.
- Per user instruction, this was fixed at the source: the user is adding `read_content` to the SAME
  existing Shopify custom app's scopes (not creating a new app/integration), using an existing local
  OAuth helper script (`C:\shopify-token\server-uk.js`, outside this repo) to reissue the Admin API token
  for `ledsone.myshopify.com` with the added scope. Guided the user through: adding `read_content` to that
  script's `SCOPES` constant, running it, completing the OAuth authorize flow, and updating
  `backend/.env`'s `SHOPIFY_UK_ADMIN_TOKEN` with the new token themselves (never had the user paste the
  token or client secret into this chat).
- `content_fetch.fetch_blog_pages()` was then implemented for real (previously a documented no-op
  returning `[]`): queries Shopify's `blogs { articles { ... } }` GraphQL objects via the SAME
  `shopify_client.graphql()` call every other fetch in this package uses — no new client. Maps each
  article to a content-index row (URL, title, content, publishedAt) exactly like Product/Collection rows.
  Deliberately does NOT catch `ACCESS_DENIED` and fall back to `[]` — if the scope is ever revoked, this
  now fails loudly (matching how every other dev task's Shopify call fails) instead of silently reporting
  "no blog data exists" again.
- As of this update, the scope grant had not yet been confirmed live (still `ACCESS_DENIED` on last
  re-check) — code is ready and compiles, but has not yet been exercised against a successful blog fetch.
  See validation doc for current PASS/FAIL/PARTIAL status of this specific item.

### No secrets (reaffirmed)
The OAuth helper script's Client ID/Client Secret and the Shopify Admin API token itself are NOT recorded
anywhere in this AIOS update — only that "the existing Shopify custom app's token was reissued with
`read_content` added" is documented, per the standing AIOS rule.

## UPDATE (2026-09-18, later) — Production `.env` token update performed by the user

User applied the reissued Shopify Admin API token directly on the production server (Contabo VPS), method:

1. `ssh root@158.220.99.127`, `cd /var/www/dashboard-dm/backend`
2. `cp .env .env.backup-$(date +%Y%m%d-%H%M%S)` — timestamped backup taken before editing, so the prior
   token is recoverable if anything went wrong
3. `nano .env` — replaced `SHOPIFY_UK_ADMIN_TOKEN`'s value with the newly reissued token (containing
   `read_content` in addition to the existing scopes), saved
4. `sudo systemctl restart dm-dashboard`
5. `sudo systemctl status dm-dashboard` — confirmed `active (running)`, fresh PID, clean startup log
   (`Started server process` → `Application startup complete` → `Uvicorn running`)

### Correction: production backend port is 8499, not 8199
While verifying the restart, the `systemctl status` output showed the real production uvicorn command as
`--host 0.0.0.0 --port 8499`. This session's earlier deploy-verification `curl` instructions incorrectly
assumed port 8199 (the LOCAL dev port used on the user's own PC in this same session) — those curls
against the production server returned nothing because 8199 isn't the port that server listens on.
Corrected to port 8499 for all further production-side verification commands
(`POST /api/dev/internal-linking/content-index/refresh` and
`GET /api/dev/internal-linking/content-index/refresh/status` against `localhost:8499`).

No secrets (token value, backup file contents) were pasted into chat or recorded here — only the
method/commands used.

## UPDATE (2026-09-18, later) — Blog fetch fixed, tested live, and pushed

Production ran a refresh right after the token update but still showed `blogPages: 0` — root cause was
NOT the token: the blog-fetch code itself had never been pushed past this session's local machine, so
production was still running the prior documented no-op. Separately, while testing the code locally
against the (now-working) token, two real query bugs surfaced and were fixed before pushing:

1. **Outer `blogs` connection wasn't paginated.** A live query revealed LEDSone's store has several
   `blogs` objects beyond the one visible "BLOG" channel (legacy/near-duplicate blog objects with 0-1
   articles each) — `blogs(first: 50, after: $after)` is now paginated the same way products/collections
   already are, so nothing past the first page is silently dropped.
2. **Wrong field/query names**, caught via live GraphQL schema introspection against the real store
   (`__type(name: "Article")`): Article has no `legacyResourceId` or `contentHtml` field (those exist on
   Product, not Article) — corrected to `body` for content and the article's GID (`id`) for the source
   identifier. There is also no `blogByHandle` root query — corrected to `blog(id: $blogId)` for paginating
   a single blog's articles past the first page.
3. Verified fully end-to-end against live production Shopify + the real Postgres DB from this local
   machine: `fetch_blog_pages()` returned 159 real blog articles (real titles/URLs/content, e.g. "How
   Energy-Saving Light Bulbs Save Both Energy and Money?"); full content index rebuild confirmed
   `{totalIndexedPages: 5938, blogPages: 159, productPages: 5289, collectionPages: 490}`.
4. Compiled (`py_compile`) and built (`vite build`) cleanly, then committed and pushed to `dev-work`
   (commit `128fa03`). Not yet merged to `main`/deployed as of this update — that remains the user's step.

Blog Pages is therefore no longer a documented limitation once this commit is deployed — Step 01 now
indexes all three page types (Product, Collection, Blog) from real, live Shopify data.
