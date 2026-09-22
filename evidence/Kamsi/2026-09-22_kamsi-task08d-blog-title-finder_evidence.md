# Evidence — Kamsi Task 08d: Top 10 Blog Title Finder (Google Search Only)

Date: 2026-09-22
Repo: dm-dashboard (branch: local working tree, not yet committed/pushed)
Staff: Kamsi

## Original task requirement (preserved)

Build a production-ready DM Dashboard workflow: one LEDSone product/collection
URL -> read real Shopify page content -> extract one primary keyword ->
search that exact keyword on Google UK via a NEW, isolated SerpAPI.com
integration (never Sajeepan's existing SerpAPI/Lens credential or module) ->
classify Organic vs Ads vs Shopping -> Top 10 organic blog/article results ->
observed title-pattern analysis -> one generated original LEDSone blog title
-> programmatic QA -> human review/approve/reject. Title research/generation/
approval only — no automatic publishing.

## Pre-implementation audit (done before writing any code)

A prior investigation this session (separate turn) confirmed, via real
codebase search:
- No existing Playwright/browser-automation Google-search capability exists
  or is viable (bot-detection blocked live, reconfirmed with a fresh
  controlled test this session — see the standalone Playwright feasibility
  report delivered earlier).
- Two existing, separate SerpAPI-family integrations already exist:
  `geo_visibility/aio_searchapi.py` (SearchAPI.io, AI-Overview-only) and
  `sajeepan_lens_serpapi.py` (SerpAPI.com, Sajeepan's Lens keyword tool) —
  neither classifies Organic/Ads/Shopping together from one response, so a
  new module was required rather than reuse, per the task's own explicit
  "do not modify Sajeepan's integration" instruction.
- Development Tasks registry, UAM (`taskRegistry.js` + `access_grants.py`),
  and Kamsi's existing footprint were audited via a background research
  agent — full findings quoted in-session; used directly to match this
  build to the existing registration pattern (see source-map).

## Implementation — real code, live-tested where possible

All of the following were verified live against this project's real
database and real import graph, not assumed:

1. **Backend import** — `python -c "from app.main import app"` succeeds
   cleanly via the project's own venv (`backend/venv`). No import errors.
2. **Route registration** — confirmed 7 new endpoints actually registered
   in the live FastAPI app under
   `/api/admin/dev-tasks/kamsi-blog-title-finder`:
   `GET /status`, `POST /research`, `GET /research`, `GET /research/{id}`,
   `POST /research/{id}/regenerate-title`,
   `PUT /generations/{id}/status`, `PUT /generations/{id}/content`.
3. **Schema creation** — `ensure_schema()` run against the real project
   Postgres database; confirmed all 3 new tables exist via
   `information_schema.tables`: `kamsi_blog_title_research`,
   `kamsi_blog_title_serp_results`, `kamsi_blog_title_generations`.
4. **Deterministic logic unit-verified** (structural test of our own
   parser against SerpAPI.com's documented response shape — not a live
   Google fetch, since no `KAMSI_SERPAPI_KEY` value exists yet, see
   Known Limitations):
   - `analysis.classify_serp()` correctly separated 3 organic results
     from 1 Ad and 1 Shopping result, correctly flagged blog-path
     results (`/blog/`, `/guide/`) as `isLikelyBlogArticle: true` and a
     plain product page as `false`.
   - `analysis.analyse_title_patterns()` correctly detected `bestPattern`,
     `guidePattern`, `howToPattern`, `questionFormat`, `yearPattern` from
     3 sample titles, each with correct count/fraction.
   - `generation.qa_check()` correctly PASSED a valid candidate title and
     correctly FAILED three deliberately-broken cases: an exact Top-10
     duplicate (both `notIdenticalToTop10` and `notCloseDuplicate` failed),
     an 80-character title (`maxLength70` failed, and correctly also
     failed `keywordPresent` since the padding string had no keyword),
     and a title missing the primary keyword (`keywordPresent` failed).
   - All assertions in the test script passed; test data was in-memory
     only, nothing written to the database by this test.
5. **Regression checks**:
   - `grep` confirmed `serpapi_kamsi.py` never imports or calls anything
     from `sajeepan_lens_serpapi.py` or related Sajeepan modules — the
     only match is a docstring mention (documentation, not coupling).
   - `sajeepan_lens_serpapi` module still imports cleanly.
   - Confirmed `KAMSI_SERPAPI_KEY` does not collide with Sajeepan's
     `SERP_API_1`/`SERP_API_2` env var names.
   - Full route count check: 480 total routes app-wide, 22 geo-visibility
     routes, 29 sajeepan/lens routes, 3 access-grants routes, 7 new Kamsi
     Task 08d routes — none of the pre-existing counts changed from before
     this build.
6. **Frontend build** — `npx vite build` completed successfully
   (`✓ built in 3.33s`). The only warnings shown
   (`INEFFECTIVE_DYNAMIC_IMPORT`) are pre-existing Rollup warnings that
   already fire for every other dev-task page in this codebase (same
   dual static+dynamic import pattern via `taskRegistry.js` +
   `AdminLayout.jsx`/`DevLayout.jsx`) — `KamsiBlogTitleFinder.jsx` shows
   the identical harmless pattern, not a new error class.
7. **UAM grant** — inserted a real row into `access_grants`
   (`task_key='tools.DevKamsiBlogTitleFinder'`, `granted_to_staff_key='kamsi'`),
   confirmed via a live `SELECT` that exactly one row exists for this
   task_key (i.e. no other staff was accidentally granted).

## What was NOT live-tested (and why)

- **The actual SerpAPI.com HTTP call was never executed against live
  Google data.** `KAMSI_SERPAPI_KEY` has no real value configured — none
  was ever supplied during this task (the user mentioned "I have a new
  search API for Kamsi" earlier in the session but never provided the
  actual key string, and the SerpAPI-key-adding step was explicitly
  deferred/out of scope in an earlier related task). `serpapi_kamsi.py`'s
  `search_google_uk()` is coded defensively against SerpAPI.com's
  documented response schema, but that schema has not been confirmed
  against a real response from this specific endpoint/account.
- **The full end-to-end `/research` pipeline was never run against a real
  LEDSone URL.** Doing so would require the missing SerpAPI key. No mock
  or fabricated SERP data was used anywhere in this build or its tests —
  the unit tests above used a hand-written dict shaped like SerpAPI's
  published schema, clearly separated from any claim of live Google data.
- The `LOCAL_LLM_*` keyword-extraction and title-generation calls were
  not live-tested in this session (would require running the full
  pipeline, which needs the SerpAPI key first) — the prompt/parsing code
  reuses the exact same pattern already proven live multiple times
  elsewhere in this codebase (`geo_visibility/content_actions.py`, etc.).

## No secrets

No SerpAPI key, Shopify token, or other credential value is recorded in
this file, any other AIOS file, or logged anywhere. `backend/.env`'s new
`KAMSI_SERPAPI_KEY=` line is empty (a real value must still be added by
whoever has it, on both this machine and the production server).

## UPDATE (2026-09-22, later) — real KAMSI_SERPAPI_KEY added, full live end-to-end test run

The user added a real SerpAPI.com key to `KAMSI_SERPAPI_KEY` (both locally
and on the production server, restarting the backend service). This
unblocked a genuine, full, real end-to-end pipeline test — not a unit
test — run directly through the real `router.run_research()` function:

- **Input**: `https://ledsone.co.uk/collections/2core-round` (a real,
  existing LEDSone collection).
- **Real Shopify read**: correctly resolved page title, H1
  ("2 Core Round Cable"), and description.
- **Real LLM keyword extraction**: primary keyword "2 Core Round Cable",
  with a grounded page summary and reasoning, both clearly reflecting the
  actual page content.
- **Real Google UK search via the new Kamsi SerpAPI key**: returned 9
  real organic results from real domains (`12voltplanet.co.uk`,
  `mullanlighting.com`, `boltworld.co.uk`, `lampspares.co.uk`,
  `ebay.co.uk`, ...), correctly ranked, titled, and domain-extracted.
  Confirms SerpAPI.com's documented response schema assumption
  (`organic_results[].position/title/link`) was correct.
  Correctly reported `NO_ORGANIC_RESULTS`-adjacent "fewer than 10"
  warning since only 9 organic results existed for this specific query.
- **Real title generated**: "2 Core Round Cable by LEDSone UK - Flexible
  Fabric Lighting" (59 characters) — passed all 5 QA checks (not empty,
  <=70 chars, keyword present, not identical/close-duplicate to any of
  the 9 real Top-10 titles).
- **Verify endpoint tested live**: `POST /generations/{id}/verify`
  correctly re-ran the same deterministic QA against the real stored
  data, stamped `verifiedBy`/`verifiedAt`, confirmed `qaStatus: PASS`
  again without spending a second SerpAPI credit.
- **Quota tracking confirmed real**: `GET /account` (new SerpAPI.com
  Account API integration) showed `totalSearchesLeft` dropping from 249
  to 248 across the one real research call, and NOT dropping again for
  the verify call — proving the "one listing = one SERP request" design
  actually holds in practice, not just in code review.
- **Real separate user data found and correctly preserved**: while
  cleaning up this test's own rows (`created_by = 'Live Test'`), a
  pre-existing, different research row (`created_by = 'Dev'`, a real
  product URL) was found in the same table from the user's own earlier
  use of the live page — correctly left untouched (the cleanup only
  targeted rows this specific test created).

## Also this update — UI overhaul

Per direct user feedback (screenshots showing unstyled raw buttons/inputs
and a page width that didn't fill the screen): added a dedicated scoped
stylesheet (the original build had referenced CSS classes that didn't
actually exist anywhere in the shared stylesheet, so every button/input
rendered as an unstyled browser default), removed "08d)"/"AI/GEO" wording
issues, widened the page layout (was hard-capped at 1080px leaving dead
space, now fills to 1400px with a responsive breakpoint), and restructured
into 3 tabs (Research / Generated Titles / API Limits) per explicit
request, adding the Verify button and created-by/reviewer/verified-by
attribution display throughout.

## Status

Implemented, unit-tested, **and now live-verified end-to-end with a real
SerpAPI key** — real Shopify data, real Google UK SERP, real generated
title, real QA pass, real verify pass, real quota tracking. Committed and
pushed to `dev-work` (commits `d2b9cdc`, `0206604`, `1bd6fcc`, `781a1fe`).
Not yet merged to `main` / deployed to production (pending explicit
instruction, per this project's standing convention).
