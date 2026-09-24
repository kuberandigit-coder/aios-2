# Source Map — Task 13 (Hetheesha) French Keyword Research & Page Mapping — Phase 1 + Phase 2 + Phase 3 + Phase 4

**Date:** 2026-09-24. Confirmed live against real code/data this session —
see [[2026-09-24_task13-phase1-audit_evidence]],
[[2026-09-24_task13-phase2-datasource-layer_evidence]],
[[2026-09-24_task13-phase3-keyword-dataset_evidence]], and
[[2026-09-24_task13-phase4-intent-classification_evidence]] for full
citations. Overlaps partially with [[2026-08-20_thivajini-feed-optimization-source-map]]
(same `google_search_console.query_page` / `ledsone_fr` Shopify store) —
that record documents Thivajini's own Feed Optimization task; this one
documents the same underlying sources specifically for Task 13's needs. Not
a duplicate: different consuming task, some new findings (Keyword Planner
status, taskRegistry path) not covered there.

**Phase 2 update:** every source below marked "Existing" or "Partial" in
Phase 1 was re-verified live via the new `backend/app/hetheesha_task13.py`
data-source layer (see Phase 2 evidence). Statuses below are updated to
reflect Phase 2 implementation, not just Phase 1 audit findings.

**Phase 3 update:** the PostgreSQL (app DB) entry below is updated to
reflect the seed keyword dataset now built on top of these sources (144
real seeds, provenance-merged, GSC/Shopify-enriched). Google Keyword
Planner, GSC, and Shopify entries are otherwise unchanged from Phase 2 —
Phase 3 consumed them exactly as built, no new integration work needed.

**Phase 4 update:** the Local LLM entry below is updated from "reusable
pattern identified" to "successfully used end-to-end for this task" —
144/144 real seed keywords classified live. The PostgreSQL entry is
updated with Phase 4's 8 new classification columns (same table,
extended, not a new one).

---

**SOURCE:** Google Keyword Planner
**PURPOSE:** Keyword demand/advertising metrics (search volume, competition, CPC)
**DATA:** keyword, avg_monthly_searches, competition, competition_index, low/high top-of-page bid
**AUTHORITY:** Primary
**STATUS:** Partial — Phase 2 built an honest wrapper
(`fetch_keyword_ideas_fr()` / `keyword_planner_status()` in
`backend/app/hetheesha_task13.py`) around the existing client
(`backend/app/sajeepan_lens_keyword_planner.py`) with France/French
targeting constants added (`geoTargetConstants/2250`,
`languageConstants/1002` — publicly documented IDs, NOT yet live-verified
since there is no credential to call with). Live-reconfirmed 2026-09-24:
`GOOGLE_ADS_*` still not configured in `backend/.env` (5 vars missing) —
`fetch_keyword_ideas_fr()` correctly returns `BLOCKED_CONFIG_REQUIRED` and
writes zero fake keyword rows. **Blocker is external (Google Ads OAuth
credential provisioning), not a code gap** — the call path is otherwise
complete and will work once a credential exists.
**LIMITATION:** the France/French target-constant IDs must be spot-checked
against Google's live API (or published reference tables) on first real
use — see code comment in `hetheesha_task13.py`.

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
**Phase 2:** `fetch_gsc_queries_fr()` in `hetheesha_task13.py` queries this
table directly (no new client, no duplicate storage — the business-DB row
already is the persisted snapshot). Live-tested 2026-09-24 for a real
7-day range: 5 real French queries returned (e.g. "ampoule baionnette",
"abat jour metal") with real clicks/impressions/ctr/position, normalized
to the Phase 2 spec's exact field shape, `source: "google_search_console"`.

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
**Phase 2:** `fetch_shopify_inventory_fr()` in `hetheesha_task13.py`
live-tested 2026-09-24: **1,114 products, 64 collections** retrieved
(read-only, id/handle/title/url/status), written to a new snapshot table.
**Blogs/articles CONFIRMED BLOCKED** — `ACCESS_DENIED` on the `blogs`
field; the `SHOPIFY_FR_ADMIN_TOKEN` lacks the `read_content` scope that
the UK equivalent token already has (per `content_fetch.py`). Reported
honestly as `BLOCKED_SCOPE_REQUIRED`, zero blog rows written — not faked,
not silently skipped. Fix requires granting `read_content` on the FR
token (an account/app-permissions change, not a code gap).

---

**SOURCE:** PostgreSQL (app DB)
**PURPOSE:** Persistence/history for Task 13's own run/keyword/cluster/mapping data
**DATA:** research runs, keywords, clusters, URL mappings, gap/cannibalisation analysis, approvals
**AUTHORITY:** Derived/internal
**STATUS:** Partial — Phase 2 created the minimal necessary tables in the
app's own DB (`get_conn()`, never the read-only business DB), following
the `ensure_schema()` idempotent-CREATE-TABLE-IF-NOT-EXISTS convention
(`product_ownership.py`, `sajeepan_lens_db.py`,
`thasitha_manual_campaigns.py`):
`public.hetheesha_kw13_research_runs` (run history, never overwritten;
Phase 3 added the `seed_dataset_build` run type),
`public.hetheesha_kw13_seed_keywords` (Phase 3 extended with
`normalized_term`/`status`/`source_refs`/`gsc_metrics`/`candidate_urls`/
`run_id` — live-populated: **144 real French seed keywords**, 85 with
real GSC metrics, 95 with real candidate Shopify URLs, all with merged
multi-source provenance), `public.hetheesha_kw13_keyword_metrics`
(source-tagged Keyword Planner fields, stays empty until credentials
exist), `public.hetheesha_kw13_shopify_page_inventory` (1,178 rows).
Clustering/URL-mapping/gap/cannibalisation tables deliberately still NOT
created — out of Phase 3/4 scope per spec (belongs to Phases 5-7).
**Phase 4** added 8 columns to the same `hetheesha_kw13_seed_keywords`
table (`intent`, `core_topic`, `modifier_groups`, `modifier_values`,
`classification_status`, `classified_at`, `classification_source`,
`classification_error`) — no new table. All 144 rows classified live.

---

**SOURCE:** Existing Local LLM (Qwen3-Next, + Gemini fallback)
**PURPOSE:** Intent classification, modifier extraction, clustering/relevance analysis
**DATA:** Classification/analysis output (JSON, per each feature's own contract)
**AUTHORITY:** Derived
**STATUS:** Existing — `LOCAL_LLM_API_KEY`/`BASE_URL`/`MODEL` configured
and already proven live generating/classifying French-language content for
ledsone.fr in `backend/app/thivajini_feed_providers.py` (Feed
Optimization). Directly reusable pattern for Task 13 Step 03.
**Phase 4:** successfully reused (not just identified) — 144/144 real
French seed keywords classified live via the LOCAL_LLM primary path
(`backend/app/hetheesha_task13.py`'s `_call_local_llm_classify`, same
call shape as `thivajini_feed_providers.py`), zero fallback to Gemini
needed this run. LLM output is explicitly Derived authority only —
never presented as authoritative search data, always validated
deterministically before being saved (see Phase 4 evidence).

---

**SOURCE:** Human approval
**PURPOSE:** Final keyword-to-URL decisions
**DATA:** Approved mapping/status/notes
**AUTHORITY:** Human
**STATUS:** Future (Phase 9 per the proposed plan — not built this phase).
