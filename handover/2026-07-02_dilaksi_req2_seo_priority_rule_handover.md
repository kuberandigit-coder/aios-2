# Handover — Dilaksi Req 2: SEO Priority Rule

- **Title:** Handover for continuing/deploying the SEO Priority work
- **Purpose:** Let any fresh session continue without re-discovery.
- **Date:** 2026-07-02 · **Requirement source:** user-approved rule · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question / SEO Priority rule used:** see prompt file (exact 6-condition ordered rule).

## State (all verified)
- Page `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` rebuilt locally with SEO badges on all 1,231 rows (High 110 / Medium 0 / Low 435 / Low-flag 686 / Pending 0) + red rule box + legend + footer update. Synced copy regenerated.
- Builder `reports/dilaksi/data/2026-07-02_req2-page-builder.py` is the single source — rerun it to recompute everything (it also writes the per-row log `2026-07-02_req2-seo-priority-log.csv`).
- **NOT deployed.** Live Vercel page still shows the pre-SEO-priority version.

## Remaining step (needs explicit user approval)
`cd reports/digital-marketing-member-pages` → `vercel deploy --prod --yes` → verify live (check `class="pri` count = 1,235 incl. 4 legend samples, rule note present) → update vercel notes file + closure.

## Key facts a fresh session must know
- Profit margin absent for all rows; provably unrequired (max sales £1,995.12 < £4,000). Do NOT mark rows Pending for missing PM.
- 14 products have unmapped demand keywords → "Low — flag for review" with condition "1/6 (demand unmapped; Low either way)".
- Organic sessions come from GA4 join done earlier on 2026-07-02 (see that task's evidence); demand from Semrush UK files in `reports/dilaksi/data/`.

- **Files created or modified / Evidence path / Validation result:** see evidence + validation files (same-named)
- **Status:** Completed locally, deployment pending · **Known limits:** as closure
- **Next step:** deploy on approval
- **PASS/FAIL rule:** PASS only if rule applied exactly, evidence saved, HTML validated, AIOS updated. **PASS**
