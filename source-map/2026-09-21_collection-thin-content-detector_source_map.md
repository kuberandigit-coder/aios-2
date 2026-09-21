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
