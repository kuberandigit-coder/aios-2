# Blog HTML Automation — Step 3 Implementation Evidence

**Date:** 2026-10-07
**Preceded by:** Step 1 audit, hardcode fix, Step 2 architecture (same day).
**Branch:** `dev-work` (pushed, commit `f8e8984` — NOT merged to `main`, NOT deployed).

## Files changed/created

- **New package** `backend/app/dev_tasks/blog_html_automation/`: `__init__.py`, `rules.py`,
  `schema.py`, `inputs.py`, `outline.py`, `generator.py`, `faq_adapter.py`, `qa.py`,
  `result_log.py`, `router.py` — matches the approved Step 2 file table exactly.
- **New frontend page** `frontend/src/admin/pages/dev-tasks/BlogHtmlAutomation.jsx`.
- **Modified (wiring only):** `backend/app/dev_tasks/__init__.py` (router include +
  `ensure_schema` registration), `frontend/src/taskRegistry.js` (UAM entry,
  `tools.BlogHtmlAutomation`), `frontend/src/devTasksRegistry.js` (the actual single source of
  truth for sidebar visibility in both `AdminLayout.jsx` and `DevLayout.jsx` — found during
  implementation; `taskRegistry.js` alone would NOT have made the page appear in either
  sidebar, only fed the UAM grant matrix).
- **No other Development Task file was touched.**

## Reused systems (confirmed by the code itself, not re-asserted from Step 2)

- `dev_tasks/local_llm.call_with_gemini_fallback` — unchanged, called directly for body copy.
- `dev_tasks/faq_schema.generate_faq_schema` — **unchanged**. `faq_adapter.py` calls it exactly
  as `blog_optimization`/`collection_thin_content` already do; zero edits to `faq_schema.py`.
- `content_gap/core.get_latest_for_page` — unchanged, read-only.
- `internal_linking/schema` (via `faq_schema.pick_internal_links`) + `internal_linking/content_fetch.SITE_BASE`
  (for the single-store-limitation check, see below).
- `blog_optimization/gsc.SITES`/`HOST_TO_SITE_URL` + its own `blog_optimization_gsc_query` table
  (read directly, no new GSC API call).
- `blog_optimization/shopify.SITE_STORES` — site→(store key, domain) resolution.
- `core/shopify_client.graphql` — new product-fetch query written in `inputs.py`, same client,
  parametrized by store (not hardcoded, unlike `geo_visibility/shopify.py`'s UK-only version it
  borrows the query SHAPE from).
- `core/background_job.BackgroundJob` + the existing polling convention.
- `core/task_auth.make_task_auth`/`require_any_login` — exact existing pattern.

## A genuinely new, reusable technique found during implementation

`faq_adapter.py` does NOT make a second LLM call to get visible FAQ text. It calls the existing
`generate_faq_schema()` once, then **renders the visible FAQ HTML directly from the already-
parsed FAQPage JSON-LD's `mainEntity` question/answer pairs**. This is a stronger guarantee than
"two outputs from the same prompt" (the Step 2 architecture's original idea) — it's structurally
impossible for the visible FAQ and the schema to diverge, since one is literally rendered from
the other, and it costs zero extra AI calls. Documented as a capability update, not a new record
(see AIOS files below).

## Live verification performed (real data, not mocked)

1. `ensure_schema()` run against the real database — `blog_html_automation_generation` table
   created successfully.
2. `inputs.resolve_site_context()` — confirmed correct domain/brand/locale for `ledsone.de` and
   `ledsone.co.uk`, no network needed.
3. `outline.clean_and_group()`/`build_outline()` — deterministic logic confirmed with sample
   data (dedup, grouping, FAQ-candidate classification all behaved correctly).
4. **`inputs.get_gsc_queries('ledsone.de', 'lampe')`** — 20 real German queries returned from
   the already-synced `blog_optimization_gsc_query` table (e.g. "netzteil für led lampen").
5. **`inputs.get_internal_links('ledsone.de', ...)`** — correctly returned `partial` with an
   explicit note (the content index only covers `https://ledsone.co.uk`); same call for
   `ledsone.co.uk` correctly returned `available` with no note.
6. **`inputs.get_products('ledsone.de', 'led-transformers')`** — real live Shopify GraphQL call,
   returned real German products with real EUR prices and real CDN image URLs (e.g. "LED trafo
   12v IP67 wasserdicht Netzteil 10W - 350W", €6.59).
7. **Full pipeline, real LLM call**: `generator.generate_html()` for site=`ledsone.de`,
   keyword="LED Trafo", using the real products/links above — succeeded, produced real German
   FAQ content (6 Q/A pairs), a complete `.ls-blog` HTML block.
8. **`qa.run_qa()`** against that real generated HTML — 16 of 18 checks PASS; correctly FAILED
   "Word count" (886 words vs. the 1350–1650 target) and "HTML structure valid" (tag-balance
   heuristic flagged it) — QA genuinely catching real quality issues on unedited AI output,
   exactly as designed, not faking a pass.
9. **Full `result_log` lifecycle round-trip**: create → save outline → save generated HTML
   (twice, confirming the second overwrite correctly pushed the first into
   `generation_history`) → save QA result → save final HTML → set review status → mark
   published → read back → list by site — every field round-tripped correctly. Test rows
   deleted after each verification.
10. Backend regression: `python -m py_compile` on every new file, and a full
    `import app.main` (the entire backend's module graph, not just the new package) — both
    clean.
11. Frontend regression: `npx vite build` — clean, no new warnings beyond this repo's existing
    unrelated ones.

## What was NOT live-tested

- **No manual click-through in an actual running browser.** All verification above was direct
  Python function calls and a build check, not opening the page and using it. This is the main
  reason closure was NOT written for this step (see handover doc).
- **Word-count prompt tuning.** The one real quality gap QA caught (886 vs. 1350–1650 words) is
  a prompt-engineering concern, not a structural bug — flagged as a known limitation, not
  silently ignored.

## No-hardcode check

Grepped the entire new package + new frontend file for `ledsone.co.uk`/`.de`/`.fr`/`LEDSone`:
one occurrence found in `inputs.get_internal_links()` (a literal `"ledsone.co.uk"` comparison),
**removed and replaced** with a dynamic comparison against `internal_linking.content_fetch`'s
own existing `SITE_BASE` constant — zero literal store/domain strings remain in the new feature,
confirmed by a final grep returning no matches.
