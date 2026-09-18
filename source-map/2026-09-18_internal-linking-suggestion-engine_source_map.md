# Source Map — Internal Linking Suggestion Engine — Step 01 Content Index

Date: 2026-09-18

| Data | Source | Notes |
|---|---|---|
| Product pages (URL, title, content, type, status) | Existing Shopify Admin API integration, store `ledsone_uk`, `products` GraphQL query (paginated) | Read-only; reused `shopify_client.graphql` — no new client |
| Collection pages (URL, title, content) | Same Shopify Admin API integration, `collections` GraphQL query (paginated) | Read-only |
| Blog pages | **None available** | Shopify Admin API token lacks `read_content` scope (confirmed via a live GraphQL call, documented in `backend/app/hetheesha.py` Req5, 2026-09 session); no CMS/DB/crawl source exists in this project. Not scraped. Returns empty list, documented in UI as a limitation. |
| Target keywords | **None available** | No existing reliable keyword-to-page assignment source is wired to products/collections/blog pages in this project |
| Storage | New table `public.internal_linking_content_index` in the existing dm-dashboard Postgres database | Reuses `backend/app/db.py`'s `get_conn()` pool; no new database or connection created |

No external API, credential, or data source outside what's listed above was introduced.
