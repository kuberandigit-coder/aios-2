# Task 13 (Hetheesha) — Phase 1 Audit Evidence

**Date:** 2026-09-24
**Scope:** Read-only architecture discovery for French Keyword Research &
Page Mapping. No dm-dashboard code or database was changed. See
[[2026-09-24_task13-french-keyword-research-page-mapping_original-prompt]]
for the full original requirement.

All findings below are either **confirmed** (verified live against real
code/data in this session) or **inferred** (reasoned from code structure
without a live check) — labeled per item. No secret values were printed;
only env var names and safe references (e.g. "credentials configured").

## 1. Google Keyword Planner — CONFIRMED: implemented but NOT configured

File: `backend/app/sajeepan_lens_keyword_planner.py` (159 lines), built for
a different task (Sajeepan Lens Stage 7) but a real, generic
`KeywordPlanIdeaService.generateKeywordIdeas` REST v25 client.

- Required env vars (checked by name only): `GOOGLE_ADS_CLIENT_ID`,
  `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
  `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` (+ conditional
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID`).
- Live-checked `backend/.env`: **none of these exist**. Confirmed via
  `grep -E "^GOOGLE_ADS_" backend/.env` → zero matches.
- The module's own docstring (lines 4–9) independently documents the same
  conclusion: "no Google Ads API credential exists in this app's .env. A
  service account structurally cannot authenticate to this API — it
  requires a USER OAuth refresh token."
- `is_configured()` / `missing_vars()` (lines 47–52) return this state
  programmatically; `get_suggestions()` returns `BLOCKED_CONFIG_REQUIRED`
  rather than fabricating data when unconfigured (lines 122–135).
- **This module hardcodes Canada/English targeting** (`geoTargetConstants/2124`,
  `languageConstants/1000`, lines 76–78, 86–87) — France/French targeting
  would need real geo/language target constant IDs looked up from Google's
  reference tables (not guessed) before reuse.
- Module docstring (line 24) explicitly warns: `google_ads.keywords /
  keyword_performance` (existing Ads campaign data) must NEVER be used as
  a substitute for Keyword Planner data — this rule is directly relevant to
  Task 13 Step 02's explicit instruction not to mislabel data.

**Conclusion: Real, reusable code exists for the OAuth+API call shape, but
Keyword Planner access is currently BLOCKED_CONFIG_REQUIRED — no live
search volume/competition/CPC data can be retrieved today for ANY keyword,
French or otherwise, until a Google Ads OAuth credential is provisioned.**

## 2. Google Search Console (ledsone.fr) — CONFIRMED: real, live data exists

- Generic client: `backend/app/google_client.py:94` —
  `query_gsc(site_url, start_date, end_date, dimensions)`. `site_url` is a
  parameter, not hardcoded — usable for any verified GSC property.
- Auth: service-account JWT-bearer flow, `GSC_SERVICE_ACCOUNT_KEY` env var
  (confirmed set in `backend/.env`, value not printed),
  `webmasters.readonly` scope (`google_client.py:29`).
- A **separate, already-synced Postgres mirror** exists:
  `google_search_console.query_page` (business DB, via `get_business_conn()`),
  columns confirmed live via `information_schema.columns`:
  `id, search_type, site_url, sub_source, date, query, page, row_hash,
  clicks, impressions, ctr, position`.
- Live-queried this table directly (read-only `SELECT`):
  `site_url = 'https://ledsone.fr/'` → **316,028 rows**, date range
  **2025-03-24 to 2026-09-21** (i.e. current, syncing).
- Already used live for ledsone.fr by an existing feature:
  `backend/app/thivajini_feed_sql.py:33` (`GSC_SITE_URL =
  "https://ledsone.fr/"`) and `get_organic_terms()` at lines 534–567 —
  queries `query, impressions, clicks` scoped to a product handle via
  `page LIKE '%/products/' || handle || '%'`.
- `backend/app/gsc_live_sync.py:17` — a SEPARATE scheduled sync exists but
  is hardcoded to `sc-domain:ledsone.co.uk` (UK only). It is NOT what
  populates the ledsone.fr rows above — some other/earlier sync process
  populated the France rows in `google_search_console.query_page`
  (confirmed data exists; the specific sync job that wrote it was not
  located in this backend's own scheduled-job code — see Gap Report).

**Conclusion: Real, current GSC data for ledsone.fr exists and is directly
queryable today (query/clicks/impressions/CTR/position/page/date) — this
is Task 13's single strongest existing data source.**

## 3. Shopify Admin API (ledsone.fr) — CONFIRMED: live and working

- `backend/app/shopify_client.py:35` — `"ledsone_fr":
  ShopifyStore(domain="jedsz8-km.myshopify.com",
  token_env="SHOPIFY_FR_ADMIN_TOKEN")`. Safe reference only: French
  Shopify credentials are configured (`SHOPIFY_FR_ADMIN_TOKEN` set in
  `backend/.env`; value not printed).
- **Live-tested** (read-only): `graphql("ledsone_fr", "{ shop { name
  primaryDomain { url } } }")` →
  `{'shop': {'name': 'LED Sone FR', 'primaryDomain': {'url':
  'https://ledsone.fr'}}}`. Confirms the token is valid and the client
  works today.
- Already used live by two existing features: `backend/app/hetheesha.py`
  (Hetheesha's own Requirement 1, `graphql("ledsone_fr", ...)` at lines
  185, 396, 511, 648, 724) and `backend/app/thivajini.py:101`.
- Separate, already-synced catalog mirror in Postgres:
  `listings.shopify_listings`, confirmed live query shows `site = 'France'`
  / `channel = 'LED Sone FR'` rows exist alongside UK/DE/US/Canada. This
  gives product/collection inventory (title, handle, URL, status, etc.,
  per the earlier Mahima Req4 rebuild this session, which validated this
  table's real-catalog fidelity for a different market).

**Conclusion: Both the live GraphQL client and a pre-synced Postgres
catalog mirror are confirmed working for ledsone.fr today.**

## 4. PostgreSQL patterns — CONFIRMED: no existing Task 13 table; a clear convention to follow

- No table anywhere in the codebase is named for keyword clustering or
  keyword-to-URL mapping (`grep`-checked for `keyword_cluster`,
  `keyword_map`, similar — no matches beyond Sajeepan Lens's own
  differently-scoped tables below).
- Closest existing precedent: `backend/app/sajeepan_lens_db.py` — 13
  `CREATE TABLE IF NOT EXISTS public.google_lens_keyword_*` tables (run,
  run_product, competitor_result, provider_attempt, quota_snapshot,
  candidate, planner_suggestion, final_title, etc.) — a multi-stage
  keyword-pipeline convention (run → candidates → final approved values)
  that Task 13's Phase 2+ schema should mirror, NOT reuse directly (it is
  scoped to a different tool, Google Lens reverse-image keyword discovery,
  not classic Keyword Planner + GSC clustering).
- `backend/app/product_ownership.py:63-114` demonstrates this repo's
  `ensure_schema()` / `CREATE TABLE IF NOT EXISTS` / idempotent-migration
  convention, callable per-request (also used this session for
  `thasitha_manual_campaigns.py`).
- App-DB (`get_conn()`) vs business-DB (`get_business_conn()`) split is
  a hard convention: the business DB is READ-ONLY from this app (confirmed
  independently this session via a live `InsufficientPrivilege` error on
  an unrelated table) — any new Task 13 table MUST live in the app's own
  DB, never in `google_search_console`/`google_ads`/`listings` schemas.

**Conclusion: No duplicate exists. A new app-DB schema is needed for
Phase 2 (proposed below), following the existing `ensure_schema()`
convention.**

## 5. Local LLM / AI utilities — CONFIRMED: reusable, and already proven on French text

- Shared multi-provider helper: `backend/app/ai_shared.py` (`call_gemini`,
  Groq/Nvidia fallback helpers, chat-table helpers).
- Primary local-LLM pattern (Qwen3-Next) used more directly in feature
  modules via `LOCAL_LLM_API_KEY` / `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL`
  env vars — confirmed present in `dilaksi_faq_draft.py`,
  `dilaksi_faq_run.py`, `sajeepan_lens_copy.py`,
  `thivajini_feed_providers.py`, `thivajini_feed_service.py`.
- **Directly relevant precedent**: `backend/app/thivajini_feed_providers.py`
  (header comment, lines 1–15) — "PRIMARY LOCAL_LLM (Qwen3-Next, direct
  call — proven live 2026-09-03)... deterministically WRITING French [content]
  ... French-language, promotional-term, unsupported-technical-[detection]"
  — this is a **live-proven** French-language generation/classification
  pipeline for ledsone.fr (Thivajini's Feed Optimization task), with a
  Gemini fallback (`PROVIDER = {"LOCAL_LLM": ..., "GEMINI": ...}`,
  line 41).
- This means Task 13's Step 03 (Transactional/Commercial/Informational
  classification + modifier extraction, in French) has a directly
  analogous, already-working precedent to follow — not a new capability
  that needs to be proven from scratch.

## 6. UAM / taskRegistry — CONFIRMED: standard registration path exists

- `frontend/src/taskRegistry.js:9-19` — `STAFF_LIST` already includes
  `{ key: 'hetheesha', label: 'Hetheesha' }`.
- Existing Hetheesha task entries (lines 94–98), e.g.:
  `{ ownerStaffKey: 'hetheesha', taskKey:
  'hetheesha.ProductSeoReport', label: 'Top-Selling Products SEO
  Report', load: () => import('./hetheesha/pages/ProductSeoReport') }`
  — this is the exact shape Task 13 would follow:
  `{ ownerStaffKey: 'hetheesha', taskKey:
  'hetheesha.FrenchKeywordResearch', label: 'French Keyword Research &
  Page Mapping', load: () => import('./hetheesha/pages/...') }`.
- `frontend/src/hetheesha/HetheeshaLayout.jsx:6-7,129,177` — existing
  `useGrantedTasks('hetheesha')` / `GrantedTaskView` wiring for
  covering-staff access; a new page is added the same way any other
  Hetheesha Requirement/task page is (an `ITEMS` entry + `LazyPanel`),
  mirroring the pattern used this session for Thasitha's new "Manage
  Campaigns" tab.
- No separate/new permission system is needed — the existing
  ownerStaffKey/taskKey/access-grants model (`backend/app/access_grants.py`,
  referenced in `taskRegistry.js`'s own header comment) already covers
  per-staff task ownership and grant-based coverage.

## 7. Reusable frontend components — CONFIRMED

- The `jreq-*` CSS class system in `frontend/src/styles/dashboard.css`
  (header, cards, tbar/filters, select, scroll/table, pill variants,
  modal, empty state) is already used across many staff pages (Thasitha's
  Req1–7, this session's own new "Manage Campaigns" page, and others) and
  directly covers Task 13's planned UI needs: KPI cards (`jreq-cards`/
  `jreq-card`), tabs (pattern used via `LazyPanel`+`ITEMS`, not a
  dedicated tab component), filters (`jreq-tbar`, `jreq-select`), tables
  (`jreq-scroll` + `<table>`), priority badges (`jreq-pill-solid-*` —
  directly reusable for Task 13's HIGH/MEDIUM/LOW/NO ACTION priority
  labels), modals (`jreq-modal-*`), empty states (`jreq-empty`).
- No new component library or design system is required for Phase 1's
  proposed UI structure (Section 15 of the final report).

## 8. Files inspected this phase (non-exhaustive list of the load-bearing ones)

`backend/app/sajeepan_lens_keyword_planner.py`,
`backend/app/sajeepan_lens_keywords.py`, `backend/app/sajeepan_lens_db.py`,
`backend/app/google_client.py`, `backend/app/gsc_live_sync.py`,
`backend/app/thivajini_feed_sql.py`, `backend/app/thivajini_feed_providers.py`,
`backend/app/thivajini_feed_config.py`, `backend/app/hetheesha.py`,
`backend/app/hetheesha_ai.py`, `backend/app/shopify_client.py`,
`backend/app/ai_shared.py`, `backend/app/product_ownership.py`,
`backend/app/main.py`, `backend/.env` (names only),
`frontend/src/taskRegistry.js`, `frontend/src/hetheesha/HetheeshaLayout.jsx`,
`frontend/src/styles/dashboard.css`, plus live read-only Postgres/Shopify
checks (see items 2 and 3 above).

## 9. Security confirmation

No API key, token, password, or secret value was printed or written to any
AIOS file at any point in this audit — only environment variable NAMES and
safe references ("French Shopify credentials are configured",
"GSC_SERVICE_ACCOUNT_KEY set"). No `.env` file was copied or committed. No
dm-dashboard production code, configuration, or data was modified — every
check against the business database and Shopify was a read-only `SELECT`
or GraphQL query.
