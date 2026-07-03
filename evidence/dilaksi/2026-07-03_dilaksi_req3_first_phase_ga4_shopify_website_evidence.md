# Evidence — Dilaksi Req 3 First Phase: GA4 + Shopify + Website Inspection

- **Title:** Raw findings for the 5 Requirement 3 URLs · **Purpose:** verifiable record of every value collected
- **Date:** 2026-07-03 · **Requirement source:** Req 3 sheet URLs supplied by user in chat 2026-07-03 · **Requirement number:** 3
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which pages can safely be removed from ledsone.co.uk?
- **Connectors checked:** GA4 Data API ✓ (property 408110563, service account) · Shopify Admin GraphQL ✓ (LEDSone UK Ltd) · Live website ✓ (ledsone.co.uk reachable)
- **URLs checked (5):** /collections/wall-light · /pages/summer-sale-2023 · /products/discontinued-lamp-x · /pages/old-landing-black-friday · /products/spider-light-v1-old

## 1. GA4 — organic sessions, last 12 months (365daysAgo → 2026-07-03)
Query per URL: dimension `landingPagePlusQueryString` BEGINS_WITH path AND `sessionDefaultChannelGroup` = "Organic Search"; exact-path rows summed (query strings counted as same URL, e.g. `?page=2`).
- Google Analytics objects checked: runReport × 5 (landing pages + sessions metric)
- /collections/wall-light → **237** (exact 206 + 15 `?page=` variants totalling 31)
- /pages/summer-sale-2023 → **0** (no matching landing-page rows at all)
- /products/discontinued-lamp-x → **0**
- /pages/old-landing-black-friday → **0**
- /products/spider-light-v1-old → **0**
- Script: `reports/dilaksi/data/2026-07-03_req3-ga4-12m-fetch.py` · Raw CSV: `reports/dilaksi/data/2026-07-03_req3-ga4-organic-12m.csv`

## 2. Shopify — current existence/status
Shopify objects checked: `collectionByHandle`, `products(query:"handle:…")` (admin API returns ACTIVE/DRAFT/ARCHIVED), `pages(query:"handle:…")`, `urlRedirects(query:"path:…")`.
- wall-light → collection EXISTS: gid://shopify/Collection/159869927520, title "Wall Lights & Sconces", updatedAt 2026-07-02
- discontinued-lamp-x → products result EMPTY (no product in any status)
- spider-light-v1-old → products result EMPTY
- summer-sale-2023 → pages result EMPTY (no page)
- old-landing-black-friday → pages result EMPTY
- urlRedirects for all four missing paths → EMPTY (no redirects configured)
- Live HTTP check (curl, no redirect following): wall-light **200**; all other four **404**, no redirect URL

## 3. Website inspection performed (https://ledsone.co.uk/, fetched 2026-07-03)
- Homepage HTML 787,514 bytes; `<header>` span and `<footer>` span extracted and searched per path.
  - /collections/wall-light: **header YES** (4 occurrences of the path on homepage), footer NO
  - all four other URLs: not present anywhere in homepage HTML
- Sitemap chain: sitemap.xml index → sitemap_products_1/2/3.xml, sitemap_pages_1.xml, sitemap_collections_1.xml fetched; searched for exact `<loc>` per URL.
  - /collections/wall-light: **in sitemap_collections_1.xml** — sitemap is Shopify auto-generated (the sitemap's own comment states it "can not be edited manually"). Because the URL is ALSO deliberately linked in header navigation, the answer recorded is **Yes**, not "No (auto-generated)".
  - all four other URLs: **not in any sitemap** → **No**
- Decision method documented: Linked = Yes if present in header or footer; sitemap-only presence would be recorded "No (auto-generated)" per requirement — no URL fell into that category.

## Final first-phase values
| URL | GA4 Organic 12m | Linked Nav/Footer/Sitemap | Currently Live |
|---|---|---|---|
| /collections/wall-light | 237 | Yes (header + sitemap) | Yes |
| /pages/summer-sale-2023 | 0 | No | No — 404 (no page, no redirect) |
| /products/discontinued-lamp-x | 0 | No | No — 404 (no product any status, no redirect) |
| /pages/old-landing-black-friday | 0 | No | No — 404 (no page, no redirect) |
| /products/spider-light-v1-old | 0 | No | No — 404 (no product any status, no redirect) |

- **Files created:** urls CSV, GA4 script, GA4 CSV, data notes, 8 AIOS files · **Files modified:** none
- **Evidence path:** this file · **Validation result:** PASS · **Status:** first phase complete
- **Known limits:** Referring Backlinks not collected (no Semrush connector — phase 2 input); GSC impressions out of scope this phase
- **Next step:** Semrush backlink data → final HTML report
- **PASS/FAIL rule:** PASS only if all three sources collected per URL, nothing guessed. **PASS**
