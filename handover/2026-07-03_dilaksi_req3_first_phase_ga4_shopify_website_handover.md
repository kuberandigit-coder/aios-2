# Handover — Dilaksi Req 3 First Phase

- **Title:** Continuation pack for Requirement 3 phase 2 · **Purpose:** fresh session can build the final report without re-discovery
- **Date:** 2026-07-03 · **Requirement source:** Req 3 sheet URLs · **Requirement number:** 3
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which pages can safely be removed from ledsone.co.uk?

## Verified state
- Input URLs (5): `reports/dilaksi/data/2026-07-03_req3-urls.csv`
- First-phase values (GA4 12m organic, Shopify status, link inspection): complete — table in `reports/dilaksi/2026-07-03_dilaksi_req3_first_phase_data_notes.md`, full method + raw values in evidence.
- GA4 fetch script (reusable): `reports/dilaksi/data/2026-07-03_req3-ga4-12m-fetch.py` → `2026-07-03_req3-ga4-organic-12m.csv`
- Connectors: GA4 service account working; Shopify MCP working; site reachable.

## Phase 2 remaining
1. Referring Backlinks — BLOCKED: no Semrush connector. Need user to supply Semrush Backlink Analytics export per URL (referring domains + backlinks) or approve a "Pending — Semrush data not supplied" column.
2. Build final HTML: `reports/dilaksi/dilaksi-requirement-3-pages-for-removal.html` + member page `reports/digital-marketing-member-pages/pages/dilaksi-req3-pages-for-removal.html` — reuse the member-pages design (copy CSS pattern from `pages/dilaksi.html`; table columns: URL, GA4 Sessions, Referring Backlinks, Linked in Nav/Footer/Sitemap, Currently Live; GSC Impressions + Recommended Action left blank). Header must show Generated date, Website, Reporting period (last 12 months), Connector sources.
3. AIOS set for phase 2 + deploy ONLY after explicit approval (`cd reports/digital-marketing-member-pages; vercel deploy --prod --yes`).

- **Connectors checked / URLs checked / Files created:** see evidence · **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_first_phase_ga4_shopify_website_evidence.md`
- **Validation result:** PASS · **Status:** phase 1 complete, phase 2 blocked on Semrush input
- **Known limits:** as closure · **Next step:** Semrush data → final report
- **PASS/FAIL rule:** phase 2 PASS requires every column real or explicitly marked Pending with approval. **Phase 1: PASS**
