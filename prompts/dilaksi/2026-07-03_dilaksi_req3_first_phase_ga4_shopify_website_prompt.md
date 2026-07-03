# Prompt — Dilaksi Req 3 First Phase (reusable)

- **Title:** Rerun first-phase data collection for Requirement 3 URLs · **Purpose:** repeatable collection procedure
- **Date:** 2026-07-03 · **Requirement source:** Req 3 sheet URLs · **Requirement number:** 3
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which pages can safely be removed from ledsone.co.uk?
- **Connectors checked:** GA4 Data API, Shopify Admin GraphQL, live website

## Procedure
1. URLs: read `reports/dilaksi/data/2026-07-03_req3-urls.csv` (update this file for new URL batches).
2. GA4: run `python reports/dilaksi/data/2026-07-03_req3-ga4-12m-fetch.py` (edit PATHS to match URLs) — organic-only, 365daysAgo→today, exact-path landing-page sessions.
3. Shopify (MCP graphql_query): `collectionByHandle` / `products(query:"handle:X")` / `pages(query:"handle:X")` / `urlRedirects(query:"path:/…")` per URL; plus `curl -s -o NUL -w "%{http_code} %{redirect_url}"` per URL.
4. Website: fetch homepage, search `<header>`/`<footer>` spans per path; fetch sitemap.xml chain (products 1-3, pages, collections), search exact `<loc>`. Linked = Yes if header or footer; sitemap-only = "No (auto-generated)".
5. Save raw outputs to `reports/dilaksi/data/`, findings table to draft notes, AIOS set.

- **URLs checked:** 5 (2026-07-03 run) · **Files created:** see evidence · **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_first_phase_ga4_shopify_website_evidence.md`
- **Validation result:** PASS · **Status:** complete · **Known limits:** backlinks need Semrush input
- **Next step:** phase 2 final report · **PASS/FAIL rule:** all URLs × all 3 sources, nothing guessed. **PASS**
