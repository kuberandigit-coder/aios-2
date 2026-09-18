# Source Map — Internal Linking Suggestion Engine — Step 01 Content Index

Date: 2026-09-18

| Data | Source | Notes |
|---|---|---|
| Product pages (URL, title, content, type, status) | Existing Shopify Admin API integration, store `ledsone_uk`, `products` GraphQL query (paginated) | Read-only; reused `shopify_client.graphql` — no new client |
| Collection pages (URL, title, content) | Same Shopify Admin API integration, `collections` GraphQL query (paginated) | Read-only |
| Blog pages | Existing Shopify Admin API integration, store `ledsone_uk`, `blogs { articles { ... } }` GraphQL query — **live and working** | `read_content` scope granted on the same existing app/token (reissued, no new client). `fetch_blog_pages()` verified end-to-end against production: 159 real blog articles indexed. Fields used: `body` (content), `id` (source identity, numeric part extracted from the GID), `handle`, `title`, `publishedAt` — confirmed via live schema introspection (Article has no `legacyResourceId`/`contentHtml`, and there is no `blogByHandle` root query; `blog(id:)` is used instead for paginating a blog's articles). |
| Target keywords | **None available** | No existing reliable keyword-to-page assignment source is wired to products/collections/blog pages in this project |
| Storage | New table `public.internal_linking_content_index` in the existing dm-dashboard Postgres database | Reuses `backend/app/db.py`'s `get_conn()` pool; no new database or connection created |

No external API, credential, or data source outside what's listed above was introduced.

## UPDATE (2026-09-18, later) — Step 02 data source

| Data | Source | Notes |
|---|---|---|
| Link opportunities | The Step 01 `internal_linking_content_index` table only | No new Shopify/blog fetch — Step 02 is pure analysis of already-indexed `page_title`, `content_text`, `content_html`, `product_type`, `normalized_url` |
| Existing-link detection | `content_html` already stored in Step 01 | Reuses the same href-parsing approach as `backend/app/hetheesha.py`'s existing Req5 `_extract_links`, extended for blog article URLs |
| Storage | Two new tables in the same production Postgres database as Step 01 | `internal_linking_opportunities`, `internal_linking_opportunity_scans` |
