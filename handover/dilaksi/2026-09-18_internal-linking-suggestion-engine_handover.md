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

## UPDATE (2026-09-18, later) — Production token updated by user

User applied the reissued `SHOPIFY_UK_ADMIN_TOKEN` (with `read_content` added) directly on the production
server: SSH in, backed up `.env` (timestamped copy), edited `.env` with the new token, restarted the
`dm-dashboard` systemd service, confirmed `active (running)` with a clean startup log. Corrected a port
mix-up found during this step: production actually runs the backend on **8499**, not 8199 (8199 was this
session's local dev port on the user's own PC) — all production-side verification commands were updated
to target `localhost:8499`. Awaiting the `refresh`/`refresh/status` output from the user to confirm the
live blog fetch actually succeeds against the new token.

## UPDATE (2026-09-18, later) — Blog indexing complete, pushed to dev-work

Root cause of the still-0 blog count after the token update: the blog-fetch code had only existed on this
local machine, never pushed. While testing it locally with the now-working token, two real bugs were
found and fixed (outer `blogs` pagination missing; wrong Article field/query names — `body`/`id` instead
of `contentHtml`/`legacyResourceId`, and `blog(id:)` instead of a nonexistent `blogByHandle`). Verified
end-to-end against live production Shopify + Postgres: 159 real blog articles indexed
(`{blogPages: 159, productPages: 5289, collectionPages: 490, total: 5938}`). Committed and pushed to
`dev-work` as `128fa03`. Step 01 now covers all three page types with zero fabricated data. Remaining
before this is fully closed: merge `dev-work` → `main`, deploy, re-run refresh on production, and grant
Dilaksi UAM access.

## UPDATE (2026-09-18, later) — Step 02: Find Link Opportunities

**What was implemented:** a deterministic (non-AI) phrase-matching engine that scans Step 01's Content
Index for internal-link opportunities — a source page's content is checked for other indexed pages' exact
titles or product types; matches that aren't already linked and aren't self-links become opportunities,
deduplicated per source→target→anchor combination.

**Where:** `backend/app/dev_tasks/internal_linking/link_opportunities.py` (new), wired into the existing
`router.py`/`schema.py` in the same package. Frontend: same `InternalLinkingSuggestionEngine.jsx` file,
now with a Step 01/Step 02 tab switcher — no new page.

**API endpoints:** `POST /api/dev/internal-linking/opportunities/scan`,
`GET .../opportunities/scan/status`, `GET .../opportunities`.

**Database changes:** two new tables — `internal_linking_opportunities` (scan output, replaced each scan)
and `internal_linking_opportunity_scans` (append-only stats log for the summary cards).

**Data sources:** none new — reads only from the existing `internal_linking_content_index` table built by
Step 01. No Shopify call in this module.

**Matching logic:** page titles (≥2 words, generic ones like "Sale"/"New" excluded) and Product
`product_type` values become anchor phrases; source content is tokenized once and checked via O(1)
dictionary lookups per n-gram window (not a brute-force regex — see evidence doc for why that was
rejected after live timing).

**Confidence logic:** fixed, documented, non-AI score — 90 for an exact title match, 60 for a product-type
match. Explicitly not presented as an SEO/Google ranking signal anywhere in the UI or code.

**Current status:** code-complete, pushed to `dev-work` (`952dbe2`), compiles and builds cleanly. **Not
yet confirmed working end-to-end with real output** — the user is testing live on the deployed server
rather than locally; awaiting that result.

**Known limitations:**
- Existing-link check confirms the source links to the target's URL somewhere on the page, not that this
  specific anchor occurrence is wrapped in that link (documented in the module docstring).
- Matching is exact-phrase based (title/product_type), not semantic — a topic discussed in different words
  than any indexed title won't be found. This is the honest limitation of a non-AI, transparent-scoring
  approach as required by the task spec.
- Blog pages contribute their title as a candidate anchor phrase but are not yet a rich phrase source
  beyond that (no keyword extraction from blog body content) — acceptable for "find opportunities," to be
  revisited if Step 04 needs richer signals.

**Remaining Steps 03-05:** not implemented. Step 03 (link-density analysis), Step 04 (suggestion/ranking),
Step 05 (handoff) all still to come as separate tasks.

**Next step:** user runs "Find Link Opportunities" live on the deployed server and reports the result
(timing + summary numbers); if it performs well, Step 02 validation moves from PARTIAL to PASS.

**Owner:** Dilaksi. **Reviewer:** Kuberan.

## UPDATE (2026-09-18, later) — Step 03: Check Existing Link Density

**What was implemented:** per-page link-density measurement — total internal link occurrences, unique
targets, per-type breakdown (Product/Collection/Blog), self-links tracked separately — against ONE
documented threshold rule (not a priority engine).

**Where:** `backend/app/dev_tasks/internal_linking/density_rules.py` (new, the threshold logic) and
`link_density.py` (new, the calculation), same package. Frontend: third tab on the same
`InternalLinkingSuggestionEngine.jsx` page.

**API endpoints:** `POST /api/dev/internal-linking/density/calculate`,
`GET .../density/calculate/status`, `GET .../density`.

**Database changes:** new table `internal_linking_density` (replaced per calculation).

**Data sources:** the existing Step 01 Content Index only — no new fetch.

**Link-counting logic:** reuses Step 02's href parser (a real external-link bug was found and fixed here —
see evidence doc — external links were previously mis-counted as internal). Total occurrences and unique
targets are tracked separately; self-links are excluded from both and counted on their own.

**Density rules used:** audited the whole project and AIOS — no existing internal-link threshold or
cornerstone rule exists anywhere. The threshold used (3 minimum, 30 review-max) is explicitly labeled a
project-configuration default, not an SEO fact, and every analyzed row records exactly which
threshold/source it was measured against. Cornerstone status always reads "Not Available."

**Current status:** code-complete, pushed to `dev-work` (`5a5d58b`), compiles and builds cleanly. **Not
yet confirmed working end-to-end live** — same pending-user-test status as Step 02.

**Known limitations:** cannot distinguish editorial content links from template-injected (navigation/
footer) links baked into the same stored HTML — no existing data makes that distinction; cornerstone
classification is unavailable project-wide, not just for this step.

**Remaining Steps 04-05:** not implemented. Step 04 (Generate Suggestions/ranking) and Step 05 (Handoff)
still to come as separate tasks — they should build on Step 02's opportunities and Step 03's density data
rather than re-deriving either.

**Next step:** user runs "Calculate Link Density" live and reports timing + summary numbers; validation
moves from PARTIAL to PASS once confirmed. Also still pending from Step 02: the live opportunities-scan
confirmation.

**Owner:** Dilaksi. **Reviewer:** Kuberan.
