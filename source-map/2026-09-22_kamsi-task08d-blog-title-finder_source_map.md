# Source Map — Kamsi Task 08d: Top 10 Blog Title Finder (Google Search Only)

Date: 2026-09-22

| # | Source | Purpose | Authority | Data used | Read/Write | Status |
|---|---|---|---|---|---|---|
| 1 | Shopify Admin API (UK store, `ledsone_uk`) via existing `shopify_client.graphql()` | Resolve a LEDSone product/collection URL to real page content (title, H1, description) | Authoritative — same client every other dev task uses | Product/collection title, description, SEO title/description | Read-only | Live, proven pattern reused as-is |
| 2 | NEW Kamsi SerpAPI.com integration (`serpapi_kamsi.py`, env `KAMSI_SERPAPI_KEY`) | One Google UK search per research run; source of Organic/Ads/Shopping SERP data | New, isolated from Sajeepan's SerpAPI credential/module | `organic_results`, `ads`, `shopping_results`/`inline_shopping_results` per SerpAPI.com's documented `google` engine schema | Read-only (external search only, no write) | **Coded, NOT yet live-verified — no real key configured** |
| 3 | Local LLM (`LOCAL_LLM_API_KEY`/`LOCAL_LLM_BASE_URL`/`LOCAL_LLM_MODEL`) + Gemini fallback (`ai_shared.call_gemini`) | Primary keyword extraction + title generation | Same shared infra as `geo_visibility/content_actions.py`, `collection_thin_content/faq_generation.py`, `meta_audit/generate.py`, `alt_text_keywords/ai_alt_text.py` | Page title/H1/body text in; keyword/summary/title JSON out | External call, no DB write by the LLM itself | Proven pattern reused; not live-tested in this session (blocked on #2) |
| 4 | PostgreSQL (this app's own DB, `get_conn()`) | Persist research/SERP/title-generation history | Authoritative, this app's own database | 3 new tables: `kamsi_blog_title_research`, `kamsi_blog_title_serp_results`, `kamsi_blog_title_generations` | Read/write | Live — schema created and confirmed against the real DB |
| 5 | Kamsi UAM (`access_grants` table + `taskRegistry.js`) | Controls who can see/use this dev task in the UI | Existing generic grant-store, unchanged in shape | `task_key='tools.DevKamsiBlogTitleFinder'`, `granted_to_staff_key='kamsi'` | Read/write (one row inserted) | Live — confirmed via query |
| 6 | Development Tasks system (`dev_tasks/__init__.py`, `AdminLayout.jsx`, `DevLayout.jsx`) | Registers this task's router/schema/nav entry alongside every sibling dev task | Existing registry, unchanged shape | Router include, schema init call, nav `children` entry, `LazyPanel` render block | N/A (wiring only) | Live — route registration and frontend build both confirmed |

## Explicitly NOT a source

- Sajeepan's SerpAPI credential/module (`sajeepan_lens_serpapi.py`,
  `SERP_API_1`/`SERP_API_2`) — never read, called, or modified by this
  task, per explicit instruction. Confirmed via `grep` (zero import
  coupling).
- Playwright/browser automation — explicitly rejected per the earlier
  feasibility test this session (Google bot-detection blocks it).
