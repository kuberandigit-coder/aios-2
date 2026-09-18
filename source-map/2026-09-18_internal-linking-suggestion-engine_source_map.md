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
