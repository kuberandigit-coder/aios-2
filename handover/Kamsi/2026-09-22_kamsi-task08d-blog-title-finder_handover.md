# Handover — Kamsi Task 08d: Top 10 Blog Title Finder (Google Search Only)

Date: 2026-09-22
Owner: Kamsi
Reviewer: project owner/team

## What was built

A new Development Tasks feature: Kamsi provides one LEDSone UK product or
collection URL, the system reads real Shopify page content, extracts a
primary keyword via the existing local LLM, searches that keyword on
Google UK through a brand-new, isolated SerpAPI.com integration, classifies
the response into Organic/Ads/Shopping, shows the Top 10 organic
blog/article results, analyses observed title patterns, generates one
original LEDSone blog title, runs deterministic QA, and lets Kamsi
review/edit/approve/reject. Nothing is ever published to Shopify
automatically — title research and generation only.

## Where it is located

- Backend: `backend/app/dev_tasks/kamsi_blog_title_finder/`
  (`schema.py`, `serpapi_kamsi.py`, `page_reader.py`, `analysis.py`,
  `generation.py`, `router.py`)
- Frontend: `frontend/src/admin/pages/dev-tasks/KamsiBlogTitleFinder.jsx`
- Registered in: `backend/app/dev_tasks/__init__.py`,
  `frontend/src/admin/AdminLayout.jsx`, `frontend/src/dev/DevLayout.jsx`,
  `frontend/src/taskRegistry.js` (as `tools.DevKamsiBlogTitleFinder`)
- Visible under: Development Tasks -> "08d) Top 10 Blog Title Finder (Kamsi)"

## How it works

1. `page_reader.resolve_url()` — accepts only `ledsone.co.uk` URLs, reads
   real product/collection data via the existing `shopify_client.graphql()`.
2. `generation.extract_primary_keyword()` — same local-LLM +
   Gemini-fallback pattern as every other AI-generation dev task in this
   codebase, no new LLM service created.
3. `serpapi_kamsi.search_google_uk()` — ONE call to SerpAPI.com
   (`engine=google`, `gl=uk`, `hl=en`, `google_domain=google.co.uk`),
   using a new, isolated `KAMSI_SERPAPI_KEY` env var.
4. `analysis.classify_serp()` — deterministically separates
   `organic_results` from `ads` and `shopping_results`/
   `inline_shopping_results` (whichever the response contains), applies a
   conservative URL-path-based blog/article heuristic, returns Top 10.
5. `analysis.analyse_title_patterns()` — reports only patterns actually
   observed (number/list, "best", "guide", "how to", question, year,
   comparison) across the real Top 10 titles.
6. `generation.generate_title()` — one LLM call, same local-LLM/Gemini
   pattern, using the exact business prompt/rules from the task spec.
7. `generation.qa_check()` — deterministic (non-LLM) validation: not
   empty, <=70 chars, keyword present, not identical to any Top 10 title,
   not a close rewrite (>=85% similarity) of any Top 10 title.
8. Kamsi reviews in the UI: Edit / Regenerate / Approve (disabled until QA
   passes) / Reject, with review notes.

## New Kamsi SerpAPI integration

`serpapi_kamsi.py` — env var `KAMSI_SERPAPI_KEY`, completely separate
module and credential from Sajeepan's existing `SERP_API_1`/`SERP_API_2`
(`sajeepan_lens_serpapi.py`). Confirmed via `grep` that this module never
imports or calls anything from Sajeepan's code. **No real key value has
been configured yet** — `backend/.env` now has an empty
`KAMSI_SERPAPI_KEY=` line as a placeholder; the actual value still needs
to be supplied and added there (and separately to the production server's
own `.env`, which is a different file not tracked in this repo).

## API quota assumption

Documented, not invented: ~190 searches/month expected (10 listings/day x
19 working days), against an assumed ~250/month free allowance. One
research run = exactly one SerpAPI call (never one call per Top-10 row).
A configurable cache (`KAMSI_SERP_CACHE_HOURS`, default 24h, no existing
project convention covered this exact case so it was made configurable
rather than guessed) reuses the most recent SERP result for an identical
keyword within the window instead of spending another credit; `forceSearch`
bypasses it explicitly.

## UAM configuration

Task key `tools.DevKamsiBlogTitleFinder` registered in
`frontend/src/taskRegistry.js`. Access granted to `kamsi` via a real
`access_grants` DB row (`granted_by: "admin (Task 08d build, 2026-09-22)"`).
Confirmed via live query that no other staff member was granted.

## Development Tasks registration

Registered identically to every sibling dev task: backend router included
in `dev_tasks/__init__.py`, schema wired into `ensure_dev_task_schemas()`,
nav entries added to both `AdminLayout.jsx` and `DevLayout.jsx` under the
existing "Development Tasks" group — no new registry/status system
invented.

## Current status

**Implemented, live-tested end-to-end, and pushed.** After the user added
a real `KAMSI_SERPAPI_KEY` (local + production server, backend restarted),
a full real pipeline run was executed: real Shopify collection ->
real LLM keyword extraction -> real Google UK SerpAPI search (9 real
organic results) -> real generated title -> QA PASS -> Verify PASS. Quota
tracking confirmed real (249 -> 248 searches left after the one research
call, unchanged by the verify call). All commits (`d2b9cdc`, `0206604`,
`1bd6fcc`, `781a1fe`) pushed to `dev-work`. Not yet merged to `main` /
deployed to production.

## UPDATE (2026-09-22, later) — UI overhaul per direct user feedback

Three rounds of user feedback (screenshots) drove further changes:
1. Buttons/inputs had zero styling (the original build referenced CSS
   classes that didn't exist in the shared stylesheet) — fixed with a
   dedicated scoped stylesheet (`KamsiBlogTitleFinder.css`) built on the
   existing `jreq-*` design tokens.
2. "08d)" task-number prefix removed from every user-facing label; a
   stray "AI/GEO" label on a *different*, pre-existing dev task
   (AEO/GEO Visibility Gap Analysis) was also corrected per the same
   request.
3. Page width was hard-capped at 1080px, leaving dead space on wide
   screens — widened to 1400px with a responsive breakpoint.
4. Restructured into 3 tabs (Research / Generated Titles / API Limits),
   added a Verify button (re-runs QA against stored data, no new
   credit spent), and surfaced who ran/reviewed/verified each item
   throughout the UI (`createdBy`, `reviewer`, `verifiedBy`).

## Known limitations

- **RESOLVED (2026-09-22, later)**: `KAMSI_SERPAPI_KEY` now has a real
  value (local + production), and the full pipeline has been live-tested
  end-to-end successfully — see evidence.md's UPDATE section. The
  real response's `organic_results[].position/title/link` shape matched
  what `analysis.classify_serp()` expected, with no field-name surprises.
  Ads/Shopping-specific fields (`ads`, `shopping_results`) have not yet
  been observed on a real response, since the one live test query
  happened not to trigger either — the classification code path is
  identical regardless and remains unit-tested against SerpAPI's
  documented shape for those fields.
- Blog/article classification is a conservative URL-path heuristic only
  (no SERP field indicates content type) — documented in the response
  itself (`blogClassificationNote`) as requiring additional
  application-level classification for higher confidence.
- No automated re-checking or scheduled refresh — every research run is
  manually triggered.
- Product-vs-collection URL resolution only (no arbitrary blog/content
  page type on ledsone.co.uk is supported, per the task's own URL scope).

## Remaining work

1. Merge `dev-work` into `main` and deploy to production (pending
   explicit instruction, per this project's standing convention — not
   done as of this update).
2. Nothing else — all functional/live-test criteria have passed.

## Next step

Ask whoever manages deployment whether/when to merge `dev-work` into
`main` for this feature to go live in production. No closure record has
been created yet — deliberately held open until that deployment decision
is made.
value, then re-run the pipeline live and update evidence/validation
accordingly.
