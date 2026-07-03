# Source Map — Dilaksi Req 3 First Phase

- **Title:** Data lineage for Requirement 3 first-phase values · **Purpose:** trace every value to its source
- **Date:** 2026-07-03 · **Requirement source:** Req 3 sheet URLs (user-supplied in chat) · **Requirement number:** 3
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which pages can safely be removed from ledsone.co.uk?

| Column | Source system | Object/API | Window | File |
|---|---|---|---|---|
| URL | Requirement 3 input (user) | — | — | `reports/dilaksi/data/2026-07-03_req3-urls.csv` |
| GA4 Sessions | GA4 Data API, property 408110563, service account | runReport: landingPagePlusQueryString + sessions, filter Organic Search, BEGINS_WITH path, exact-path summed | 365daysAgo → 2026-07-03 | script `…req3-ga4-12m-fetch.py`, raw `…req3-ga4-organic-12m.csv` |
| Currently Live | Shopify Admin GraphQL + live HTTP | collectionByHandle, products(handle:), pages(handle:), urlRedirects(path:); curl status per URL | live at 2026-07-03 | evidence file (raw values inline) |
| Linked Nav/Footer/Sitemap | Live website | homepage `<header>`/`<footer>` spans; sitemap.xml index + products_1-3/pages_1/collections_1 sub-sitemaps | fetched 2026-07-03 | evidence file |
| Referring Backlinks | Semrush | NOT AVAILABLE (no connector) | — | pending phase 2 |
| GSC Impressions / Recommended Action | — | deferred by requirement | — | blank in final report |

- **Connectors checked:** GA4 ✓ Shopify ✓ Website ✓ Semrush ✗ · **URLs checked:** 5/5
- **Files created / Evidence path / Validation result:** see evidence · PASS
- **Status:** phase 1 complete · **Known limits:** backlinks pending · **Next step:** phase 2
- **PASS/FAIL rule:** as evidence. **PASS**
