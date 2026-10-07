# Blog HTML Automation — Step 1 Audit

**Date:** 2026-10-07
**Project:** dm-dashboard (FastAPI backend + React/Vite frontend)
**Developer/owner:** Kuberan
**SEO user/operator:** Dilaksi
**Scope:** audit + integration mapping ONLY. No new routes, pages, tables, or feature code were
created. No existing feature was modified.

## Original request (preserved verbatim, summarized structure)

New feature: **Blog HTML Automation — Shopify Ready-to-Publish Generator.** Dilaksi's required
workflow: (1) collect inputs — collection URL, main keyword, AEO/GEO prompts, content gap
analysis, collected keywords, high-click GSC queries, product list, internal links, images, word
count target; (2) add page assets — products, internal links, images; (3) clean and group —
dedupe, remove brand-only/off-topic items, group by topic/intent; (4) plan outline — one main
keyword, AEO/GEO prompts as H2/FAQ, max 3 content-gap sections, check cannibalisation; (5)
generate HTML — scoped `.ls-blog` CSS, 3–6 product cards, 4–8 internal links, 3–5 live CDN
images, 6–8 FAQs, UK English, no H1, no external CSS/JS, ~1500 words ±10%; (6) FAQ schema
exactly matching visible FAQs; (7) QA across all the above; (8) human review + manual Shopify
paste/publish (no auto-publish); (9) log result (URL, date, main keyword, AI visibility/AEO
tracking info).

---

## 1. Existing Capabilities Reusable

| Capability | Existing Location | Reuse Method | Notes |
|---|---|---|---|
| Local LLM + fallback chain | `backend/app/dev_tasks/local_llm.py` (`call_local_llm`, `call_with_gemini_fallback`) | Import directly | Consolidated 2026-10-06 from 8 separate copies. `call_with_gemini_fallback` chains Local → Gemini (multi-key) → Groq → NVIDIA NIM, all inside `ai_chat/ai_shared.py`'s `call_gemini()`. Pass `temperature=0.9` for any regenerate-style call (confirmed live bug otherwise: identical output on retry). |
| JSON-LD extraction | `dev_tasks/jsonld.py` (`extract_jsonld_blocks`, `find_jsonld_by_type`) | Import directly | Used to verify FAQ schema presence against a live/generated page. |
| Meta length check + AI-shorten | `dev_tasks/seo_limits.py` (`check_length`, `shorten_text`) | Import directly | `TITLE_MAX_LEN=60`, `DESCRIPTION_MAX_LEN=155` — one shared constant, was inconsistent across 3 places before 2026-10-06. |
| Deterministic HTML fixes | `dev_tasks/html_fixes.py` (`dedupe_links`, `fix_heading_structure`) | Import directly | No-AI, instant. Directly covers 2 of Dilaksi's QA checks. |
| FAQ schema generation pipeline | `dev_tasks/faq_schema.py` (`generate_faq_schema`) | Import + extend (see §2) | **SCHEMA ONLY** — generates FAQPage JSON-LD from real PAA questions, does NOT generate visible FAQ HTML. Confirmed by reading the full module: `parse_llm_output()` extracts only a `<script type="application/ld+json">` block; no visible-content path exists. |
| Internal link relevance matching | `faq_schema.pick_internal_links()` (token-overlap against Internal Linking's content index) | Import + extend (see §2) | Currently capped `limit=3`; Dilaksi needs 4–8. |
| Internal Linking content index | `internal_linking/schema.py` (`list_pages()`) table `internal_linking_content_index` | Read directly | Already-indexed products/collections/blogs with `content_text`, `target_keywords`, `shopify_status`, `in_stock` — real Shopify-sourced data, kept fresh by the Internal Linking task's own refresh. |
| Internal Linking pre-scored suggestions | `internal_linking/schema.py` (`list_suggestions()`) table `internal_linking_suggestions` | Read, filtered | Confidence/priority-scored link suggestions, but keyed by an EXISTING source page — a brand-new blog post (not yet in the content index) has no suggestions pointing FROM it yet. Usable for inbound-link discovery (what could later link TO the new post), not for its own outbound 4–8 links at generation time. |
| Competitor/content-gap engine | `content_gap/core.py` (`run_analyze`, `get_latest_for_page`) table `content_gap_result` | Call directly | One shared engine + one shared cache table already used by both Content Gap Analysis's own page AND Blog Optimization's Likely Cause (merged 2026-10-06, replacing Blog Optimization's own now-deleted separate competitor system). SerpAPI-backed, quota-limited (20s cooldown, 15-credit reserve, shared `sajeepan_lens_quota`). |
| Shopify Admin GraphQL client | `core/shopify_client.py` (`graphql(store, query, variables)`) | Import directly | Pre-authenticated per store via `STORES` dict (see §6). |
| GSC data (3 confirmed-working sites) | `dev_tasks/blog_optimization/gsc.py`, `gsc_sync.py`, tables `blog_optimization_gsc_page`/`_query` | Read directly (NOT via `gsc_sync` — see §7) | Own-Postgres, synced weekly, already covers page+query clicks/impressions/ctr/position for `ledsone.co.uk`, `ledsone.de`, `ledsone.fr`. |
| Non-blocking slow-call pattern | `core/background_job.py` + frontend `usePollingResource` | Reuse the pattern | Standard "start, return immediately, poll status" — HTML generation (likely 30–90s+) should use this, same as `fix-faq-schema` already does. |
| Scheduled background job helper | `core/scheduled_snapshot.py` (`ScheduledSnapshot`) | Reuse IF a periodic sync is ever needed | Not obviously needed for Blog HTML Automation itself (an on-demand generator, not a scheduled scan) — flagged for Step 2 to confirm. |
| Dev Task registration pattern | `frontend/src/taskRegistry.js` (`kind: 'tool'`, lazy `import()`), `backend/app/core/task_auth.py` (`make_task_auth(taskKey)`) | Follow exact pattern | Confirmed via `blog_optimization`'s own registration: `taskKey: 'tools.DevBlogOptimization'` in `taskRegistry.js` + `require_task_access = make_task_auth("tools.DevBlogOptimization")` in its router. |

---

## 2. Existing Capabilities to Extend

| Capability | Existing Location | Required Extension | Reason |
|---|---|---|---|
| `faq_schema.generate_faq_schema()` | `dev_tasks/faq_schema.py` | Add a visible-FAQ-HTML generation path (currently schema-only) | Dilaksi needs 6–8 **visible** FAQs in the generated HTML, with schema that "must exactly match" them — the schema side exists, the visible side does not. |
| `faq_schema.pick_internal_links()` | `dev_tasks/faq_schema.py` | Raise `limit` param (currently capped effectively at 3 in its only caller) to support 4–8 | Logic (token-overlap against `list_pages()`) already works; only the count needs changing. Confirm whether token-overlap alone is precise enough at 4–8 links, or whether `internal_linking_suggestions`' confidence scoring should be blended in. |
| `blog_optimization/qa_check.py` | `backend/app/dev_tasks/blog_optimization/qa_check.py` | Add new checks: word count (~1500 ±10%), image count (3–5), product-card count (3–6), internal-link count (4–8), FAQ count (6–8), explicit "no `<h1>` in body" check, placeholder-text detection | Existing 15 checks cover heading structure, duplicate links, meta length, FAQ presence/schema-match, UK English, HTML validity — none of Dilaksi's count-based rules exist yet. See §9 for the full REUSE/EXTEND/NEW classification. |
| `content_gap/core.run_analyze()` | `content_gap/core.py` | Cap/select "max 3" sections at the Blog HTML Automation consumer level | `run_analyze` can return a competitor row per candidate (not capped at 3 itself) — the 3-section cap is a Blog HTML Automation business rule, not something to change in the shared engine. |
| `core/shopify_client.STORES` | `core/shopify_client.py` | None required for the 3 already-configured relevant stores (`ledsone_uk`, `ledsone_de`, `ledsone_fr`) — only extend if Dilaksi needs a store not currently in `STORES` (e.g. `dcvoltage` has a Shopify token but no confirmed GSC access, see §6/§7) | Confirm scope with Dilaksi before assuming multi-store from day one. |

---

## 3. New Capabilities Required

| Capability | Why New | Expected Location |
|---|---|---|
| Visible-FAQ HTML generation (paired with schema) | No existing pipeline generates visible FAQ content, only schema (see §2) | New function in a new `blog_html_automation` package, calling `faq_schema`'s PAA/keyword logic but adding an HTML-output step |
| Outline planner (main keyword + AEO/GEO prompts as H2/FAQ + max-3-gap sections + cannibalisation check) | No existing task plans a page outline from mixed inputs — Blog Optimization and Content Gap both analyze EXISTING pages, never plan a new one | New, `blog_html_automation` |
| Full-page HTML generator (scoped `.ls-blog` CSS, product cards, image embedding, ~1500-word body) | No existing task generates a complete new blog page. The closest precedent (the deleted "Generate Optimized Content" full-page AI rewrite, removed from Blog Optimization 2026-10-07 per explicit instruction) was REMOVED, not a reusable pattern — Blog Optimization now deliberately does small compounding fixes, not full generation | New |
| Product card HTML renderer (3–6 real product cards from Shopify data) | No existing dev task renders Shopify product data as an embeddable HTML card — all existing tasks only read/display product data in the dashboard UI, never generate storefront-facing HTML for it | New |
| AEO/GEO prompt ingestion as a page-planning input | `geo_visibility` tracks whether EXISTING pages are cited in AI Overviews (a measurement tool, read-only) — it does not generate prompts/content from AEO/GEO signals for a NEW page | New consumer logic; `geo_visibility`'s query/classification data can inform it (see §8) but the generation step itself is new |
| Word-count / product-card-count / image-count / link-count / FAQ-count QA checks | Not present in `qa_check.py` today (see §2, §9) | Extend `qa_check.py` or a new sibling module in the new package |
| "No `<h1>` in body" structural check | `qa_check.py`'s current "H1 exists" check means the OPPOSITE of what Dilaksi needs (it currently checks the article TITLE is non-empty, not that the body HTML lacks an `<h1>` tag) | New/renamed check |
| Cannibalisation check against existing keyword/URL mapping | `french_keyword_research` has cannibalisation analysis, but scoped to `ledsone.fr` only and keyed to its own French keyword dataset — no UK-site equivalent exists | New, or a UK-scoped port of `french_keyword_research`'s approach — needs its own inspection in Step 2 if reuse is pursued |
| Result log (URL, date, main keyword, AI visibility/AEO tracking) | No existing table stores "a new page was generated/published, here's its tracking info" | New table, new package |

---

## 4. Duplicate Systems We Must NOT Build

- **A second LLM/Gemini/Groq/NVIDIA client.** Reuse `dev_tasks/local_llm.py` exactly. This
  codebase already consolidated 8 independent copies into one (2026-10-06) specifically to stop
  this kind of drift.
- **A second FAQ-schema generation pipeline.** `faq_schema.py` already does PAA fetch → keyword
  derivation → LLM call → validated JSON-LD. Extend it for visible HTML, don't rewrite the
  schema half.
- **A second competitor/content-gap search engine.** `content_gap/core.py` is already the single
  shared engine (consolidated 2026-10-06, replacing Blog Optimization's own prior separate
  system). A second one would duplicate SerpAPI quota usage unnecessarily.
- **A second internal-linking recommendation engine.** `internal_linking`'s content index +
  suggestion table already exist and are actively maintained (density checks, eligibility
  re-validation on every read). A parallel link-picker would drift from it immediately.
- **A second GSC API client or GSC storage table.** `blog_optimization/gsc.py` +
  `gsc_sync.py` + its two tables are the proven, live-tested pattern (including the
  hard-won fix for GSC's mixed int/float ctr/position values breaking a naive `unnest()`
  upsert, 2026-10-06). A second GSC integration would re-hit bugs already fixed once.
- **A second meta-length / AI-shorten utility.** `seo_limits.py` is the single source of truth
  after 3 previously-disagreeing copies were unified 2026-10-06.
- **A second duplicate-link / heading-structure fixer.** `html_fixes.py` already does this,
  deterministically, for free.
- **A second Google AI Overview / AEO tracker.** `geo_visibility` already does this (SearchAPI.io
  based, after two other approaches — Playwright and "ask Gemini directly" — were tried and
  explicitly rejected as not working/not measuring the right thing). Blog HTML Automation should
  consume its data, not re-implement AI Overview detection.

---

## 5. Data Flow Recommendation

Only connections actually supported by this audit are shown. Items marked **(NEW)** have no
existing implementation to call.

```
GSC (live API, 3 confirmed sites only)
  → blog_optimization.gsc_sync / gsc.py (own Postgres, weekly-synced)
  → high-click queries, page/query clicks+impressions+ctr+position

Content Gap
  → content_gap.core.run_analyze() / get_latest_for_page()
  → competitor gap rows (cap to 3 at the Blog HTML Automation consumer level)

AEO/GEO
  → geo_visibility (existing query/citation data, read-only)
  → informs which AEO/GEO prompts are worth targeting (NEW: prompt-to-outline logic)

Shopify products/images
  → core.shopify_client.graphql(store, ...)
  → product list, price, CDN image URLs (NEW: product-card HTML renderer)

Internal Links
  → internal_linking.schema.list_pages() + faq_schema.pick_internal_links() (extended to 4-8)
  → candidate internal links scored by topic overlap

Clean/Group (NEW)
  → dedupe prompts/keywords/GSC queries, remove brand-only/off-topic, group by intent

Outline Planning (NEW)
  → one main keyword + AEO/GEO prompts as H2/FAQ + max-3 content-gap sections
  → cannibalisation check (NEW — no existing UK-site equivalent; french_keyword_research's
    approach is FR-only and would need its own Step 2 inspection before reuse is assumed)

LLM Generation
  → dev_tasks.local_llm.call_with_gemini_fallback() (existing, reused as-is)
  → full page HTML body (NEW generation logic), visible FAQ content (NEW, paired with EXISTING
    faq_schema.generate_faq_schema()'s schema-generation half)

FAQ Schema
  → faq_schema.generate_faq_schema() (existing, schema half reused; visible half is NEW)

QA
  → blog_optimization.qa_check.py checks REUSED where applicable (heading structure, duplicate
    links, meta length, FAQ schema-vs-visible match, UK English, HTML validity)
  → NEW checks for word count, image/product-card/link/FAQ counts, "no H1 in body"

Review
  → human review (NEW UI, no backend change — matches every existing dev task's own review step)

Manual Shopify Publish
  → NO existing Shopify blog-content WRITE access anywhere in Development Tasks (see §6) —
    Current Blog HTML Code/Preview + Copy pattern from Blog Optimization is the precedent to
    follow, not a new write integration

Result Log (NEW)
  → URL, date, main keyword, AI visibility/AEO tracking info — new table, no existing equivalent
```

---

## 6. Database Reuse Map

| Existing table | Purpose | Can Reuse? |
|---|---|---|
| `blog_optimization_gsc_page` / `_query` | Weekly-synced live GSC page/query metrics, 3 sites | **Read directly** for "high-click GSC queries" input |
| `content_gap_result` | Shared competitor/content-gap cache (Content Gap Analysis + Blog Optimization) | **Read directly** via `content_gap.core.get_latest_for_page()`; write via `run_analyze()` if a fresh check is needed |
| `internal_linking_content_index` | Products/collections/blogs indexed with content text, keywords, stock/status | **Read directly** for internal-link candidate matching |
| `internal_linking_suggestions` | Pre-scored link suggestions (confidence/priority) | **Read, filtered** — only useful for links INTO an existing page, not a brand-new one at generation time (see §1) |
| `blog_optimization_task` / `_cause` / `_content_draft` / `_fix_log` | Blog Optimization's own task-tracking, likely-cause cache, working HTML draft, applied-fix history | **Pattern to follow, not reuse directly** — Blog HTML Automation is generating NEW pages, not tracking fixes to existing ones; a parallel-shaped but separate table set is appropriate |
| `geo_visibility_queries` / `_results` / `_content_actions` | AI Overview query tracking + citation results + content-action log | **Read** for AEO/GEO signal input; the `_content_actions` table's pattern (AI-generated content with a `generation_history` JSONB array preserving every draft, confirmed in the capability record below) is directly relevant prior art for Step 2's own generated-content storage design |
| — | Result Log (URL, date, keyword, AI visibility tracking) | **No existing table** — genuinely new persistence required, confirmed by inspecting the above; do not create in Step 1 |

---

## 7. Frontend Reuse Map

| Existing page/component/hook | Purpose | Reuse method |
|---|---|---|
| `frontend/src/admin/pages/dev-tasks/BlogOptimization.jsx` | Closest existing UI precedent: tabs/sections (`jreq-section-card`, `id="sec-*"` + sticky quick-nav), Code/Preview toggle for HTML (`jreq-tab-btn`), review-then-apply Fix/Apply button pattern, QA checklist rendering | Copy the layout/CSS-class conventions, not the component itself |
| `frontend/src/taskRegistry.js` | Registers every `kind: 'tool'` Dev Task with a `taskKey` + lazy `import()` | Add one new entry here (confirmed exact shape via `blog_optimization`'s own line: `{ taskKey: 'tools.DevBlogOptimization', label: ..., kind: 'tool', load: () => import(...) }`) |
| `core/task_auth.make_task_auth(taskKey)` | User Access Management gating, same `taskKey` string shared between frontend registry and backend router dependency | Use a new `taskKey` (e.g. `tools.BlogHtmlAutomation`), same pattern as `require_task_access = make_task_auth("tools.DevBlogOptimization")` |
| `usePollingResource` hook (paired with `core/background_job.py`) | Standard polling pattern for any slow backend call | Reuse for HTML generation, same as Blog Optimization's `fix-faq-schema` start+poll endpoints |
| `frontend/src/lib/apiFetch.js` (the shared API wrapper confirmed in use across every dev task page, e.g. `BlogOptimization.jsx`'s `api()` helper) | Auth header + base URL handling | All new API calls must go through this, per the audit instructions |

---

## 8. Store/Permission Limitations

Confirmed from code/config, no secrets exposed:

- **GSC live API access is confirmed for only 3 sites**: `ledsone.co.uk`, `ledsone.de` (shared
  `GSC_SERVICE_ACCOUNT_KEY`, same credential also used for GA4), `ledsone.fr` (dedicated
  `GSC_LEDSONE_FR_SERVICE_ACCOUNT`). 5 other sites (`ledsone.us`, `dcvoltage.co.uk`,
  `vintagelite.co.uk`, `electricalsone.co.uk`, `besbet.co.uk`) returned HTTP 403 in a live test
  (2026-10-06) — not fixable in code, needs GSC property access granted to one of the two
  service accounts.
- **Shopify Admin API is configured for 5 stores** (`core/shopify_client.STORES`): `ledsone_de`,
  `ledsone_uk`, `ledsone_fr`, `ledsone_uk_alttext` (a separate, narrowly-scoped write-only token
  for alt text ONLY), `dcvoltage`. **No Shopify credential exists at all** for `ledsone_us`,
  `vintagelite`, `electricalsone`, `besbet` — any of these would need a new `STORES` entry +
  Admin app + token before Blog HTML Automation could touch them.
- **`ledsone_de`'s Shopify token is missing the `read_content` scope** (confirmed live,
  2026-10-06: `ACCESS_DENIED` on the `articles` GraphQL field). GSC data for DE works; blog
  content does not, until that scope is granted in Shopify admin.
- **No Development Task has general Shopify blog-content WRITE access.** The only write access
  anywhere in Development Tasks is `alt_text_keywords/shopify_write.py` — writes an image's alt
  text ONLY when currently empty, re-checked live immediately before writing, via its own
  separately-scoped token (`ledsone_uk_alttext`). Blog HTML Automation must not assume
  auto-publish is possible without new Shopify app permissions and new write code — explicitly
  out of scope for Step 1 per the audit instructions, and not recommended for Step 2 without a
  deliberate, separate decision.
- **Content Gap Analysis / SerpAPI competitor search runs on a shared, metered quota**
  (`sajeepan_lens_quota`), with a 20-second cooldown and a 15-credit reserve floor enforced in
  `content_gap/core.py`. Blog HTML Automation's "max 3 content-gap sections" generation step
  will compete for this same quota — worth confirming expected call volume with Dilaksi before
  Step 2.
- **FAQ generation's PAA (People Also Ask) questions come from Scrape.do**, a second
  credit-metered shared integration (`automation_task/dilaksi_faq_scrapedo.py`), fetched only on
  explicit user click and cached by the caller. Same consideration as above — Blog HTML
  Automation's "6–8 FAQs" step will also draw from this shared budget.

---

## 9. QA Requirement Mapping (REUSE / EXTEND / NEW / NOT CURRENTLY CHECKABLE)

| Dilaksi requirement | Classification | Existing basis |
|---|---|---|
| Heading structure (no skipped levels) | **REUSE** | `qa_check._check_heading_structure` / `html_fixes.fix_heading_structure` |
| No duplicate links in same section | **REUSE** | `qa_check._check_duplicate_links` / `html_fixes.dedupe_links` |
| FAQ schema matches visible FAQ | **REUSE** (schema-vs-visible comparison logic) + **EXTEND** (visible FAQ doesn't exist yet to compare against until §2/§3's new generation step is built) | `qa_check._check_faq` already compares visible-FAQ-text-found vs FAQPage-schema-present |
| UK English | **REUSE** | `qa_check._check_uk_english` (confirmed non-exhaustive, explicitly labelled as such) |
| HTML/content structure valid | **REUSE** | `qa_check._check_html_valid` (tag-balance heuristic, not a full validator) |
| Meta title/description length | **REUSE** | `qa_check._check_meta_title`/`_check_meta_description` via `seo_limits.check_length` — NOTE: these currently fetch the LIVE published page's `<title>`/meta tags, which won't exist yet for a not-yet-published new page; needs adapting to check the generated HTML's own injected meta instead |
| Word count ~1500 ±10% | **NEW** | No word-count check exists anywhere in `qa_check.py` |
| 3–6 product cards present | **NEW** | No product-card concept exists in QA at all |
| 4–8 internal links | **EXTEND** | `qa_check._check_internal_links` currently returns `not_available` with SUGGESTIONS only (judgment call, not a count check) — would need a real count-based pass/fail added |
| 3–5 live CDN images | **NEW** | No image-count or image-liveness check exists |
| 6–8 FAQs | **NEW** | No FAQ-count check; current FAQ check is presence/schema-match only |
| No `<h1>` in body | **NEW / MISNAMED EXISTING** | `qa_check.items["H1 exists"]` currently checks the ARTICLE TITLE is non-empty — the opposite concept from "no h1 tag in the body HTML" |
| No placeholder text | **NEW** | Not checked anywhere |
| Main keyword placement | **NOT CURRENTLY CHECKABLE** | Explicitly `not_available` today — "No target keyword is stored anywhere in this system to check placement of." Blog HTML Automation would need to pass its own stored main keyword through to make this checkable for the first time |
| Product/collection links valid | **REUSE** | `qa_check._check_product_collection_links` (bounded live-fetch check, max 10 links) — **hardcoding risk**: falls back to `https://ledsone.co.uk{href}` for relative URLs (see §10) |

---

## 10. Hardcoding Risks

Found by direct code inspection (`grep`/read), not assumption:

- **`blog_optimization/qa_check.py` line ~107**: `url = href if href.startswith("http") else f"https://ledsone.co.uk{href}"` — hardcodes the UK domain as the fallback for any relative product/collection link. A real risk if Blog HTML Automation reuses this check for `ledsone.de`/`ledsone.fr`.
- **`dev_tasks/faq_schema.py`'s prompt template** (`_PROMPT_TEMPLATE`) opens with `"You are an SEO content specialist for ledsone.co.uk, a UK LED lighting e-commerce store on Shopify."` — hardcoded brand/domain/locale text baked into the LLM prompt itself, not parameterized per store.
- **`blog_optimization/gsc.py`'s `SITES`/`HOST_TO_SITE_URL`** are correctly NOT hardcoded independently — they derive from `gsc_sync.SYNC_SITES` (confirmed via import check, single source of truth) — a good pattern to copy, not a risk, noted here for contrast.
- **`core/shopify_client.STORES`** is a small, manually-maintained dict — adding a new store requires a code change (new dict entry + new token env var), not data-driven. Acceptable for this codebase's scale but worth knowing it's not auto-discovered.
- **Dilaksi's business-rule numbers are NOT currently defined anywhere in code** (1500 words, 3–6
  products, 4–8 links, 3–5 images, 6–8 FAQs, max 3 content gaps, 40–60 word FAQ answers, ±10%
  tolerance) — because the feature doesn't exist yet. Flagged here as a Step 2 design
  requirement: define these once as named constants (following `seo_limits.py`'s
  `TITLE_MAX_LEN`/`DESCRIPTION_MAX_LEN` precedent) rather than letting them scatter as magic
  numbers across a new generator/QA module.
- **No site/store selector was found to be hardcoded in Blog Optimization after its 2026-10-06
  migration** — `SITES` is derived, not listed. `shopify.py`'s `SITE_STORES` dict (host → store
  key + domain) is the correct precedent for Blog HTML Automation's own site selection, not a
  single hardcoded store.

---

## 11. Recommended Step 2 Architecture

Based only on what this audit confirmed:

1. New package `backend/app/dev_tasks/blog_html_automation/` — own router, schema (result log +
   generation-draft tables, shaped like `geo_visibility_content_actions`'s
   `generation_history` JSONB-array pattern for safe regenerate), and generation pipeline module.
2. Reuse, unmodified: `local_llm.py`, `seo_limits.py`, `html_fixes.py`, `jsonld.py`,
   `content_gap.core`, `internal_linking.schema.list_pages()`, `core.shopify_client.graphql()`,
   `core.background_job`/`usePollingResource`.
3. Extend, in place, with care not to break existing callers: `faq_schema.py` (add a visible-FAQ
   generation function alongside the existing schema-only one; raise `pick_internal_links`'s
   usable limit); `blog_optimization/qa_check.py` is NOT the right place to add Blog HTML
   Automation's new count-based checks (would couple two task's logic) — instead, build a new,
   sibling QA module in the new package that imports and reuses `seo_limits`/`jsonld`/
   `html_fixes` the same way `qa_check.py` does, rather than extending `qa_check.py` itself.
4. Site/store selection must be driven by a small, explicit per-site config (mirroring
   `blog_optimization/shopify.py`'s `SITE_STORES` pattern) covering only
   `ledsone.co.uk`/`ledsone.de`/`ledsone.fr` initially — confirm with Dilaksi whether
   `dcvoltage.co.uk` (has Shopify access, no confirmed GSC access) is in scope before adding it.
5. Follow Blog Optimization's "review-then-apply, no auto-publish" precedent exactly — Code/
   Preview toggle, Copy button, manual Shopify paste. Do not attempt a Shopify blog-content write
   path in Step 2 without a separate, explicit decision (new scope, new Shopify app permissions).
6. Define Dilaksi's business-rule numbers as named constants in one place in the new package
   (not scattered), following `seo_limits.py`'s precedent.
7. Confirm expected SerpAPI (Content Gap) and Scrape.do (PAA) call volume with Dilaksi before
   Step 2 build, given both are shared, credit-metered resources already used elsewhere.
