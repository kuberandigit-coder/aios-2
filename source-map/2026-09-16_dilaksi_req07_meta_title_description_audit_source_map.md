## Dilaksi Requirement 07 — Source Map

Only sources actually used are documented here. Semrush, Google Keyword
Planner, and Google Ads API are explicitly NOT used in this requirement
and are deliberately not listed.

| Concern | File / Endpoint | Notes |
|---|---|---|
| Backend audit + API | `backend/app/dilaksi_meta_audit.py`, router at `/api/dilaksi/meta-audit/*` | Registered in `backend/app/main.py`; own single-row snapshot table |
| Frontend UI | `frontend/src/dilaksi/pages/MetaTitleDescriptionAudit.jsx` (Requirement 07 tab) | Wired via `frontend/src/dilaksi/DilaksiLayout.jsx` + `frontend/src/taskRegistry.js` |
| Shopify integration | Shopify Admin GraphQL API, store `ledsone_uk`, via existing `backend/app/shopify_client.py`'s `graphql()` | `products(first:100, sortKey: ID)` (ACTIVE only) + `collections(first:100)`, `seo { title description }` fields — SHOPIFY_API configured (token never exposed) |
| GA4 integration | GA4 Data API property `408110563`, via existing `backend/app/google_client.py`'s `fetch_ga4_report()` | `landingPagePlusQueryString` dimension, `sessions` metric, Organic Search channel only, rolling 30-day window (same convention as Dilaksi Req1/Req2) — GA4 configured (service-account credential never exposed) |
| Persistence | This app's own Postgres, `public.dilaksi_meta_audit_snapshot` table, via existing `backend/app/db.py`'s `get_conn()` | DATABASE_URL configured; single JSONB snapshot row, no new schema |

### Explicitly NOT used (per requirement scope)
- Semrush
- Google Keyword Planner
- Google Ads API
- Manual CSV keyword data
- Website scraping (Shopify Admin API is the authoritative metadata source)
