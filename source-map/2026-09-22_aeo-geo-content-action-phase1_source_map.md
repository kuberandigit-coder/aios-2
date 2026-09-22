# Source Map — AEO/GEO Content Draft Generation, Dilaksi Phase 1

Date: 2026-09-22

1. **Existing AI Overview Tracker**
   Purpose: Identify AEO/GEO citation gaps.
   Location: `backend/app/dev_tasks/geo_visibility/` (`schema.py`, `router.py`, `analysis.py`, `runner.py`).
   Used by this feature as: the sole source of truth for `query`, `priority`, `aiOverview`, `ledsoneCited`,
   `competitorCited`/`competitorDomains`, `content_gap` — read-only, never modified.

2. **Shopify Admin API — UK**
   Purpose: Read target collection content and context (title, description, URL).
   Location: `backend/app/shopify_client.py` (shared client), `geo_visibility/shopify.py`
   (`fetch_all_collections`).
   Write: **NOT USED IN THIS PHASE.** No mutation exists in `content_actions.py` or any new endpoint.

3. **Existing Structural Diagnosis**
   Purpose: Provide competitor-vs-LEDSone content-gap evidence to ground the generation prompt.
   Location: `geo_visibility/analysis.py`'s `compare_content_for_gap()`, stored as `geo_visibility_results.content_gap`.
   Used by this feature as: `structural_diagnosis` input, copied onto the Content Action at creation time.

4. **Local LLM API**
   Purpose: Generate the content draft (FAQ or paragraph).
   Location: self-hosted endpoint configured via `LOCAL_LLM_BASE_URL`/`LOCAL_LLM_API_KEY`/`LOCAL_LLM_MODEL`
   environment variables (safe reference only — no value exposed here). Same client pattern already used by
   `collection_thin_content/faq_generation.py`, `meta_audit/generate.py`, `alt_text_keywords/ai_alt_text.py`.
   Fallback: Gemini via `backend/app/ai_shared.py`'s `call_gemini()` if the local LLM is unreachable.

5. **DM Dashboard PostgreSQL**
   Purpose: Store the Content Action workflow/history.
   Location: new table `public.geo_visibility_content_actions` (`geo_visibility/schema.py`), connected via
   the shared `backend/app/db.py` pool — no new database or connection method introduced.
