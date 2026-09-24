# Source Map — Task 13 (Hetheesha) French Keyword Research & Page Mapping — Phase 1

**Date:** 2026-09-24. Confirmed live against real code/data this session —
see [[2026-09-24_task13-phase1-audit_evidence]] for full citations. Overlaps
partially with [[2026-08-20_thivajini-feed-optimization-source-map]] (same
`google_search_console.query_page` / `ledsone_fr` Shopify store) — that
record documents Thivajini's own Feed Optimization task; this one documents
the same underlying sources specifically for Task 13's needs. Not a
duplicate: different consuming task, some new findings (Keyword Planner
status, taskRegistry path) not covered there.

---

**SOURCE:** Google Keyword Planner
**PURPOSE:** Keyword demand/advertising metrics (search volume, competition, CPC)
**DATA:** keyword, avg_monthly_searches, competition, competition_index, low/high top-of-page bid
**AUTHORITY:** Primary
**STATUS:** Partial — real API client code exists
(`backend/app/sajeepan_lens_keyword_planner.py`) but required
`GOOGLE_ADS_*` OAuth credentials are NOT configured in `backend/.env`
(confirmed empty). Returns `BLOCKED_CONFIG_REQUIRED` today. Also hardcodes
Canada/English targeting — France/French geo+language target constant IDs
would need to be added for Task 13's use.

---

**SOURCE:** Google Search Console — ledsone.fr
**PURPOSE:** Actual search visibility
**DATA:** query, clicks, impressions, ctr, position, page, date
**AUTHORITY:** Primary
**STATUS:** Existing — live-confirmed 316,028 rows for
`site_url = 'https://ledsone.fr/'` in `google_search_console.query_page`
(business Postgres), date range 2025-03-24 to 2026-09-21. Already consumed
live by `backend/app/thivajini_feed_sql.py`. Generic live-query client also
exists (`backend/app/google_client.py:query_gsc`), auth via
`GSC_SERVICE_ACCOUNT_KEY`.

---

**SOURCE:** Shopify Admin API — ledsone.fr
**PURPOSE:** Current page inventory (products, collections, pages/blogs)
**DATA:** id, title, handle, url, status, description (per GraphQL query shape)
**AUTHORITY:** Primary
**STATUS:** Existing — live-confirmed via `graphql("ledsone_fr", ...)`
(`backend/app/shopify_client.py`, store domain `jedsz8-km.myshopify.com`,
token `SHOPIFY_FR_ADMIN_TOKEN`). Already used live by `hetheesha.py` and
`thivajini.py`. A pre-synced catalog mirror also exists in
`listings.shopify_listings WHERE site = 'France'`.

---

**SOURCE:** PostgreSQL (app DB)
**PURPOSE:** Persistence/history for Task 13's own run/keyword/cluster/mapping data
**DATA:** research runs, keywords, clusters, URL mappings, gap/cannibalisation analysis, approvals
**AUTHORITY:** Derived/internal
**STATUS:** Missing — no Task 13-specific table exists yet. Closest
convention precedent: `backend/app/sajeepan_lens_db.py`'s multi-table
run/candidate/final pipeline shape, and `product_ownership.py`'s
`ensure_schema()` idiom. Proposed schema documented in the Phase 1 report
(not created this phase).

---

**SOURCE:** Existing Local LLM (Qwen3-Next, + Gemini fallback)
**PURPOSE:** Intent classification, modifier extraction, clustering/relevance analysis
**DATA:** Classification/analysis output (JSON, per each feature's own contract)
**AUTHORITY:** Derived
**STATUS:** Existing — `LOCAL_LLM_API_KEY`/`BASE_URL`/`MODEL` configured
and already proven live generating/classifying French-language content for
ledsone.fr in `backend/app/thivajini_feed_providers.py` (Feed
Optimization). Directly reusable pattern for Task 13 Step 03.

---

**SOURCE:** Human approval
**PURPOSE:** Final keyword-to-URL decisions
**DATA:** Approved mapping/status/notes
**AUTHORITY:** Human
**STATUS:** Future (Phase 9 per the proposed plan — not built this phase).
