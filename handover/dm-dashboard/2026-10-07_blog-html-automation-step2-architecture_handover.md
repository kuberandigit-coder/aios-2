# Handover — Blog HTML Automation Step 2 Architecture

Date: 2026-10-07
Status: **Step 2 (architecture) complete. Step 3 (implementation) not started.**

## Task

Design the final technical architecture for Blog HTML Automation, building on the Step 1 audit
and the same-day hardcode fix, without implementing anything.

## Reused systems

`local_llm.py`, `faq_schema.py` (now store-aware), `jsonld.py`, `seo_limits.py`, `html_fixes.py`,
`content_gap/core.py`, `internal_linking/schema.py`, `blog_optimization/gsc.py`/`gsc_sync.py`,
`core/shopify_client.py`, `core/background_job.py` + `usePollingResource`, `core/task_auth.py`,
`taskRegistry.js` registration pattern, `apiFetch.js`. All confirmed by direct code read this
session, not assumed from Step 1.

## New components

New package `backend/app/dev_tasks/blog_html_automation/` with 9 proposed files (`router.py`,
`schema.py`, `rules.py`, `inputs.py`, `outline.py`, `generator.py`, `faq_adapter.py`, `qa.py`,
`result_log.py`), one new database table (`blog_html_automation_generation`), and one new
frontend page. Full detail in the evidence doc.

## Database recommendation

One new table only (`blog_html_automation_generation`), modeled on
`geo_visibility_content_actions`'s proven draft/history/review-status shape, after confirming no
existing table can hold this lifecycle without conflating two tasks' data.

## Frontend recommendation

`frontend/src/admin/pages/dev-tasks/BlogHtmlAutomation.jsx`, registered in `taskRegistry.js` as
`tools.BlogHtmlAutomation`, reusing Blog Optimization's exact layout/CSS-class conventions
(sticky quick-nav, Code/Preview toggle, review-then-apply pattern, Completed-tab-style history
list).

## Known limitations (carried forward from Step 1, re-confirmed)

- Only 3 sites have confirmed GSC access.
- `ledsone.de` still can't read blog content (Shopify `read_content` scope still missing — the
  hardcode fix made the CODE site-aware, it did not grant the missing PERMISSION, which is a
  separate action item for Kuberan in Shopify admin).
- No Shopify write access anywhere — publishing stays manual by design.
- Content Gap (SerpAPI) and FAQ (Scrape.do) remain shared, metered resources.

## Step 3 plan

11-step ordered plan in the evidence doc §20 — starting with `rules.py` and `inputs.py` (no
dependencies, testable against real data immediately), ending with a full live end-to-end test
on a UK site before attempting DE/FR.

## Open questions (must resolve before/during Step 3)

1. Does outline planning need an LLM call, or can it stay fully deterministic?
2. Exact cannibalisation-check logic — not designed in detail yet.
3. **Collection URL vs. blog post relationship** — needs clarification from the SEO operator:
   is the collection URL context for a new blog post, or does this tool also generate collection
   page content itself? Changes what `inputs.py` fetches first.
4. Body-copy generator must apply the same domain-derived locale approach the `faq_schema.py`
   fix just established — risk of reintroducing a hardcoded-English assumption in NEW prompt
   code if this isn't deliberately carried through.
5. `dcvoltage.co.uk` scope — still undecided.

## Next step

Kuberan/the SEO operator reviews the architecture doc, resolves the 5 open questions above
(particularly #3, which affects the very first implementation step), then explicitly authorizes
Step 3. No closure document — the feature is not implemented.
