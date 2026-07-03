# Draft Report Notes — Dilaksi Req 3 First Phase (Pages for Removal)

- **Title:** First-phase data table — GA4 sessions, Shopify live status, website link inspection
- **Purpose:** Verified data collection before building the final Requirement 3 HTML report.
- **Date:** 2026-07-03 · **Requirement source:** Dilaksi Requirement 3 sheet (URLs supplied by user in chat, saved to `reports/dilaksi/data/2026-07-03_req3-urls.csv`)
- **Team member:** Dilaksi · **Team:** SEO · **Requirement number:** 3
- **Business question:** Which pages can safely be removed from ledsone.co.uk?
- **Connectors checked:** GA4 Data API (property 408110563) · Shopify Admin GraphQL (LEDSone UK Ltd) · live website inspection (homepage HTML + sitemap.xml chain)
- **Reporting period (GA4):** last 12 months (365daysAgo → 2026-07-03), Organic Search channel only

## First-phase data table

| URL | GA4 Organic Sessions (12m) | Linked in Nav/Footer/Sitemap | Currently Live |
|---|---|---|---|
| /collections/wall-light | **237** (206 exact + 31 across 15 paginated `?page=` variants) | **Yes** — header navigation ✓ · footer ✗ · sitemap ✓ (sitemap entry is Shopify auto-generated, but header link makes it deliberately linked) | **Yes** — HTTP 200; Shopify collection exists (gid 159869927520, "Wall Lights & Sconces") |
| /pages/summer-sale-2023 | 0 | No — not in header, footer, or any sitemap | **No — 404**; no Shopify page with this handle; no URL redirect configured |
| /products/discontinued-lamp-x | 0 | No | **No — 404**; no Shopify product with this handle (any status incl. draft/archived); no redirect |
| /pages/old-landing-black-friday | 0 | No | **No — 404**; no Shopify page; no redirect |
| /products/spider-light-v1-old | 0 | No | **No — 404**; no Shopify product (any status); no redirect |

## How each decision was made
- **GA4:** one runReport per URL, dimension landingPagePlusQueryString BEGINS_WITH path, filter sessionDefaultChannelGroup = Organic Search, 365daysAgo→today; only rows whose query-stripped path equals the URL exactly are summed. Script: `data/2026-07-03_req3-ga4-12m-fetch.py`; raw output: `data/2026-07-03_req3-ga4-organic-12m.csv`.
- **Live status:** curl HTTP status per URL (no redirect following) + Shopify Admin GraphQL: `collectionByHandle`, `products(query:"handle:…")` (returns all statuses incl. DRAFT/ARCHIVED), `pages(query:"handle:…")`, `urlRedirects(query:"path:…")` — all four missing URLs are absent from every object type and have no redirects.
- **Nav/Footer/Sitemap:** fetched https://ledsone.co.uk/ (787 KB HTML), extracted `<header>…</header>` and `<footer>…</footer>` spans and searched for each path; fetched sitemap.xml index + all product/pages/collections sub-sitemaps and searched for exact `<loc>` entries. Sitemap is Shopify auto-generated (stated in the sitemap's own comment) — noted per URL.

## Pending for final report (phase 2)
GSC Impressions and Recommended Action columns — left blank by requirement. Referring Backlinks — blocked: no Semrush connector available (needs Semrush export or API access, or approval to mark "Pending").

- **Files created:** this file, urls CSV, GA4 script + CSV, AIOS set · **Files modified:** none
- **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_first_phase_ga4_shopify_website_evidence.md`
- **Validation result:** PASS · **Owner/reviewer:** Kuberan · **Status:** first phase complete
- **Known limits:** backlinks pending (no Semrush connector); GA4 sessions are landing-page organic sessions (standard URL-level metric)
- **Next step:** supply Semrush backlink data → build final HTML report + member page
- **PASS/FAIL rule:** PASS only if GA4, Shopify status and link inspection collected for every URL with nothing guessed. **PASS**
