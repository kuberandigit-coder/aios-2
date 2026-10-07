# Source Map — Blog Optimization: GSC live API migration

**Date:** 2026-10-06 **Owner:** Kuberan

Only sources actually used after the migration are documented here. The external business
database's `google_search_console.page`/`query_page` tables, used before this migration, are
explicitly **no longer used** by this task.

| Source | Access | Used for | Limits |
|---|---|---|---|
| Google Search Console `searchAnalytics.query` API, properties `sc-domain:ledsone.co.uk` and `https://ledsone.de/` | `GSC_SERVICE_ACCOUNT_KEY` service account (shared with GA4) via `backend/app/dev_tasks/blog_optimization/gsc_sync.py` | Live page- and query-level clicks/impressions/ctr/position | Confirmed live, 2026-10-06; this credential has NO access to `ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`, `electricalsone.co.uk`, `besbet.co.uk` (HTTP 403 on all 5) |
| Google Search Console `searchAnalytics.query` API, property `https://ledsone.fr/` | Dedicated `GSC_LEDSONE_FR_SERVICE_ACCOUNT` service account (same one `structured_data_validation`'s URL Inspection already uses) | Live page- and query-level clicks/impressions/position | Confirmed live, 2026-10-06, verified against real data on a sample page |
| Shopify Admin GraphQL API, store `ledsone_uk` | `SHOPIFY_UK_ADMIN_TOKEN` via `backend/app/core/shopify_client.py`'s `graphql()` | Blog article title/body for Current Blog HTML, QA Check, Fix/Apply | Full access, confirmed working |
| Shopify Admin GraphQL API, store `ledsone_fr` | `SHOPIFY_FR_ADMIN_TOKEN` via the same `graphql()` | Same as above, for ledsone.fr blogs | Confirmed working, live-tested against a real article |
| Shopify Admin GraphQL API, store `ledsone_de` | `SHOPIFY_ADMIN_TOKEN` via the same `graphql()` | Same as above, for ledsone.de blogs | **Blocked** — this app's token lacks the `read_content` scope; `articles` query returns `ACCESS_DENIED`. GSC metrics for ledsone.de are unaffected (separate credential above) |
| This app's own Postgres | `backend/app/core/db.py`'s `get_conn()` | New tables: `blog_optimization_gsc_page`, `blog_optimization_gsc_query` (synced weekly), `blog_optimization_fix_log` (persisted applied fixes), plus the pre-existing `blog_optimization_task`/`_snapshot`/`_cause`/`_content_draft` tables | DATABASE_URL configured, no credential exposed |

## Explicitly NO LONGER used (replaced 2026-10-06)

- External business database (`169.58.91.229`), `google_search_console.page`/`query_page` —
  this table has broader site coverage than either GSC credential above actually has live API
  access to; kept populated by whatever process feeds it (outside this codebase), but Blog
  Optimization itself no longer reads from it.

## Explicitly NOT used (unchanged scope)

- SerpAPI / competitor search — removed from Blog Optimization entirely on 2026-10-06 per
  explicit instruction (the Competitor Analysis section was deleted; Likely Cause still
  internally reuses `content_gap_core`'s already-cached data, not a new SerpAPI call).
- Semrush, Google Keyword Planner, Google Ads API — not part of this task.
