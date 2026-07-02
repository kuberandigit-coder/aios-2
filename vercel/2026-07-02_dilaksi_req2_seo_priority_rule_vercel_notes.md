# Vercel Notes — Dilaksi Req 2: SEO Priority Rule

- **Title:** Deployment status for the SEO Priority page update
- **Purpose:** Record deployment state and the exact command for when approval is given.
- **Date:** 2026-07-02 · **Requirement source:** user-approved rule · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question / SEO Priority rule used:** see prompt file.

## Status: NOT DEPLOYED (per scope — deployment requires explicit approval)
- Local page updated: `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html`
- Live production page still shows the previous version (deployment `dpl_CkLAekmwkxiwPVnnbQUsPe6Sko3s`, before SEO Priority).

## On approval, run:
```
cd "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages"
vercel deploy --prod --yes
```
Then verify live at https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req2-all-products.html :
- HTTP 200; `class="pri` occurrences = 1,235 (1,231 rows + 4 legend samples)
- Rule note present: "SEO Priority calculated using approved Dilaksi Requirement 2 business rule."
- Req 1 page (`/pages/dilaksi.html`) unchanged.
Then update this file with the new deployment ID and mark closure GREEN.

- **Files created or modified / Evidence path / Validation result:** see evidence file · PASS (local)
- **Status:** awaiting deployment approval · **Known limits:** live page temporarily behind local
- **Next step:** deploy on approval
- **PASS/FAIL rule:** as evidence. **PASS (local scope)**
