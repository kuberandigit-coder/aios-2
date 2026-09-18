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

## UPDATE (2026-09-18, later) — Step 03 data source

| Data | Source | Notes |
|---|---|---|
| Link density measurements | The Step 01 `internal_linking_content_index` table only | No new Shopify/blog fetch |
| Existing-link parsing | Reuses (and fixes) Step 02's `extract_link_occurrences` | External-link mis-detection bug found and fixed here — see evidence doc |
| Density thresholds | Project-configuration default, `density_rules.py` | No existing rule found anywhere in the codebase or AIOS — explicitly NOT presented as an SEO industry standard |
| Storage | New table `internal_linking_density` in the same production Postgres database | Replaced per calculation |

## UPDATE (2026-09-18, later) — Step 04 data source

| Data | Source | Notes |
|---|---|---|
| Suggestions | The Step 02 `internal_linking_opportunities` and Step 03 `internal_linking_density` tables only | No new Shopify/blog fetch, no re-matching |
| Priority classification | Project rules, `priority_rules.py` | Cornerstone and "new blog" classifications do not exist anywhere in this project; this step's spec explicitly forbids inventing a publication-age threshold, so neither is guessed -- High/Medium cannot fire with real data today |
| Storage | New table `internal_linking_suggestions` in the same production Postgres database | Upserted (not replaced) to preserve review decisions across regeneration |

## UPDATE (2026-09-18, later) — Step 05 data source

| Data | Source | Notes |
|---|---|---|
| Handoff creation | The Step 04 `internal_linking_suggestions` table only (Approved rows) | No new Shopify/blog fetch |
| Verification | Live `GET` request to the actual source and target URLs, done on demand per handoff | NOT cached (deliberately -- see evidence doc for why `competitor_analysis/http_fetch.py`'s cache pattern was audited and not reused); no Shopify Admin API call, plain public HTTP reads of the live site |
| Assignment | Existing `STAFF_LIST` (SEO/dev staff, `frontend/src/taskRegistry.js`) offered as suggestions only | No new content-team user/role system created -- confirmed none exists anywhere in this project |
| Storage | Two new tables in the same production Postgres database | `internal_linking_handoffs` (approved data frozen at creation), `internal_linking_verification_log` (append-only) |
