# dm-dashboard — Development Tasks Overview

Context for planning a new task ("Blog HTML Automation"). This is a factual snapshot of every
existing Development Task in the dm-dashboard app (FastAPI backend + React/Vite frontend),
as of 2026-10-07, so a new task can reuse existing infrastructure instead of duplicating it.

All Development Tasks live under **Admin panel → Development Tasks** (and a parallel **Dev
Tools** area for some), gated by User Access Management only — not scattered across staff
pages. Each is its own backend sub-package in `backend/app/dev_tasks/<name>/` exposing an
APIRouter, aggregated into one router in `dev_tasks/__init__.py`. Each has its own frontend
page under `frontend/src/admin/pages/dev-tasks/`.

---

## Shared infrastructure every task can reuse (build on these, don't duplicate)

- **`dev_tasks/local_llm.py`** — one shared self-hosted LLM caller (`call_local_llm`), with a
  3-stage fallback chain (`call_with_gemini_fallback` → Gemini → Groq → NVIDIA NIM). Was
  independently copy-pasted into 8 tasks before being consolidated 2026-10-06; new tasks should
  import from here, not write their own.
- **`dev_tasks/jsonld.py`** — shared JSON-LD extraction from HTML.
- **`dev_tasks/seo_limits.py`** — shared meta title/description length checking + AI-shorten.
- **`dev_tasks/faq_schema.py`** — shared FAQ generation pipeline (real Google "People Also Ask"
  questions + AI-written answers → FAQPage JSON-LD).
- **`dev_tasks/html_fixes.py`** — deterministic (no AI) HTML fixes: dedupe repeated links, fix
  skipped heading levels.
- **`core/scheduled_snapshot.py`** (`ScheduledSnapshot` class) — the standard "compute on a
  schedule, serve instantly, manual Run Now button, auto-registers in Sync Monitor" helper.
  Stores ONE JSONB payload per scope; real structured data goes in the task's own tables, the
  snapshot's `compute_fn` just does the real work and returns a small summary.
- **`core/shopify_client.py`** — `graphql(store, query, variables)`, pre-authenticated for all
  Shopify stores (`ledsone_uk`, `ledsone_de`, `ledsone_fr`, `dcvoltage`, etc. — see `STORES`
  dict for the full list and which token env var each uses).
- **`core/google_client.py`** — shared GA4 + GSC OAuth/JWT token handling.
- **`core/background_job.py`** + frontend `usePollingResource` — the standard non-blocking
  pattern for any slow (AI) call: start, return immediately, frontend polls a status endpoint.
- **Sync Monitor** (Admin → Sync Monitor) — every `ScheduledSnapshot` needs TWO registrations
  to actually show in the sidebar: (1) `.start()` in `dev_tasks/__init__.py`'s
  `start_dev_task_snapshots()`, AND (2) a manual entry in BOTH
  `SalesSyncMonitor.jsx`'s `SCHEDULED_SNAPSHOT_TABS`/`LABELS` maps AND a second, separate
  hardcoded menu array in `frontend/src/dev/DevLayout.jsx` — easy to miss the second one (this
  bit a real deploy on 2026-10-06).

---

## Blog Optimization — Clicks-Down URLs

*(Most relevant to Blog HTML Automation — same page type, same Shopify blog content.)*

**Purpose:** detect blog pages with declining GSC clicks, diagnose why, provide a
review-then-apply fix workflow, track completion.

**Data sources (as of 2026-10-06 migration):**
- GSC data: **this app's own Postgres** (`blog_optimization_gsc_page`/`_query` tables),
  synced weekly by a live `searchAnalytics.query` API call — NOT the external business
  database anymore. Only 3 sites have confirmed live GSC API access: `ledsone.co.uk`,
  `ledsone.de` (shared service account), `ledsone.fr` (dedicated service account). 5 other
  sites (`ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`, `electricalsone.co.uk`,
  `besbet.co.uk`) are NOT reachable with this app's credentials (HTTP 403).
- Blog content: live Shopify Admin GraphQL (`articles` query), store-aware per site. UK and FR
  work; **DE is currently blocked** — its Shopify app token lacks the `read_content` scope.

**Workflow:** list declining blog URLs (28d vs previous-28d) → priority (High/Medium/Low/No
action) → open one → Performance / Affected Queries / Likely Cause (deterministic + optional
AI recommendation, reuses `content_gap_core`'s cached competitor data) → **QA Check** against
the real live/working HTML (15 checks: meta lengths, heading structure, FAQ schema presence,
duplicate links, etc. — anything not mechanically verifiable is marked "not checkable," never
faked as pass) → each failing check gets its own small **Fix** button (duplicate-link removal
and heading-structure fix are deterministic/instant; meta shortening and FAQ schema are AI
calls) → review the fix's result → **Apply** (writes into a cumulative working draft,
`blog_optimization_content_draft` — fixes compound, each Apply builds on the last) → **Current
Blog HTML** shows the live compounding draft (Code/Preview toggle) → user manually copies and
pastes into Shopify themselves (**no Shopify write access for content** — read-only except the
one explicit alt-text-empty-field write in `alt_text_keywords`). A QA item with no automated
fix gets a "Changed" button instead, for confirming it was handled manually in Shopify.
Everything applied/manually-changed persists in `blog_optimization_fix_log` (survives reload),
with a "Locate Changes" button that jumps to and highlights exactly what changed in the HTML.
Mark Done moves it to a Completed tab with full history ("View Changes" button).

**Key backend files:** `gsc.py` (reads), `gsc_sync.py` (live API fetch + upsert), `qa_check.py`,
`cause.py`, `schema.py` (tables), `router.py`, `shopify.py` (content fetch).

**Status:** live, actively developed. DE content blocked on a Shopify permissions grant.

---

## Content Gap Analysis

**Purpose:** compares a LEDSone page against a real competitor page found via SerpAPI, surfaces
structural content gaps (FAQ present/missing, guide format, table, word count, etc.).

**Key module:** `content_gap/core.py` (`run_analyze`) + `page_analysis.py`
(`analyze_page`/`compare_pages`, BeautifulSoup-based structural comparison — no AI). Results
cache in `content_gap_result`, shared with Blog Optimization's Likely Cause (same table, one
cache, not duplicated).

---

## Meta Title & Description Audit

**Purpose:** AI-drafted meta title/description generation per product, keyword-driven, audit +
prioritized backlog. **Never writes to Shopify** — generation only, human copies it over.

**Workflow:** pick a product → input a Semrush keyword (or multiple) manually → Generate (uses
`local_llm`, both title AND description always generated together) → stored in a Generated
Titles/Descriptions log tab, editable keyword, Regenerate with `temperature=0.9` (fixed a real
"identical output on regenerate" bug here first, 2026-09-22, before the shared `local_llm.py`
consolidation). Snapshot-based, not live-raw-fetched.

---

## AI/GEO Visibility Gap Analysis (`geo_visibility`)

**Purpose:** which LEDSone UK search queries trigger a Google AI Overview, whether a known
competitor is cited in it vs LEDSone itself. HIGH/MEDIUM/NO ACTION/MONITOR/UNKNOWN ranking.

**Data source:** SearchAPI.io (`aio_searchapi.py`) — reads AI Overview text + citations
directly from a real Google search response. Two real bugs fixed before this was trusted:
citation URLs need `link=resolved` (else Google tracking redirects, not real domains); the
API's `ai_overview` field is non-empty even with no real AI Overview, so presence is detected
by real content blocks, not bare truthiness. A free headless-browser approach (Playwright
directly against google.com) was tried and rejected — 100% blocked by bot detection in live
testing (14/14 blocked). Directly asking Gemini to answer and scanning for brand mentions was
also tried and rejected as not actually measuring the real thing.

---

## Search Intent → Page Action

**Purpose:** real GSC query+page data → deterministic search-intent classification
(Informational/Commercial/Transactional/Navigational) → page-type from URL → match/mismatch →
priority → recommended action → owner/status/due-date tracking → before/after weekly
comparison. Read-only against GSC; only writes its own task-tracking table.

**Note:** still reads from the **external business database** (not yet migrated the way Blog
Optimization was on 2026-10-06) — uses the full old 8-site list.

---

## Collection Page Thin-Content Detector

**Purpose:** audit + priority + backlog for thin collection-page content. **LEVEL 1 ONLY** —
content generation, live preview, and auto-publish (Level 2/3) are explicitly NOT implemented.

---

## Internal Linking Suggestion Engine

**Purpose:** 5-step workflow — Content Index → Find Link Opportunities → Check Existing Link
Density → Generate & Prioritize Suggestions → Handoff/Implementation Tracking/Verification.
Marked COMPLETE (2026-09-19).

---

## Structured Data Validation (ledsone.fr)

**Purpose:** sitemap discovery → JSON-LD/microdata/RDFa extraction → Product/Organization/
Breadcrumb + duplicate/conflict checks against live Shopify → bounded GSC URL Inspection sample
→ fix/re-validation workflow. Never writes to Shopify.

---

## Search Console, Sitemap & Indexing Monitor (ledsone.fr)

**Purpose:** Phase 1 only — sitemap discovery + GSC Sitemaps API, shares Structured Data
Validation's URL Inspection quota/cache, per-URL indexing verdict, priority using stored GSC
impressions, current-vs-previous trend. Read-only: no Request Indexing, no GSC write, no fix
workflow (later phases not built).

---

## French Keyword Research & Page Mapping (ledsone.fr)

**Purpose:** Shopify FR catalogue + GSC + Google Ads Keyword Planner → normalized keyword
dataset → intent/modifier classification → clustering → primary keyword → URL mapping →
gap/cannibalisation analysis. Never writes to Shopify.

---

## Top 10 Blog Title Finder (Kamsi Task 08d)

**Purpose:** one LEDSone URL → real Shopify content → primary keyword → ONE Google UK search
(isolated SerpAPI integration, separate key from the shared/Sajeepan one) → Organic/Ads/
Shopping classification → Top 10 organic blog/article results → title-pattern analysis → one
generated LEDSone title → programmatic QA → human review. Never writes to Shopify.

---

## Alt Text Keyword Finder

**Purpose:** keyword-finding for the Alt Text Optimization workflow — real LEDSone UK Google
Ads campaign keyword + performance data (never Keyword Planner/Semrush/manual CSV), scored
against real Shopify product data. **Read-only except one explicit write endpoint** — writes an
image's alt text only when currently empty, re-checked live immediately before writing (the
only Shopify content write anywhere in Development Tasks).

---

## GSC 404 URL Monitor

**Purpose:** manual upload of GSC's own "Page Indexing → Not found (404)" export (no bulk API
exists for that report) → Shopify replacement-URL matching → priority → review/development
workflow. Results persist per-URL as an upload is processed. **Manual upload only** — no
automatic scan, no Sync Monitor registration, by explicit instruction.

---

## Competitor Analysis (LEDSone E27 collection)

**Purpose:** LEDSone E27 collection vs UK competitor sites — product matching, price
comparison, keyword gap.

---

## Things worth knowing before designing "Blog HTML Automation"

1. **No Development Task has general Shopify write access to blog content.** Every existing
   blog-related tool (Blog Optimization, Top 10 Blog Title Finder) stops at "copy this and
   paste it into Shopify yourself." If the new task needs to actually publish, that's new scope
   not yet built anywhere in this app.
2. **GSC access is NOT uniform across sites.** Only `ledsone.co.uk`, `ledsone.de`, `ledsone.fr`
   have confirmed live API access (as of 2026-10-06); 5 other sites don't, regardless of what
   the external business DB shows.
3. **Shopify content access is also not uniform.** `ledsone_de`'s Shopify app token is missing
   the `read_content` scope right now — any blog-content feature for DE will hit the same wall
   Blog Optimization did until that's granted.
4. **AI generation always goes through `local_llm.py`'s fallback chain**, never a bare single
   provider call — reuse it rather than writing a new one.
5. **Every scheduled background job uses `ScheduledSnapshot`**, and needs the two-registration
   step (backend `.start()` + two separate frontend sidebar arrays) to actually be visible.
