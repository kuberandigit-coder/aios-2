# Source Map — Task 15 Structured Data Validation (ledsone.fr)

**Date:** 2026-09-25  **Owner:** Hetheesha

| Source | Access | Used for | Limits |
|---|---|---|---|
| ledsone.fr sitemap index + child sitemaps (public) | HTTP GET, identifying User-Agent, about 4 workers | URL list, template by path | Only what the shop publishes |
| ledsone.fr page HTML (public) | HTTP GET | JSON-LD, microdata, RDFa | HTML is not stored, only bounded snippets |
| Shopify Admin API, store `ledsone_fr` | Read-only GraphQL via `shopify_client.graphql` | Catalogue for product checks, shop currency | No mutations |
| Google Search Console URL Inspection API | `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`; dedicated service account env `GSC_LEDSONE_FR_SERVICE_ACCOUNT` (siteFullUser on `https://ledsone.fr/`) | Rich results verdict / detected items | About 2,000 inspections/day and 600/min per property; bounded sample per run; UI Enhancements reports have no API |
| `french_keyword_research_shopify_page_inventory` (Task 13) | App DB read | Cross-check counts only | Not a URL source |

The key value is never stored in code or in these records.
