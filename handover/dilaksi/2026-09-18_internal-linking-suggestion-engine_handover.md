# Handover — Internal Linking Suggestion Engine — Page Creation + Step 01 Content Index

Date: 2026-09-18
Owner: Dilaksi
Reviewer: Kuberan

## What was implemented

A new Development Task page, "Internal Linking Suggestion Engine," for ledsone.co.uk. Only **Page
creation + UAM + Routing + Step 01 (Content Index)** were built, per explicit scope limit — Steps 02–05
are visible in the UI as locked/coming-soon and have no backend implementation.

## Page location / route

- Admin panel → Development Tasks → "Internal Linking Suggestion Engine"
- Sidebar/tab key: `dev-task-internal-linking`
- Same tab-based routing as every other Development Task (no new route architecture)

## UAM / task key

- `taskKey: 'tools.DevInternalLinkingSuggestionEngine'` in `frontend/src/taskRegistry.js` (generic
  Development Tasks pattern, same shape as GSC 404 URL Monitor / Meta Title & Description Audit / etc.)
- To give Dilaksi access from her own portal, toggle this task ON for `dilaksi` in the existing
  User Access Management admin page — no new UAM mechanism was built.

## Data sources used

- Products + Collections: existing Shopify Admin API integration (`shopify_client.graphql`, store
  `ledsone_uk`), read-only `Query` operations only.
- Blog: **not available**. No authoritative existing source for LEDSone blog content exists in this
  project (Shopify token lacks `read_content` scope, confirmed via a prior live GraphQL call documented
  in `hetheesha.py`; no CMS/DB/crawl infra exists). Documented as a limitation, not scraped or fabricated.
- Target keywords: not available from any existing reliable source; always shown as "Not available."

## Content-index logic

`backend/app/dev_tasks/internal_linking/content_fetch.py` fetches all products/collections via paginated
GraphQL, strips HTML to plain text for `content_text`, normalizes each URL (`normalize_url`) for
dedup/matching while preserving the original URL, and upserts into Postgres keyed by `(page_type,
source_id)` so a refresh updates existing rows rather than duplicating them.

## Database changes

New table: `public.internal_linking_content_index` (see `schema.py` for full column list — page_type,
source_id, original_url, normalized_url, page_title, content_html/text, content_available,
target_keywords, shopify_status, product_type, published_at, retrieved_at, timestamps). No existing table
was altered.

## Backend endpoints (Step 01 only)

- `GET /api/dev/internal-linking/content-index` — read stored index + summary
- `POST /api/dev/internal-linking/content-index/refresh` — trigger a live rebuild (non-blocking,
  background thread, same `BackgroundJob` pattern used elsewhere)
- `GET /api/dev/internal-linking/content-index/refresh/status` — poll for completion

No Step 02–05 endpoints exist anywhere in this codebase.

## Frontend files

- New: `frontend/src/admin/pages/dev-tasks/InternalLinkingSuggestionEngine.jsx`
- Edited (triple-registration): `frontend/src/taskRegistry.js`, `frontend/src/admin/AdminLayout.jsx`,
  `frontend/src/dev/DevLayout.jsx`
- Edited (backend aggregator): `backend/app/dev_tasks/__init__.py`

## Current status

Implementation complete and scope-compliant. Compiles (`py_compile`) and builds (`vite build`) cleanly.
Not yet deployed or clicked through in a live browser (this session has no server/SSH access — deploy is
the user's normal `dev-work` → merge → `git pull` + `npm run build` + restart flow).

## Known limitations

- Blog Pages will always show 0 until an approved blog data source is added to the project.
- Target Keywords will always show "Not available" until a reliable keyword source is wired up.
- UAM grant to Dilaksi has not been toggled on yet — a live admin-UI action for the user.
- No live end-to-end click-through against production data performed this session.

## Remaining Steps 02–05

Not implemented, per explicit scope limit. Future work (separate tasks): Step 02 — Scan for Link
Opportunities, Step 03 — Check Existing Link Density, Step 04 — Generate Suggestions, Step 05 — Handoff
for Implementation. Each should follow the same audit-first, no-fabrication discipline established here.

## Next step

User deploys `dev-work` → `main`, runs the server-side rebuild, grants `dilaksi` the
`tools.DevInternalLinkingSuggestionEngine` task in UAM, then clicks "Refresh Content Index" once live to
confirm real product/collection data populates the table.

## UPDATE (2026-09-18, later)

- A local dev environment (backend on `:8199`, frontend on `:5199`, both against the SAME production
  Postgres — this project has no separate local DB) was set up to let the user verify this task before
  deploying, instead of testing directly on the live server. Two local-only environment bugs were found
  and fixed (a `--reload` self-restart loop from watching its own log file, and a Windows `cp1252`
  console-encoding crash on real Shopify Unicode content) — neither affects the deployed Linux server,
  confirmed by the user ("the deployed system all working").
- Blog data source gap resolved at the source rather than left as a permanent limitation: the user
  confirmed blog posts genuinely exist in Shopify Admin, and is adding the `read_content` scope to the
  SAME existing Shopify custom app (via its own OAuth token-reissue script, outside this repo) rather than
  a new integration. `content_fetch.fetch_blog_pages()` has been implemented for real (was a documented
  no-op) and is ready to populate Blog Pages the moment the reissued token is saved into `backend/.env`.
  As of this update, `ACCESS_DENIED` was still returned on the last live check — status is PARTIAL until
  the new token is confirmed working (see validation doc's UPDATE section).
- Current status is therefore: Product + Collection indexing fully working and locally verified; Blog
  indexing code-complete but pending the token/scope update on the user's side.
