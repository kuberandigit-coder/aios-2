# Handover — Blog HTML Automation Step 1 Audit

Date: 2026-10-07
Owner (developer): Kuberan
SEO user/operator: Dilaksi
Status: **Step 1 complete (audit only). Step 2 (build) not started.**

## Task

Audit dm-dashboard's existing Development Tasks and shared infrastructure to determine what a
new "Blog HTML Automation — Shopify Ready-to-Publish Generator" feature can reuse, extend, or
must build new — before any implementation starts. No feature code, routes, pages, or tables
were created.

## What was inspected

Full file reads (this session): `blog_optimization/{gsc.py, gsc_sync.py, shopify.py, router.py,
schema.py, qa_check.py}`, `content_gap/core.py`, `internal_linking/schema.py` (function
signatures + 2 key functions read in full), `dev_tasks/{local_llm.py, jsonld.py, seo_limits.py,
faq_schema.py, html_fixes.py}`, `core/shopify_client.py` (STORES config), `frontend/src/
taskRegistry.js` (registration pattern), `frontend/src/dev/DevLayout.jsx` (Sync Monitor
registration, unrelated but confirmed not needed for this feature type). Plus the already-read
`dev_tasks/__init__.py` aggregator docstring and prior-session direct reads of
`core/google_client.py`, `core/background_job.py`, `core/scheduled_snapshot.py`.

## Reusable systems found

- Shared LLM fallback chain (`local_llm.py`) — must be reused, not duplicated.
- FAQ schema generation pipeline (`faq_schema.py`) — schema-generation half directly reusable;
  visible-FAQ-HTML half does not exist, needs building alongside it.
- Shared competitor/content-gap engine (`content_gap/core.py`) — one shared cache table, already
  consumed by 2 existing features.
- Internal Linking's content index + suggestion tables — real, Shopify-sourced, already
  maintained.
- Blog Optimization's GSC data (own Postgres, 3 confirmed-working sites) and its Shopify
  content-fetch pattern (`shopify.py`'s `SITE_STORES` per-site config) — both directly reusable
  as-is or as a precedent to copy.
- `seo_limits.py`, `html_fixes.py`, `jsonld.py` — small, clean, directly reusable utilities.
- Dev Task registration pattern (`taskRegistry.js` + `task_auth.make_task_auth`) — exact shape
  confirmed from Blog Optimization's own real registration line.

## Duplicate risks (must NOT build a second one of)

LLM client, FAQ-schema pipeline, competitor/content-gap engine, internal-link recommendation
engine, GSC client/storage, meta-length utility, HTML duplicate-link/heading fixer, AI Overview
(AEO/GEO) tracker. Full detail in the evidence doc §4.

## Limitations found

- GSC live API access confirmed for only 3 sites (`ledsone.co.uk`, `ledsone.de`, `ledsone.fr`);
  5 others return HTTP 403 — not a code fix, needs GSC property access granted.
- Shopify Admin API configured for 5 stores; `ledsone_de`'s token is missing the `read_content`
  scope (blog content blocked there); no credential at all exists for `ledsone_us`,
  `vintagelite`, `electricalsone`, `besbet`.
- **No Development Task anywhere has general Shopify blog-content write access.** Only
  `alt_text_keywords` has one narrow, re-checked-before-write exception for empty alt text.
  Auto-publish is explicitly out of scope until a separate decision is made.
- Content Gap's SerpAPI search and FAQ's PAA (Scrape.do) are both shared, credit-metered
  resources already consumed by other features — expected call volume should be confirmed with
  Dilaksi before Step 2.
- Two confirmed hardcoding risks: `qa_check.py`'s relative-URL fallback to `ledsone.co.uk`, and
  `faq_schema.py`'s prompt text hardcoding the UK brand/domain.

## Recommended Step 2

New package `backend/app/dev_tasks/blog_html_automation/`, reusing the systems listed above
unmodified, extending `faq_schema.py` (visible FAQ generation) and `pick_internal_links()`'s
limit, building a new sibling QA module (not extending `blog_optimization/qa_check.py` directly,
to avoid coupling two tasks), following Blog Optimization's review-then-apply/no-auto-publish
UI precedent, and defining Dilaksi's business-rule numbers (1500 words, 3–6 products, etc.) as
named constants in one place. Full detail in the evidence doc §11.

## Next step

Kuberan to review the audit findings with Dilaksi and/or ChatGPT (per the stated purpose of this
audit — feeding the Development Tasks Overview + this audit into a planning discussion before
Step 2 design). Confirm site scope (UK/DE/FR only, or also dcvoltage?) and expected shared-quota
usage before Step 2 implementation begins. **No closure document yet — Step 1 is audit only, the
feature itself is not built.**
