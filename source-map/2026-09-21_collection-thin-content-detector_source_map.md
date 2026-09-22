# Source Map — Collection Page Thin-Content Detector, Level 1

Date: 2026-09-21

## Shopify Admin API usage

- Client: `backend/app/shopify_client.py` `graphql(store, query, variables)`, store `"ledsone_uk"` — the
  same client used by every other dev task, no new client created.
- Query: `collections(first: 100, after: $after)` — fields `legacyResourceId`, `handle`, `title`,
  `descriptionHtml`, `updatedAt`. Read-only `Query` operation only, never a mutation.
- File: `backend/app/dev_tasks/collection_thin_content/content_fetch.py`.

## Google Search Console usage

- Client: `backend/app/google_client.py` `query_gsc(site_url, start, end, dimensions)` — same client used
  by `dilaksi.py` and `gsc_404_monitor/enrich.py`, no new auth system created.
- Site: `sc-domain:ledsone.co.uk`, dimension `["page"]`, 30-day rolling window (matches existing convention
  in this codebase).
- File: `backend/app/dev_tasks/collection_thin_content/gsc_metrics.py`.

## Database

- New tables: `public.collection_thin_content_config`, `public.collection_thin_content_audit` (see
  `schema.py` for full DDL). No existing table reused/modified.
- New table (2026-09-21, later): `public.collection_thin_content_faq_draft` — caches the last AI-generated
  FAQ schema draft per collection.
- Migration-safe columns added to `collection_thin_content_audit` (2026-09-21, later): `implementation_status`,
  `implemented_by`, `implemented_at`, `verification_status`, `verified_at` — Implement/Verify/History workflow.

## UPDATE (2026-09-22) — FAQ schema generation feature

Added after Level 1's own closure, as a separate later-requested capability (FAQ Analysis tab's
"Generate FAQ" button) — NOT part of the original Level 1 scope, and NOT re-opening that closure.

- **Local LLM**: same self-hosted `LOCAL_LLM_*` endpoint (Qwen3-Next) every other AI-generation dev task in
  this codebase uses (`meta_audit/generate.py`, `alt_text_keywords/ai_alt_text.py`), with the same Gemini
  fallback (`ai_shared.call_gemini`). File: `backend/app/dev_tasks/collection_thin_content/faq_generation.py`.
- **PAA (People Also Ask) questions**: `backend/app/dilaksi_faq_scrapedo.py`'s Scrape.do integration — the
  SAME shared, credit-metered infrastructure the existing product-level FAQ system depends on. Extended
  (2026-09-22) to support a 3rd token slot (`DILAXI_SCRAPE_API_TOKEN_3`); `PAA_MAX_ATTEMPTS_PER_PRODUCT` now
  derives from `len(SLOT_ENV)` so automatic failover reaches all configured slots, not a hardcoded 2. New
  `get_quota()`/`get_all_quotas()` (GET `/info`, confirmed live not to consume a credit) surfaced via
  `GET /api/dev/collection-thin-content/faq-quota` and shown in the Config tab.
- **Internal links**: `internal_linking.schema.list_pages()` (the Internal Linking Suggestion Engine's
  existing content index), matched by simple token overlap — no new content index built.
- **Output is SCHEMA ONLY** (FAQPage JSON-LD, full `<script type="application/ld+json">...</script>` block
  ready to paste) — no visible HTML/FAQ content is generated, per explicit instruction (an earlier version
  that also generated visible HTML was built then reverted).
