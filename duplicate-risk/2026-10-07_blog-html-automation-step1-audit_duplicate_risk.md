# Duplicate-Risk Record — Blog HTML Automation

Date: 2026-10-07
Found during: Step 1 audit (see evidence doc for full detail:
`evidence/dm-dashboard/2026-10-07_blog-html-automation-step1-audit_evidence.md`)

A new "Blog HTML Automation" feature touches almost every existing SEO-content system in
dm-dashboard. These are the concrete duplication risks confirmed by direct code inspection — if
Step 2 implementation rebuilds any of these instead of reusing them, it creates the exact kind
of drift this codebase has already had to consolidate once (8 separate local-LLM-caller copies,
3 disagreeing meta-length constants, 2 separate GSC integrations, 2 separate competitor-gap
systems — all merged into single shared implementations on 2026-10-06).

| Risk | Existing single source of truth | What NOT to do |
|---|---|---|
| A second LLM/AI-provider client | `dev_tasks/local_llm.py` | Do not write a new Gemini/Groq/NVIDIA/local-LLM caller for Blog HTML Automation's generation step |
| A second FAQ-schema generator | `dev_tasks/faq_schema.py` | Do not write a new PAA-fetch → prompt → JSON-LD pipeline; extend this one for visible-FAQ HTML instead |
| A second competitor/content-gap search engine | `content_gap/core.py` + `content_gap_result` table | Do not add a new SerpAPI integration for the "max 3 content-gap sections" input |
| A second internal-link recommendation engine | `internal_linking/schema.py` (content index + suggestions table) | Do not build a new link-scoring system for the 4–8 internal links requirement |
| A second GSC API client or storage schema | `blog_optimization/gsc.py` + `gsc_sync.py` + its 2 tables | Do not call the GSC API directly from a new module for "high-click queries" — read the already-synced tables |
| A second meta-length/AI-shorten utility | `dev_tasks/seo_limits.py` | Do not hardcode title/description length limits again |
| A second duplicate-link/heading-structure fixer | `dev_tasks/html_fixes.py` | Reuse directly for 2 of the required QA checks |
| A second AI Overview / AEO tracker | `dev_tasks/geo_visibility` | Do not re-implement Google AI Overview detection — two alternative approaches (Playwright, direct-Gemini-answer-scanning) were already tried and explicitly rejected there |

## Why this matters specifically for Blog HTML Automation

Unlike most prior features, this one is designed to touch GSC data, competitor data, internal
links, FAQ schema, and AI generation all in one workflow — meaning it has a duplication surface
touching 6+ existing systems simultaneously, not just 1. Step 2 planning should explicitly check
this list before writing any new integration code.

## UPDATE (2026-10-07, same day) — a config-duplication risk, confirmed during the hardcoded-store-brand follow-up audit

Found during the follow-up hardcode-fix audit (see
`evidence/dm-dashboard/2026-10-07_hardcoded-store-brand-fix-audit_evidence.md`): there are now
**3 separate domain/store-keyed config dicts**, each with a slightly different shape, serving
overlapping purposes:

- `core/shopify_client.STORES` — Shopify store KEY → `{domain, token_env}`
- `blog_optimization/shopify.SITE_STORES` — public domain → `(store_key, domain)`
- `blog_optimization/gsc_sync.SYNC_SITES` — human label → `(gsc_site_url, token_fn)`

None is wrong on its own (each serves a genuinely different lookup direction), but a future fix
(e.g. the proposed `qa_check.py`/`faq_schema.py` domain-derivation fix) should reuse
`SITE_STORES`'s shape rather than inventing a 4th dict. If Blog HTML Automation or any future
task needs a FOURTH domain-keyed lookup (e.g. with locale/brand-label metadata, as the
`faq_schema.py` fix will), reuse/extend one of the existing 3 rather than adding a new one —
flagged here so it isn't missed later.

## Status

Open — relevant for the entire Step 2 build, not resolved by Step 1 (Step 1 only identifies the
risk; avoiding it is a Step 2 implementation discipline).
