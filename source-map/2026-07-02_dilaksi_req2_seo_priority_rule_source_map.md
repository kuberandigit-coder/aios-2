# Source Map — Dilaksi Req 2: SEO Priority Rule

- **Title:** Data lineage for the SEO Priority calculation
- **Purpose:** Document where every input value comes from.
- **Date:** 2026-07-02 · **Requirement source:** user-approved rule · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question / SEO Priority rule used:** see prompt file.

| Input | Source system | File / API | Window | Notes |
|---|---|---|---|---|
| Sales (£) | Shopify ShopifyQL sales cube | `reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv` | last 30 days | net of returns; summed per (collection, product) |
| Demand (searches/mo) | Semrush UK database | `2026-07-02_req2-keyword-map.json` + `2026-07-02_req2-semrush-volumes.csv` + top-30 manual map in builder | monthly volume, pulled 2026-07-02 | 14 products have no derivable keyword → demand unmapped |
| Organic Sessions | GA4 Data API (property 408110563, service account) | `2026-07-02_req2-ga4-organic-landing-30d.csv` joined via handles p1–p4 | true last 30 days, Organic Search channel | query strings stripped; `/products/<h>` and `/collections/*/products/<h>` |
| Profit Margin | PostgreSQL (COGS) | — | — | NOT AVAILABLE; not invented; provably unrequired (max sales £1,995.12 < £4,000 rule threshold) |
| SEO Priority (output) | computed | `seo_priority()` in `2026-07-02_req2-page-builder.py`; per-row log `2026-07-02_req2-seo-priority-log.csv` | — | 6-condition ordered rule |

- **Files created or modified / Evidence path / Validation result:** see evidence file · PASS
- **Status:** Completed locally (not deployed) · **Known limits:** PM pending · **Next step:** deploy on approval
- **PASS/FAIL rule:** as evidence. **PASS**
