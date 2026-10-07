# Blog HTML Automation — Step 2 Architecture & Integration Design

**Date:** 2026-10-07
**Project:** dm-dashboard
**Preceded by:** Step 1 audit (`evidence/dm-dashboard/2026-10-07_blog-html-automation-step1-audit_evidence.md`)
and the hardcoded store/brand fix (`closure/dm-dashboard/2026-10-07_hardcoded-store-brand-fix_closure.md`,
implemented same day — `qa_check.py` and `faq_schema.py` are now store-aware, confirmed by
re-reading both files for this design).
**Scope:** ARCHITECTURE ONLY. No backend routes, frontend pages, or database tables were
created. No existing Development Task was modified. Branch confirmed `dev-work`, untouched.

## 1. Objective

Design the final technical architecture for a new Development Task, "Blog HTML Automation,"
that generates one Shopify-ready HTML block for a new blog post — reusing every applicable
existing system in this codebase, extending only where the Step 1 audit confirmed a real gap,
and building new only where nothing reusable exists. This document is the blueprint Step 3
implementation will follow.

## 2. Existing Systems Reused

Re-confirmed by direct code inspection for this design (not just carried over from Step 1):

- `dev_tasks/local_llm.py` — `call_with_gemini_fallback(prompt, temperature=...)`, the one
  shared AI caller.
- `dev_tasks/faq_schema.py` — now store-aware (`_brand_context_for(page_url)`, fixed 2026-10-07)
  — `generate_faq_schema()`, `pick_internal_links()`.
- `dev_tasks/jsonld.py` — `extract_jsonld_blocks`, `find_jsonld_by_type`.
- `dev_tasks/seo_limits.py` — `check_length`, `shorten_text`.
- `dev_tasks/html_fixes.py` — `dedupe_links`, `fix_heading_structure`.
- `content_gap/core.py` — `run_analyze()`, `get_latest_for_page()`, table `content_gap_result`.
- `internal_linking/schema.py` — `list_pages()`, `list_suggestions()`, table
  `internal_linking_content_index`.
- `blog_optimization/gsc.py` + `gsc_sync.py` — own-Postgres GSC data, 3 confirmed sites.
- `core/shopify_client.py` — `graphql(store, query, variables)`, `STORES` registry.
- `core/background_job.py` (`BackgroundJob.get_or_start()`) + frontend
  `usePollingResource.js` — confirmed exact interface this session (read in full).
- `core/task_auth.py` (`make_task_auth(task_key)`, `require_any_login`) — confirmed exact
  interface this session (read in full): privileged roles (`admin`/`dev`) bypass the grant
  check; everyone else needs a row in `access_grants` for the task's key. GET endpoints use the
  weaker `require_any_login`; POST/PATCH/PUT/DELETE use `make_task_auth`.
- `geo_visibility/schema.py`'s `geo_visibility_content_actions` table — read as the proven
  precedent for "AI-drafted content with full regenerate history, human-editable final version
  stored separately" (`generation_history` JSONB array, `final_content`/`final_question`
  columns alongside `generated_content`/`generated_question`). This is the direct structural
  precedent for Blog HTML Automation's own draft/history persistence (§8).
- `frontend/src/taskRegistry.js` — `{ taskKey, label, kind: 'tool', load: () => import(...) }`
  registration shape.
- `frontend/src/lib/apiFetch.js` — the shared API wrapper every dev-task page uses.

## 3. Systems Extended (already done, confirmed, not to be re-touched)

- `qa_check.py` and `faq_schema.py`'s store/brand hardcodes — fixed 2026-10-07, per the prior
  closure. Blog HTML Automation should call these AS THEY NOW ARE; do not reintroduce a
  hardcoded domain assumption anywhere in the new package.

No further extension to existing files is proposed in this architecture — see §4 for why
`faq_schema.py`'s visible-FAQ gap (flagged in Step 1) is designed as a NEW adapter function
inside the new package instead, not a further edit to the shared file (§14 explains the
reasoning).

## 4. New Components

| Component | Why new | Notes |
|---|---|---|
| Input aggregation / orchestrator | No existing task aggregates GSC + content-gap + internal-links + Shopify product/image data for a NOT-YET-EXISTING page | §5/§6 |
| Clean & Group logic | Dedup/group across 3 different real data shapes (GSC queries, content-gap rows, AEO/GEO prompts) — no existing function does this combination | §9 |
| Outline planner | No existing task plans structure for a new page | §9 |
| Visible-FAQ generator (paired with existing schema generator) | Confirmed gap: `faq_schema.generate_faq_schema()` is schema-only | §14 |
| HTML assembler (product cards, scoped CSS, FAQ, CTA) | No existing task renders Shopify product data as embeddable HTML | §10 |
| Blog HTML Automation QA module (sibling to, not inside, `qa_check.py`) | New count-based checks; avoids coupling two tasks' logic | §11 |
| Result/history persistence | No existing table shape fits (§8) | §8 |
| New frontend page + registry entry | New Dev Task | §13 |

## 5. Complete Data Flow

```
Store/site selection                                            [NEW — UI dropdown]
  ↓
Blog topic / collection URL selection                           [NEW — UI input]
  ↓
Existing GSC data (blog_optimization.gsc tables)                [EXISTING — read only]
  ↓
Existing Content Gap data (content_gap.core.get_latest_for_page
  / run_analyze if not cached)                                  [EXISTING — read, or trigger a check]
  ↓
Existing AEO/GEO data (geo_visibility_results, read-only)        [EXISTING — read only, where available for the target site]
  ↓
Keyword/query collection (GSC high-click queries + AEO/GEO
  prompts + user-entered main keyword)                           [EXISTING data + NEW aggregation]
  ↓
Shopify product/image data (core.shopify_client.graphql)         [EXISTING — read only]
  ↓
Internal-link candidates (internal_linking.schema.list_pages()
  + faq_schema.pick_internal_links(), limit raised)               [EXISTING, limit EXTENDED]
  ↓
Clean & Group (dedupe, remove brand-only/off-topic, group by
  topic/intent)                                                   [NEW]
  ↓
Outline (1 main keyword, AEO/GEO as H2/FAQ, max-3 gap sections,
  cannibalisation check)                                          [NEW]
  ↓
LLM generation (dev_tasks.local_llm.call_with_gemini_fallback)    [EXISTING caller, NEW prompts]
  ↓
Visible FAQ generation (NEW adapter, reuses faq_schema's PAA/
  keyword logic) + FAQPage JSON-LD (EXISTING,
  faq_schema.generate_faq_schema's schema half)                   [EXISTING + NEW, same source data — see §14]
  ↓
HTML assembly (scoped .ls-blog CSS, product cards, links, images,
  visible FAQ, schema, CTA)                                       [NEW]
  ↓
QA (REUSE existing checks where applicable + NEW count-based
  checks, sibling module)                                         [EXISTING + NEW — see §11]
  ↓
Human review (Code/Preview toggle, same UI pattern as Blog
  Optimization's Current Blog HTML)                                [NEW UI, EXISTING pattern]
  ↓
Copy / Open Shopify (manual) — NO auto-publish                    [NEW UI, EXISTING no-write boundary]
  ↓
Confirm published (manual user action)                            [NEW]
  ↓
Result/history log                                                [NEW persistence]
```

## 6. Backend Architecture

Proposed package: `backend/app/dev_tasks/blog_html_automation/` (NOT created — design only).

| File | Responsibility | Existing dependency reused | New logic |
|---|---|---|---|
| `router.py` | APIRouter, all endpoints, `make_task_auth("tools.BlogHtmlAutomation")` gating (mirrors `blog_optimization/router.py`'s exact pattern) | `core.task_auth`, `core.background_job` | New endpoints only |
| `schema.py` | `ensure_schema()` + the new tables' CRUD functions (mirrors `blog_optimization/schema.py`'s shape) | `core.db.get_conn()` | New tables (§8) |
| `rules.py` | Single source of truth for Dilaksi's business-rule numbers (word count, product/link/image/FAQ counts, tolerance) — see §7 | None (new, deliberately small/isolated) | Named constants only, no logic |
| `inputs.py` | Input aggregation — calls into GSC, Content Gap, Internal Linking, Shopify, AEO/GEO and returns one assembled "available inputs" structure per §9/§5 | `blog_optimization.gsc`, `content_gap.core`, `internal_linking.schema`, `core.shopify_client`, `geo_visibility` read functions | Aggregation + availability-state logic (§17) |
| `outline.py` | Clean/group + outline planning (§9) | `content_gap` data shape, GSC query shape | New planning logic, possibly one LLM call for grouping/outline (TBD in Step 3, flagged as open question §23) |
| `generator.py` | HTML assembly — deterministic product-card/link/image rendering + LLM body-copy generation, orchestrates calls to `local_llm`, `faq_schema` adapter (§14), `html_fixes` | `dev_tasks.local_llm`, `dev_tasks.html_fixes`, `dev_tasks.faq_schema` (via adapter) | New prompt templates, new deterministic HTML-rendering functions |
| `faq_adapter.py` | Thin wrapper pairing a NEW visible-FAQ generation call with the EXISTING `faq_schema.generate_faq_schema()` schema call, from the same question/answer data (§14) | `dev_tasks.faq_schema` | New — the only new file that sits directly beside an existing shared module, by design (§14 explains why it's a sibling adapter, not an edit to `faq_schema.py` itself) |
| `qa.py` | Blog HTML Automation-specific QA — reuses `seo_limits`/`jsonld`/`html_fixes` directly (same imports `blog_optimization/qa_check.py` uses), adds the new count-based checks (§11) | `dev_tasks.seo_limits`, `dev_tasks.jsonld`, `dev_tasks.html_fixes` | New count-based checks only |
| `result_log.py` | Result/history persistence functions (§8) | `core.db.get_conn()` | New |

This mirrors `blog_optimization/`'s own file-per-concern shape (`gsc.py`, `shopify.py`,
`cause.py`, `qa_check.py`, `schema.py`, `router.py`) — an existing, proven convention in this
repo, not invented for this design.

## 7. Business Rules Configuration

**Proposed single source of truth:** `blog_html_automation/rules.py`, following
`seo_limits.py`'s exact precedent (`TITLE_MAX_LEN = 60`, `DESCRIPTION_MAX_LEN = 155` — simple
named module-level constants, no class, no config file, no database row).

```python
# Illustrative shape only — NOT implemented in Step 2.
WORD_COUNT_TARGET = 1500
WORD_COUNT_TOLERANCE_PCT = 10
PRODUCT_COUNT_MIN, PRODUCT_COUNT_MAX = 3, 6
INTERNAL_LINK_COUNT_MIN, INTERNAL_LINK_COUNT_MAX = 4, 8
IMAGE_COUNT_MIN, IMAGE_COUNT_MAX = 3, 5
FAQ_COUNT_MIN, FAQ_COUNT_MAX = 6, 8
MAX_CONTENT_GAP_SECTIONS = 3
FAQ_ANSWER_WORDS_MIN, FAQ_ANSWER_WORDS_MAX = 40, 60
```

Every generator, outline planner, and QA check imports from here — never redefines a number
locally. This directly prevents the exact magic-number scattering the Step 1 audit flagged as a
risk.

**Future configurability:** these are currently fixed, Dilaksi-specified numbers. If they need
to become admin-editable later (e.g. per-store tolerance), the natural extension (NOT designed
here, flagged as a future decision) would be a single-row settings table, following the same
"small, explicit, one purpose" pattern as this file — not a generic key-value config system.

## 8. Database / Persistence Design

**Existing tables checked for reuse first** (per the task's own instruction): `content_gap_result`,
`internal_linking_content_index`/`_suggestions`, `blog_optimization_gsc_page`/`_query`,
`geo_visibility_results`/`_content_actions` — none of these can hold "a generated draft blog
page and its own QA/review/publish lifecycle" without conflating two different tasks' data
under one roof. `geo_visibility_content_actions` is the closest shape (AI-drafted content +
regenerate history + human-edited final version + review status) but it is keyed to
`geo_visibility_results` (an AI-Overview-citation row) — the wrong foreign key for a brand-new
blog page that has no citation result to attach to. Confirmed: genuinely new persistence is
required, following that table's PROVEN SHAPE, not inventing a new one.

| Proposed table | Purpose | Key fields (illustrative) | Why existing table cannot be reused |
|---|---|---|---|
| `blog_html_automation_generation` | One row per generation attempt — the full lifecycle record | `id`, `site` (domain string, e.g. `ledsone.de`), `collection_url`, `main_keyword`, `inputs_snapshot` (JSONB — GSC/content-gap/AEO-GEO/product/link/image selections used), `outline` (JSONB), `generated_html`, `generation_history` (JSONB array, mirrors `geo_visibility_content_actions`'s proven pattern), `final_html`, `qa_result` (JSONB), `review_status`, `published_status`, `published_url`, `created_by`, `created_at`, `updated_at`, `published_at` | No existing table has this shape; closest precedent (`geo_visibility_content_actions`) is keyed to the wrong entity (an existing AI-Overview result, not a new blog page) |

**Deliberately NOT proposing** a separate "result log" table distinct from this one — the
generation record itself, once `published_status`/`published_url` are set, IS the result log
Dilaksi asked for (§9 of the original request: "URL, date, main keyword, AI visibility/AEO
tracking info"). AI-visibility/AEO tracking info is read from `geo_visibility` at query time
(joined by URL once the page is live and indexed by that system), not duplicated into this
table — avoids a second copy of AEO data drifting from the source of truth.

No table is created in Step 2. This is a design proposal only.

## 9. Input Aggregation / Outline Architecture

**Input availability classification** (per the task's explicit requirement):

| Input | Classification | Source |
|---|---|---|
| Collection URL | MANUAL (user selects/enters) | — |
| Main keyword | MANUAL, but OPTIONALLY pre-filled from the top GSC query for the selected topic if one exists | `blog_optimization.gsc` |
| AEO/GEO prompts | AUTO-FILLED when the site has `geo_visibility` data for related queries; UNAVAILABLE otherwise (no silent fallback) | `geo_visibility` |
| Content gap analysis | AUTO-FILLED if a cached `content_gap_result` row exists for a related page; OPTIONALLY user-triggered fresh check via `run_analyze()` (shared SerpAPI quota, cooldown applies) | `content_gap.core` |
| Collected keywords | AUTO-FILLED from GSC query data + content-gap competitor terms, OPTIONALLY EDITABLE | `blog_optimization.gsc` + `content_gap` |
| High-click GSC queries | AUTO-FILLED for the 3 confirmed-working sites; UNAVAILABLE for other sites (explicit state, not silent) | `blog_optimization.gsc` |
| Products | AUTO-FILLED (Shopify product search by the collection/keyword), OPTIONALLY EDITABLE (swap/remove) | `core.shopify_client` |
| Internal links | AUTO-FILLED via `internal_linking.schema.list_pages()` + `pick_internal_links()` (limit raised to 4–8), OPTIONALLY EDITABLE | `internal_linking` |
| Images | AUTO-FILLED (product CDN image URLs from the selected products), OPTIONALLY EDITABLE | `core.shopify_client` |
| Word count target | MANUAL default from `rules.py`, OPTIONALLY EDITABLE within the ±10% band | `blog_html_automation.rules` |

**Clean & Group (NEW, `outline.py`):** dedupe keyword/query strings case-insensitively; a
simple denylist-style filter for brand-only terms (mirroring `content_gap/discover_text.py`'s
existing non-retail denylist PATTERN as prior art, not its exact list — new list needed since
the domain differs); group by simple keyword-token overlap (same technique already proven in
`faq_schema.pick_internal_links`'s token-overlap matching) — no new NLP/clustering library
introduced, reusing the one technique already proven in this codebase for a similar problem.

**Outline planning (NEW):** the main keyword is user-selected (not auto-decided); AEO/GEO
prompts and GSC queries are grouped into candidate H2/FAQ topics; content-gap rows are capped to
`rules.MAX_CONTENT_GAP_SECTIONS` by taking the top-N by whatever relevance signal
`content_gap_core` already returns (status='ok' rows first, same ordering `get_latest_for_page`
already uses — reused, not reinvented). **Whether outline planning itself needs an LLM call, or
can stay fully deterministic (grouping + capping + keyword-overlap scoring), is an open question
for Step 3** (§23) — the grouping/dedup logic described above does not strictly require one;
an LLM call would only be needed if free-text topic naming beyond raw keywords is wanted.
**Cannibalisation check:** `french_keyword_research` has one, but it's FR-only and keyed to its
own French keyword dataset (confirmed via Step 1 audit) — reusing it as-is is not possible for
UK/DE sites. Proposed: a minimal new check, querying `blog_optimization.gsc` for existing blog
pages already ranking for the same main keyword/high-click queries on the target site (data
already available, no new source) — flagged as new logic, not a port of `french_keyword_research`'s
own implementation (that would need its own separate inspection, explicitly out of scope here).

## 10. HTML Generation Architecture

**Deterministic (never AI-generated):**
- Product card markup — rendered directly from real Shopify product data (title, price, image
  URL, product URL) fetched via `core.shopify_client`. The LLM never invents a product, price,
  URL, or image.
- Internal link `<a>` tags — rendered directly from `internal_linking`/`faq_schema.pick_internal_links`
  candidates, real URLs only.
- Image `<img>` tags — rendered directly from real Shopify CDN URLs, never invented.
- The scoped `.ls-blog` CSS wrapper itself (a fixed stylesheet, not AI-authored).
- FAQPage JSON-LD markup structure (existing `faq_schema.parse_llm_output`'s validated
  re-serialization — the JSON itself is AI-sourced content, but the wrapping/validation is
  deterministic, exactly as it is today).

**AI-generated (via `local_llm.call_with_gemini_fallback`):**
- Body copy — the actual written paragraphs/sections, grounded in the outline, main keyword,
  and real product/content-gap context passed into the prompt (not invented from nothing).
- Visible FAQ answers (NEW adapter, §14) — same PAA-question-grounded approach `faq_schema.py`
  already uses for schema, extended to also produce the visible text.
- Section headings (H2s) — AI-written text, but the OUTLINE (which topics become H2s, how many
  sections) is deterministic, decided in §9 before the LLM is called — the LLM fills in wording
  for a pre-decided structure, it does not decide the structure itself.

**Explicit guardrail (per the task's own instruction):** the AI is never the source of truth for
product data, URLs, images, prices, or specifications — those are always substituted from real
fetched data either before or after the LLM call, never trusted from LLM output. This mirrors
`faq_schema.py`'s own existing "do not invent specifications, wattages, prices or certifications"
rule and its `ensure_internal_link_present()`/`links_actually_mentioned()` pattern of verifying
AI output against ground truth rather than trusting soft instructions — same proven technique,
reused.

## 11. FAQ Architecture

**Decision: thin adapter, not an edit to `faq_schema.py`.** Rationale: `faq_schema.py` is
already consumed by 2 existing tasks (`blog_optimization`, `collection_thin_content`), neither
of which needs visible FAQ HTML — only Blog HTML Automation does. Adding a visible-HTML
generation path directly into the shared file would grow its surface area for callers that don't
need it, and risks an accidental behavior change for the 2 existing consumers. Instead:

`blog_html_automation/faq_adapter.py` calls the SAME underlying building blocks
`faq_schema.generate_faq_schema()` already uses internally
(`primary_keyword_for`, `collect_paa_questions`, `pick_internal_links`, `build_prompt`-style
prompt construction, `call_with_gemini_fallback`) but with ONE additional LLM call (or a single
extended prompt — Step 3 to decide which is more reliable) that asks for both the visible
question/answer text AND feeds the identical question set into the existing
`generate_faq_schema()` for the JSON-LD half — **guaranteeing both come from the same source
question list**, so they cannot silently diverge (the task's explicit requirement). This reuses
`faq_schema.py`'s existing public functions as a library; it does not fork or duplicate its PAA
fetch, keyword derivation, or JSON-LD validation logic.

**Backward compatibility:** zero changes to `faq_schema.py`'s existing public functions or their
signatures — `blog_optimization` and `collection_thin_content` are unaffected by construction.

## 12. QA Architecture

**Decision: sibling QA module (`blog_html_automation/qa.py`), not an extension of
`blog_optimization/qa_check.py`.** Rationale (confirmed via re-reading `qa_check.py` for this
design): `qa_check.py`'s checks are specifically scoped to EXISTING live blog pages (it fetches
the real published page to check meta tags, checks against a working DRAFT stored in
`blog_optimization_content_draft`) — Blog HTML Automation is checking a NOT-YET-PUBLISHED,
freshly-generated page with no live URL yet. Coupling the two would require `qa_check.py` to
branch its behavior based on "does this page exist live or not," adding complexity to a module
that currently has none of that, for the benefit of a consumer (`blog_optimization`) that would
never need the new checks. A sibling module importing the same underlying utilities
(`seo_limits`, `jsonld`, `html_fixes`) — exactly as `qa_check.py` itself does — avoids this.

| Check | REUSE / EXTEND / NEW | Basis |
|---|---|---|
| Heading structure (no skipped levels) | REUSE | Same `html_fixes`/`jsonld` style check logic as `qa_check._check_heading_structure`, reimplemented in `qa.py` against the generated (not yet live) HTML |
| No duplicate links | REUSE | `html_fixes.dedupe_links`'s detection logic |
| FAQ/schema consistency | REUSE (comparison logic) | Same visible-vs-schema comparison `qa_check._check_faq` already does, applied to the generated HTML directly (no live-page fetch needed — the HTML already exists in memory, unlike `qa_check.py`'s case) |
| UK/DE/FR spelling check | EXTEND | `qa_check._check_uk_english`'s word-list approach, extended with DE/FR equivalents per the site (reusing the same `_US_SPELLINGS`-style dict shape) |
| HTML structure valid | REUSE | `qa_check._check_html_valid`'s tag-balance heuristic |
| Meta title/description length | REUSE | `seo_limits.check_length`, applied to Blog HTML Automation's OWN generated meta (not a live-page fetch, since the page isn't live) |
| Word count ~1500 ±10% | NEW | `rules.py`'s `WORD_COUNT_TARGET`/`_TOLERANCE_PCT` |
| 3–6 product cards | NEW | Counts rendered product-card blocks against `rules.PRODUCT_COUNT_MIN/MAX` |
| 4–8 internal links | NEW | Counts real `<a>` tags matching the internal-link candidates used |
| 3–5 images | NEW | Counts `<img>` tags, live-checks each CDN URL resolves (reusing `competitor_analysis.http_fetch.polite_get`, same tool `qa_check.py` already uses for its own link-liveness check) |
| 6–8 FAQs | NEW | Counts visible FAQ Q/A pairs against `rules.FAQ_COUNT_MIN/MAX` |
| "No H1 in body" | NEW | Simple tag-absence check — the inverse of what `qa_check.py`'s current "H1 exists" check does, a genuinely different check, not a port |
| No placeholder text | NEW | Regex/keyword scan for common placeholder markers (`"Lorem ipsum"`, `"[INSERT"`, `"TODO"`, etc.) — new, small, deterministic |

Each check returns `{"status": "pass"|"fail"|"not_available", "detail": str}` — the exact same
shape `qa_check.py` already uses, for UI consistency (same frontend rendering component can be
reused, §13).

## 13. Frontend Architecture

**Proposed location:** `frontend/src/admin/pages/dev-tasks/BlogHtmlAutomation.jsx`, registered in
`taskRegistry.js` as `{ taskKey: 'tools.BlogHtmlAutomation', label: 'Blog HTML Automation', kind: 'tool', load: () => import('./admin/pages/dev-tasks/BlogHtmlAutomation') }` — exact shape
confirmed against `blog_optimization`'s real registration line.

**UI flow** (reusing `BlogOptimization.jsx`'s established CSS-class/layout conventions —
`jreq-section-card`, sticky quick-nav, `jreq-tab-btn` Code/Preview toggle, `jreq-inset-box`,
review-then-apply button pattern):

1. Select site/store (dropdown, populated from a site list the new backend derives the same way
   `gsc.SITES`/`shopify.SITE_STORES` already do — single source, not hardcoded)
2. Select/enter blog topic + collection URL
3. Review auto-collected inputs (GSC, content-gap, AEO/GEO, keywords) — each shown with its
   AVAILABLE/PARTIAL/UNAVAILABLE state (§17), editable where marked OPTIONALLY EDITABLE
4. Select assets (products, internal links, images) — pre-filled, swappable
5. Clean/group review (show the deduped/grouped keyword+topic groups before outline)
6. Build outline (shows the planned H2/FAQ structure before generation)
7. Generate (background job + `usePollingResource`, same pattern as Blog Optimization's
   `fix-faq-schema`)
8. QA results (same visual pattern as `qa_check.py`'s results list — pass/fail/not-available
   rows with inline detail)
9. Review HTML (Code/Preview toggle, identical component pattern to Blog Optimization's Current
   Blog HTML section)
10. Copy / "Open Shopify" button (opens the real Shopify admin in a new tab — does not write)
11. Confirm Published (manual checkbox/button) → writes the result record's `published_status`
12. History/result list (new tab on the same page, same table-list pattern as Blog Optimization's
    Completed tab)

All API calls go through `apiFetch` (`frontend/src/lib/apiFetch.js`), confirmed as the shared
wrapper every existing dev-task page uses.

## 14. See §11 (FAQ) — merged above per the document's natural flow.

## 15. Auth / UAM

- **Grantable Development Task tool**: yes, same model as every other dev task.
- **Proposed permission/task key**: `tools.BlogHtmlAutomation` (string constant, following the
  exact `tools.Dev*`/`tools.*` naming convention confirmed across `taskRegistry.js`).
- **Pattern**: `require_task_access = make_task_auth("tools.BlogHtmlAutomation")` for all
  write endpoints (generate, save draft, mark published); `require_any_login` for read endpoints
  (list history, fetch a draft) — exact same split `blog_optimization/router.py` already uses.
- **Existing UAM supports this without any change** — confirmed via reading `task_auth.py` in
  full: authorization is entirely driven by the `task_key` string and the existing
  `access_grants` table; no UAM schema or logic change is needed to add a new task key.

## 16. Background Processing

| Operation | Sync or Background? | Basis |
|---|---|---|
| Fetching already-cached GSC/content-gap/internal-link/AEO data | Synchronous | Already fast reads from this app's own Postgres |
| Fresh Content Gap check (`run_analyze()`, if no cache exists) | Background | Already a potentially-slow, SerpAPI-backed call in the existing engine |
| Full HTML generation (LLM body + FAQ) | Background | Confirmed pattern: `blog_optimization`'s own `fix-faq-schema` already treats a single LLM call as background-job-worthy (~90s) — full-page generation will be slower, same pattern applies |
| QA run | Synchronous | All proposed QA checks (§12) are fast — regex/count/parse operations, plus a few bounded `polite_get` calls (same bound `qa_check.py` already uses, `_MAX_LINKS_CHECKED`-style cap) |

Uses `core.background_job.BackgroundJob` + `usePollingResource` exactly as confirmed in §2 — no
new job system.

## 17. Error / Partial Data Handling

Per-input states, surfaced explicitly in the UI (§13 step 3), never silently fabricated:

| Condition | State shown |
|---|---|
| Selected site has no confirmed GSC access (not one of the 3 working sites) | UNAVAILABLE — "GSC data isn't available for this site" |
| Selected site is `ledsone.de` and blog content access is still missing `read_content` | UNAVAILABLE for any input requiring live Shopify blog-content read (does not block product/image data, which is a different Shopify scope) |
| Content Gap quota exhausted (`content_gap/core.py`'s own reserve-floor check) | PARTIAL — "Content gap check unavailable right now (quota reserved), continuing without it" |
| FAQ PAA quota (Scrape.do) unavailable | PARTIAL — FAQ generation proceeds with fewer/no PAA-sourced questions, clearly labelled, never fabricated questions |
| LLM provider chain fully fails (local + Gemini + Groq + NVIDIA all down, confirmed as a real occurrence this session, 2026-10-06) | FAILED — generation step fails cleanly, same combined-error-message pattern `call_with_gemini_fallback` already returns |
| No product/image/internal-link candidates found for the topic | UNAVAILABLE for that asset type — QA's corresponding count check reports FAIL (not NOT_AVAILABLE, since absence is a determinable fact, not a judgment call) |

No input silently defaults to fabricated or guessed data anywhere in this design — matches the
existing codebase's consistent "not_available over fabricated pass" discipline (confirmed in
`qa_check.py`, `faq_schema.py`, and `content_gap/core.py` alike).

## 18. Duplicate Prevention

Verified against the Step 1 duplicate-risk list before finalizing: this architecture proposes
NO second GSC client, NO second Shopify client, NO second LLM client, NO second content-gap
engine, NO second internal-linking engine, NO second SEO-limits/HTML-fixes/JSON-LD utility, and
NO second AEO/GEO tracker. The one new adapter (`faq_adapter.py`, §11) explicitly calls into
`faq_schema.py`'s real functions rather than reimplementing PAA fetch or JSON-LD generation —
confirmed not a duplicate, an adapter.

## 19. Security Considerations

- No new credential/token handling — every external call (Shopify, GSC, SerpAPI, Scrape.do, LLM
  providers) goes through the existing clients, which already own their own auth.
- `make_task_auth` gating on every write endpoint, matching every other dev task — no
  publicly-reachable write path.
- No Shopify write capability is introduced anywhere in this design (§12 of the original task
  request, explicitly honored) — the "Copy / Open Shopify" step opens Shopify's own admin UI in
  a new tab, it does not call any Shopify write API.
- Generated HTML is never auto-injected into any live page — it exists only in this app's own
  database and the user's clipboard until they manually paste it.

## 20. Step 3 Implementation Plan

1. Create `backend/app/dev_tasks/blog_html_automation/` with `rules.py` first (no dependencies,
   defines the constants everything else needs).
2. Build `inputs.py` (read-only aggregation across existing systems) — testable in isolation
   against real data before any generation logic exists.
3. Build `schema.py` + `ensure_schema()`, wire into `dev_tasks/__init__.py`'s
   `ensure_dev_task_schemas()` (existing convention).
4. Build `outline.py` (clean/group/plan — deterministic logic first, decide the LLM-vs-not
   question from §9's open item before/during this step).
5. Build `faq_adapter.py`, live-test against a real site's real PAA data before wiring into the
   full generator.
6. Build `generator.py` (HTML assembly + LLM body generation), live-test the deterministic
   product-card/link/image rendering separately from the AI body-copy call.
7. Build `qa.py`, live-test every check against a real generated sample.
8. Build `router.py` + `result_log.py`, wire `make_task_auth`/background-job endpoints.
9. Register in `taskRegistry.js`, build the frontend page reusing Blog Optimization's layout
   conventions.
10. End-to-end live test: one real generation for a UK site, confirm every QA check and the
    review/copy/manual-publish flow work against real Shopify/GSC data, not mocked data.
11. Only after UK is proven: confirm DE/FR behave correctly (DE blog-content read is still
    blocked pending the Shopify scope grant — `inputs.py` must surface that as UNAVAILABLE
    cleanly for DE, not crash).

## 21. Open Questions / Unknowns

- **Does outline planning need its own LLM call, or can it stay fully deterministic?** (§9) —
  not resolved by this audit/design; a Step 3 decision based on how good deterministic
  keyword-overlap grouping turns out to be in practice.
- **Exact cannibalisation-check logic** (§9) — proposed as new, GSC-based logic; not yet
  designed in detail (query shape, thresholds) — NOT CONFIRMED, requires a focused design pass
  in Step 3 before implementation, not assumed here.
- **Collection vs. blog page generation** — Dilaksi's inputs mention "Collection URL" as an
  input, but the output is "blog HTML automation" generating a NEW BLOG POST (per the original
  Step 1 request's title). This design assumes the collection URL is a CONTEXT INPUT (the blog
  post is about/linked-from a collection), not that the tool generates collection PAGE content
  itself — **NOT CONFIRMED, needs Kuberan/the SEO operator to clarify this exact relationship
  before Step 3**, since it changes what `inputs.py` fetches first.
- **German/French generated BODY COPY locale correctness** — the `faq_schema.py` fix (§3)
  handles FAQ-prompt locale; the new body-copy generator (§10) will need the same domain-derived
  locale-context approach applied consistently — flagged to ensure Step 3 doesn't reintroduce a
  hardcoded-English assumption in the NEW prompt code, even though the OLD hardcode was just
  fixed.
- **`dcvoltage.co.uk` scope** — Step 1 flagged this as a decision point (has Shopify access, no
  confirmed GSC access); still not resolved, carried forward as an open question.

## 22. Site/Store Resolution (cross-reference, consolidating §6 of the request)

No new store configuration proposed. `inputs.py` resolves store/domain/brand/locale/Shopify
config/GSC property entirely by looking up the site string against the SAME 3 existing
domain-keyed structures already confirmed in Step 1/the hardcode fix:
`core.shopify_client.STORES` (Shopify auth), `blog_optimization.gsc.SITES`/`gsc_sync.SYNC_SITES`
(GSC access), and `faq_schema._BRAND_CONTEXT_BY_DOMAIN` (brand/locale text, added 2026-10-07).
No fourth config dict is introduced — this directly satisfies the duplicate-risk note added to
`duplicate-risk/2026-10-07_blog-html-automation-step1-audit_duplicate_risk.md`'s same-day update
about avoiding a 4th domain-keyed structure.
