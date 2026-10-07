# Source Map — Blog HTML Automation (Step 1 audit findings)

**Date:** 2026-10-07 **Owner:** Kuberan

This is a PLANNING source map — Blog HTML Automation does not exist yet. It documents which
data sources/APIs the Step 1 audit confirmed are actually available for it to use, based on
code inspection of existing dm-dashboard tasks (not assumption).

| Source | Access | Available for Blog HTML Automation | Limits |
|---|---|---|---|
| GSC `searchAnalytics.query` API — `ledsone.co.uk`, `ledsone.de` | Shared `GSC_SERVICE_ACCOUNT_KEY`, already synced weekly into this app's own Postgres by `blog_optimization/gsc_sync.py` | YES — read `blog_optimization_gsc_page`/`_query` directly, no new GSC call needed | Confirmed live 2026-10-06; 5 other sites (`ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`, `electricalsone.co.uk`, `besbet.co.uk`) return HTTP 403 with this credential |
| GSC `searchAnalytics.query` API — `ledsone.fr` | Dedicated `GSC_LEDSONE_FR_SERVICE_ACCOUNT`, same weekly sync | YES — same table, same read path | Confirmed live 2026-10-06 |
| Shopify Admin GraphQL — `ledsone_uk`, `ledsone_fr` | `SHOPIFY_UK_ADMIN_TOKEN` / `SHOPIFY_FR_ADMIN_TOKEN` via `core/shopify_client.graphql()` | YES — products, collections, articles all readable | Confirmed working (live-tested for blog content 2026-10-06) |
| Shopify Admin GraphQL — `ledsone_de` | `SHOPIFY_ADMIN_TOKEN` via the same client | PARTIAL — products/collections likely fine (not yet live-tested for this feature); blog `articles` field confirmed `ACCESS_DENIED` (missing `read_content` scope) | Needs a Shopify admin permissions grant before DE blog content/automation works |
| Shopify Admin GraphQL — any other store (`ledsone_us`, `vintagelite`, `electricalsone`, `besbet`) | No credential configured | NO | Would need a new `STORES` entry + new Shopify Admin app + token before any access exists |
| SerpAPI (competitor/content-gap search) | Shared account, `content_gap/core.py`, quota tracked via `sajeepan_lens_quota` | YES, via the existing shared engine — do not call SerpAPI directly | 20s cooldown between analyze calls, 15-credit reserve floor enforced in code |
| Scrape.do (PAA questions for FAQ generation) | Shared, credit-metered, `automation_task/dilaksi_faq_scrapedo.py` | YES, via `faq_schema.py`'s existing PAA fetch — do not call Scrape.do directly | Fetched only on explicit user click, cached by caller |
| Local self-hosted LLM + Gemini/Groq/NVIDIA fallback | `LOCAL_LLM_*` env vars + provider keys, via `dev_tasks/local_llm.py` | YES — the one shared caller every task uses | Same shared infra every other AI-generation task in this app depends on |
| Internal Linking content index | This app's own Postgres, `internal_linking_content_index` table | YES — real Shopify-sourced data, already maintained | Reflects whatever the Internal Linking task's own refresh has indexed; not live-fetched per Blog HTML Automation request |
| Content Gap competitor cache | This app's own Postgres, `content_gap_result` table | YES — read via `get_latest_for_page()`, or trigger a fresh check via `run_analyze()` | Shares the SerpAPI quota above |
| AI/GEO Visibility (AEO) data | This app's own Postgres, `geo_visibility_queries`/`_results` tables, sourced from SearchAPI.io | YES, read-only, as an input signal | Do not re-implement AI Overview detection — this is the single existing source for it |

## Explicitly NOT available / NOT to be built as a new integration

- Direct SerpAPI or Scrape.do calls from a new Blog HTML Automation module — must go through
  the existing `content_gap`/`faq_schema` wrappers.
- A second Google Search Console client — must read `blog_optimization`'s already-synced tables.
- Shopify blog-content WRITE access for any store — does not exist anywhere in this codebase
  today (see the audit's §6/evidence doc for the one narrow exception, alt-text-only).
