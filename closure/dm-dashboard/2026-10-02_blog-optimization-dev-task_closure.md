# Closure — dm-dashboard: Blog Optimization "Clicks-Down URLs" Dev Task

**Date:** 2026-10-02
**Developer:** Kuberan
**Staff user:** Dilaksi
**Requested by:** Kuberan (AIOS task spec, Development Tasks → Dilaksi → Blog Optimization)

## Purpose

Turn Google Search Console click decline on Shopify blog pages into an actionable SEO
workflow — detection → analysis → competitor gap → cause → optimization → QA → publish →
Search Console → before/after — rather than just a GSC data display, per the task's own
"do not over-engineer the first implementation" instruction and explicit no-duplication
mandate (search the existing codebase first, reuse everything possible).

## What was built

**Backend** (`backend/app/dev_tasks/blog_optimization/`):
- `gsc.py` — last-28-days vs previous-28-days click comparison, business DB
  `google_search_console.page`/`query_page`, filtered to Blog-type URLs by reusing
  `search_intent_page_action`'s existing `classify_page_type` (not duplicated).
- `classify.py` — deterministic priority rules (High/Medium/Low/No action) exactly per the
  spec's thresholds, centralized (not duplicated in the frontend).
- `shopify.py` — real Shopify blog content, by reusing `kamsi_blog_title_finder`'s existing
  article-resolve logic directly rather than building a second Shopify client.
- `competitor.py` — competitor gap check, by reusing `content_gap`'s existing SerpAPI search
  + page-comparison pipeline wholesale, with its own cooldown/quota-safety lock so it can't
  exhaust the shared SerpAPI account.
- `cause.py` — deterministic cause category (from measured deltas only) plus an optional
  AI-written recommendation (`ai_chat.ai_shared.call_gemini`), clearly separated in the API
  response so the frontend can never present the AI text as a measured fact.
- `router.py` — 10 endpoints, gated through the existing `task_auth`/User Access Management
  system (`tools.DevBlogOptimization`), no new auth code.

**Frontend** (`frontend/src/admin/pages/dev-tasks/BlogOptimization.jsx`): header with KPI
cards, filterable/sortable main table, detail drawer (performance comparison, affected
queries, competitor section, cause section, Shopify content preview, QA checklist, before/
after tracking, owner/status form) — built on the existing `jreq-*` CSS system, no new design
system. Registered in `taskRegistry.js`.

## Verification performed

- `py_compile` clean on every new file; full `app.main` import clean (593 routes after this
  task, confirmed route count delta matched the 10 new endpoints).
- **Live data test, not just a syntax check**: ran the real GSC query against the business
  DB — found 231 real blog pages on ledsone.co.uk, correctly classified 4 High / 39 Medium /
  8 Low / 180 No action priority. Ran the real Shopify content fetch and the real per-page
  query breakdown against actual pages — both returned correct real data.
- `npx vite build` clean.

## Known limitations (explicitly not fixed, flagged to Kuberan)

- Competitor check and Shopify content fetch are LEDSone UK only — same scope limitation as
  the existing modules they reuse, not a new gap introduced by this task.
- Search Console indexing is a manual link, not automated, per the spec's own instruction not
  to claim automated indexing requests.
- Did not click-test the live UI in an actual browser — local dev backend can't reach the
  business DB the way the deployed server can (a known, pre-existing constraint, not specific
  to this task). Recommended a click-through after the next deploy.

## Real bug found and fixed separately the same day (not part of this task, but discovered
alongside it)

While registering this task in the sidebar, found that **two** dev tasks were missing from
the Development Tasks menu — this one and an earlier one (Search Intent → Page Action) — both
correctly registered in the grant-list file but never added to either of the two separate,
hand-maintained sidebar files. Fixed both, then deduplicated the underlying 3-way-duplication
problem into one shared registry. See the main daily log for detail; not repeated here since
it's a separate fix, not scoped to this task.

## Status

**Done.** Pushed to `dev-work`. Not yet merged to `main` as of this closure (dm-dashboard
work follows a strict dev-work-only push policy; Kuberan merges to `main` himself via the
Dev Tools UI, or explicitly authorizes a direct merge when production is affected).
