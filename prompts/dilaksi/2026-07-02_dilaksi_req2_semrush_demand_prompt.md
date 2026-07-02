# Prompt — Req 2 Semrush Demand (Reusable)

**Title:** Fetch/refresh Demand (searches/mo) for Requirement 2 · **Date:** 2026-07-02 · **Requirement number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance · **Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

## Reusable prompt
> 1. Use Semrush MCP `keyword_research` → `phrase_these`, database **uk**, export_columns Ph,Nq,Cp,Kd.
> 2. Keyword priority: existing target keyword → cleaned product title (strip codes/sizes/~numbers) → collection head term + product noun. Record keyword per row with HIGH/MEDIUM/LOW confidence; if a keyword returns 0/no data, try one documented fallback.
> 3. Update PROD_DEMAND / COLL_DEMAND dicts in the page builder (scratchpad `req2/build_page.py`, mirrored in this prompt's evidence), rerun the builder — it regenerates `pages/dilaksi-req2-all-products.html` + syncs `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`.
> 4. Keep the source note sentence intact. Save new evidence with the full keyword→row table. Never guess a volume.

**Semrush source checked:** phrase_these (uk) · **Keywords checked:** 39 (2026-07-02 run)
**Files created or modified:** see evidence · **Evidence path:** evidence/dilaksi/2026-07-02_dilaksi_req2_semrush_demand_evidence.md
**Validation result:** PASS · **Owner/reviewer:** Kuberan · **Status:** ACTIVE
**Known limits:** batch cost ~10 units/keyword; full catalog ≈ 12k units.
**Next step:** full-catalog batch on approval.
**PASS/FAIL rule:** PASS only with executed-report values + documented mapping.
