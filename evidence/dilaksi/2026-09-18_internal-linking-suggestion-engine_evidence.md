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

## UPDATE (2026-09-18, later) — Step 02: Find Link Opportunities implemented

### Audit performed before writing Step 02 code
Re-read the existing Step 01 files in full before touching anything: `schema.py` (table shape, upsert
convention), `content_fetch.py` (`normalize_url`, `html_to_text`), `router.py` (endpoint/BackgroundJob
conventions), and the frontend page. Confirmed Step 02 needs zero new Shopify/blog calls — everything it
needs (title, content_text, content_html, product_type, normalized_url) already exists in
`internal_linking_content_index`. Also reused `backend/app/hetheesha.py`'s existing `_extract_links`
href-parsing pattern (Req5) for existing-link detection, extended with a blog-URL pattern it didn't
previously need.

### What was implemented
New module `backend/app/dev_tasks/internal_linking/link_opportunities.py`:
- `extract_link_targets(html)` — parses `<a href>` tags into `(page_type, handle)` pairs (Product,
  Collection, Blog), same regex-based approach as hetheesha.py's Req5, extended for `/blogs/<blog>/<article>`.
- `_build_phrase_index(pages)` — every indexed page's exact `page_title` and (for Products) `product_type`
  become candidate anchor phrases pointing at that page, EXCEPT phrases under 2 words or on a small
  generic-title denylist (`sale`, `new`, `home`, etc.) — dropped structurally, not just down-scored, per
  the explicit "don't suggest from one shared generic word" requirement.
- `_find_matches(content, phrase_targets, max_words)` — tokenizes each source page's content once and
  checks n-gram windows (2 up to the longest indexed phrase's word count) against the phrase dictionary
  via O(1) lookups. **Performance note (see section 22 of the task):** a compiled single alternation regex
  (`\b(phrase1|phrase2|...)\b`) was tried FIRST and rejected — Python's `re` backtracking engine took
  several minutes against real pages with large embedded HTML/CSS blocks (confirmed via live timing
  against the actual 5,938-row production index). The tokenized dictionary-lookup approach is linear in
  content length regardless of phrase count and was adopted instead.
- `scan_opportunities()` — orchestrates the full pass: self-link exclusion (Step 10, same
  `(page_type, source_id)` key comparison), existing-link exclusion (Step 9), fixed documented confidence
  (90 = exact title match, 60 = product_type match — Step 13, never framed as an SEO/ranking score),
  templated per-opportunity reasons (Step 14), and dedup by `(source, target, anchor lowercase)` with an
  `occurrence_count` (Step 11).
- Storage: `TRUNCATE`-and-replace per scan for `internal_linking_opportunities` (an opportunity has no
  stable identity across scans the way a Shopify product does, unlike Step 01's incremental upsert) plus
  an append-only `internal_linking_opportunity_scans` log row per scan for the Pages Scanned / Potential
  Opportunities summary numbers (these can't be derived from the deduped table alone).

### Documented limitation (not hidden)
The existing-link check verifies the source page links to the target's URL ANYWHERE on the page, not
that this specific anchor occurrence is wrapped in that exact link. A byte-offset-accurate check would
need a full HTML parser tracking tag positions — judged unnecessary complexity for a "surface opportunities
for human review" step; documented in the module's own docstring for Steps 03-05 to revisit if needed.

### Backend endpoints added (under the existing `/api/dev/internal-linking` prefix)
`POST /opportunities/scan` (non-blocking, same `BackgroundJob` pattern as Step 01's refresh),
`GET /opportunities/scan/status`, `GET /opportunities` (list + summary). No endpoints created for
link-density, priority, or handoff — confirmed absent from the router.

### Frontend
`InternalLinkingSuggestionEngine.jsx` (same file, no new page) gained a Step 01/Step 02 tab switcher and
an `OpportunitiesPanel`: 4 summary cards (Pages Scanned, Potential Opportunities, Existing Links Detected,
Opportunities After Deduplication — all from real scan data, no placeholders), a filterable/searchable
table (source/target type, confidence bucket, existing-link status, free-text search across
URL/title/anchor), and a click-through detail modal showing the context snippet and full reason. Steps
03-05 remain visibly locked in the step tracker; no code exists for them.

### Verification performed
- `python -m py_compile` on all 4 backend files — passed.
- `npx vite build` — passed (only the same pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` warning class every
  sibling dev-task page already produces).
- The regex-vs-tokenized performance comparison WAS verified live against the real 5,938-row production
  index from this local machine (confirmed the regex approach was too slow, confirmed the rewrite's design
  is sound) — but the user explicitly stopped further local testing/background runs before a full
  end-to-end timed run of the FINAL tokenized version completed, instructing that live testing on the
  deployed server would be done manually instead. **This session did not observe a completed successful
  scan run with output numbers** — code is pushed and believed correct based on the earlier partial timing
  work and code review, but has not been confirmed working end-to-end. See validation doc for exact PASS/
  PARTIAL status.
- No Shopify write call exists anywhere in this module (grep-confirmed: only `get_conn`/local DB queries
  and pure-Python string/regex operations — no `shopify_client` import at all in `link_opportunities.py`).

### No secrets
No credentials of any kind appear in this update.

## UPDATE (2026-09-18, later) — Step 03: Check Existing Link Density implemented

### Audit performed before writing Step 03 code
Searched the entire dm-dashboard codebase (`cornerstone`, `link_density`, `link density`) and the whole
AIOS documentation repo (`prompts/`, `evidence/`) for an existing internal-linking minimum/maximum
threshold or cornerstone-page classification. **None exist anywhere** — the only prior mention of
"cornerstone" in this project is this task's own Step 01 scope-exclusion note. Found the project's actual
existing convention for this kind of thing instead: plain, clearly-named Python config modules (e.g.
`mahima_stpm_rules.py`, `mahima_stpm_config.py`) — followed that same pattern rather than inventing a new
generic settings/config system.

### Real bug found and fixed while building this step
`link_opportunities.extract_link_targets()` (Step 02) stripped ANY `https://host` prefix before matching
a path, so a link to an EXTERNAL site's `/products/x` page was wrongly counted as an internal Product
link. Fixed by only stripping the host when it's `ledsone.co.uk`/`www.ledsone.co.uk`; any other absolute
host is now skipped entirely as external. Added `extract_link_occurrences()` (keeps duplicates, needed for
Step 03's "total internal links" vs "unique targets" distinction) alongside the existing deduped
`extract_link_targets()`. This fix also improves Step 02's existing-link detection accuracy.

### What was implemented
- `density_rules.py` — the ONE threshold rule (`status_for()`), with `MIN_INTERNAL_LINKS = 3`,
  `REVIEW_MAX_INTERNAL_LINKS = 30`, both explicitly documented as `THRESHOLD_SOURCE =
  "project_config_default"` — never presented as an SEO fact. `CORNERSTONE_STATUS_AVAILABLE = False`,
  documented as to why (no classification exists).
- `link_density.py` — `compute_density()` reads only the Step 01 Content Index (no Shopify/blog call),
  reuses `extract_link_occurrences()` per page, classifies each occurrence as self-link (excluded from
  useful counts, tracked separately) or a real target (counted + typed as Product/Collection/Blog),
  computes unique-target count via a set, and applies `density_rules.status_for()`.
- Schema: `internal_linking_density` table (replaced per calculation, same reasoning as Step 02's
  opportunities table — a page's link count can change between calculations).
- Router: `POST /density/calculate` (non-blocking, `BackgroundJob`), `GET /density/calculate/status`,
  `GET /density`.
- Frontend: third tab on the same page, 7 real summary KPIs (Pages Analyzed, Pages With Few Internal
  Links, Pages With Sufficient Links, Pages Requiring Review, Pages With No Internal Links, Total Internal
  Links, Unique Internal Targets), filterable/searchable table, and a detail modal that states the exact
  threshold/status explanation per page (e.g. "X internal links detected. Configured minimum is 3, review
  threshold is 30 (source: project_config_default). Page is marked Needs Attention.").

### Documented limitation (not hidden)
Cannot distinguish an editorial in-content link from a template-injected link (theme navigation/footer
baked into `descriptionHtml`) — no existing data in this project makes that distinction, so all hrefs in
`content_html` are counted the same way. Stated explicitly in the module docstring and the frontend
footnote.

### Verification performed
`python -m py_compile` on all 6 backend files (new + edited) — passed. `npx vite build` — passed (only the
same pre-existing warning class every sibling page produces). Grep-confirmed no `shopify_client` import in
`link_density.py` or `density_rules.py`. **A live end-to-end calculation run against the real production
data was NOT performed in this session** — pushed to `dev-work` (`5a5d58b`) for the user to test live, same
as Step 02's current status.

### No secrets
None recorded.

## UPDATE (2026-09-18, later) — Real production incident: fan-out bug + stuck transaction, fixed

While the user tested Step 02 live, "Find Link Opportunities" appeared permanently stuck on "Scanning…".
Diagnosed live against the actual production database (not guessed):

- `pg_stat_activity` showed a connection in `idle in transaction` state, holding a lock on
  `internal_linking_opportunities` for hours -- caused by an earlier interrupted local test run of this
  same scan (hard-killed via `Stop-Process -Force` per an earlier "stop all local testing" instruction,
  which does not let Python's connection-cleanup code run, abandoning the transaction mid-write). This was
  blocking every read/write to that table, including the user's live click.
- With the user's explicit permission, terminated that stuck connection (`pg_terminate_backend`), which
  unblocked the table -- but revealed the table already held **795,275 rows** from that same incomplete
  run.
- Investigated why: a `product_type` value like "Wall Light" is shared by thousands of individual
  products, so the matching index mapped that ONE phrase to thousands of targets -- any source page
  mentioning it then generated one opportunity PER product sharing that type. This is exactly the
  "suggestion from one shared generic word" the original task spec explicitly forbids (section 4),
  just manifesting through `product_type` fan-out rather than a literal single word.

**Fixes applied (commit `199f18c`, pushed to `dev-work`):**
1. `_build_phrase_index` now drops any phrase mapping to more than 3 target pages -- too ambiguous to
   point at one relevant target with real confidence, so it's excluded entirely rather than guessed or
   fanned out to every match. Exact page titles are unaffected (titles are effectively unique).
2. `_save_opportunities` (Step 02) and `replace_density_rows` (Step 03) were both rewritten to use
   `executemany` (one batch instead of one network round trip per row) wrapped in an explicit
   try/except that rolls back on any failure -- a mid-write error can no longer leave a hung,
   lock-holding transaction the way it did here.
3. Manually cleared the 795,275 garbage rows from production after deploying the fix.

**Follow-up (commit `425279b`):** while the user was waiting on a subsequent scan, diagnosed live via
`pg_stat_activity` again that the second run was NOT stuck (no hung connection, no active query at that
moment -- it was doing genuine in-memory tokenization/matching work, the CPU-bound step described to the
user). Separately fixed real UI jank found during this same session: all three tabs (Content Index,
Opportunities, Density) were firing their API calls simultaneously on page load regardless of which tab
was active; Step 02/03 now load lazily on first tab open, plus a subtle fade-in transition was added on
tab switch (`.jreq-tab-fade`, respects `prefers-reduced-motion`).

**Housekeeping:** cleaned up 5 stale background shell processes (including a runaway `find /` still
scanning the entire C: drive from earlier diagnostic work) left running in the local session -- session
hygiene, not a codebase change.

No secrets were exposed or recorded during any of this diagnostic work -- all fixes and terminations were
DB-connection/session-level, not credential-related.

## UPDATE (2026-09-18, later) — Step 04: Generate & Prioritize Suggestions implemented

### Audit performed before writing Step 04 code
Re-checked the whole codebase and AIOS again specifically for a cornerstone-page classification and a
"new blog post" definition (same audit method as Step 03). Neither exists anywhere -- same finding as
before, now re-confirmed for this step. Critical difference from Step 03: this task's own spec explicitly
states "Do not invent a publication-age threshold" (section 7) for the new-blog condition -- stricter than
Step 03's allowance of a labeled project-config default for link-count thresholds. Applied that
distinction directly in code (`priority_rules.py`): `CORNERSTONE_STATUS_AVAILABLE = False` and
`NEW_BLOG_STATUS_AVAILABLE = False`, both with the reasoning documented in the module docstring.

### Real, stated consequence (not hidden)
Because cornerstone and new-blog classifications are unavailable, the HIGH and MEDIUM priority rules
cannot fire with real data -- every suggestion this step produces is currently LOW (reusing Step 03's own
already-configured density thresholds) or NO ACTION. This is the correct, spec-compliant outcome of "do
not guess missing classifications," not a bug, and is stated plainly in the module docstring, the frontend
footnote, and this evidence doc.

### What was implemented
- `priority_rules.py` -- `priority_for()`, the one classification function, documented above.
- `suggestions.py` -- `generate_suggestions()` reads ONLY the already-stored Step 02 actionable
  opportunities (`existing_link = FALSE`) and Step 03 density rows (joined by source page identity), never
  re-scans or re-matches. Confidence is reused verbatim from Step 02 (task section 14 explicitly allows
  this without combining new signals, which was the choice made here to avoid inventing a new score).
  Pages missing a Step 03 density row are skipped (not fabricated), counted and reported as
  `skippedNoDensityData` in the response.
- Schema: `internal_linking_suggestions`, **upserted** (not truncate-replace like Step 02/03) keyed on
  `(source, target, anchor)` -- deliberately different from Step 02/03's pattern because a Dilaksi review
  decision (`review_status`/`reviewed_by`/`reviewed_at`) must survive a regeneration; the UPDATE SET
  clause explicitly excludes those three columns.
- Router: `POST /suggestions/generate` (non-blocking, `BackgroundJob`), `GET /suggestions/generate/status`,
  `GET /suggestions`, `POST /suggestions/{id}/review` (body: `status`, `reviewer` -- reviewer comes from
  the existing `dm_user` localStorage convention already used by `Gsc404UrlMonitor.jsx`, no new user
  system).
- Frontend: fourth tab, 8 real summary KPIs (Total/High/Medium/Low/No Action/Review Required/Approved/
  Rejected), filterable/searchable table with an inline review-status dropdown per row, and a detail modal
  showing source/target/anchor/context/reason/confidence/density/priority-rule plus Approve/Reject/Keep
  for Review buttons.

### Quality checks (task section 10) -- reused, not re-implemented
Self-link exclusion, existing-link exclusion, target validity, and dedup are all already enforced by Step
02's own output; Step 04 only reads the already-filtered `existing_link = FALSE` rows and adds priority on
top, per explicit instruction not to duplicate that logic.

### No automatic implementation (task section 22) -- verified
Grepped `suggestions.py`, `priority_rules.py`, and the new router endpoints for any `shopify_client` import
or content-modifying call -- none exist. The review endpoint only writes to
`internal_linking_suggestions`'s own review columns.

### Verification performed
`python -m py_compile` on all 5 new/edited backend files -- passed. `npx vite build` -- passed after fixing
one real JSX syntax error introduced mid-edit (a block comment was closed prematurely, caught immediately
by the build, fixed before pushing). Grep-confirmed no Shopify calls anywhere in the new code. **A live
end-to-end "Generate Suggestions" run against real production Step 02/03 data was NOT performed in this
session** -- pushed to `dev-work` (`c4d1ffa`) for the user to test live, same pattern as Steps 02/03.

### No secrets
None recorded.
