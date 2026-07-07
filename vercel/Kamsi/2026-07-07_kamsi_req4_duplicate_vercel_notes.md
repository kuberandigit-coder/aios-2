# Vercel Notes — Kamsi Requirement 4: Duplicate of Dilaksi Requirement 2

**Title:** Deployment recommendation for Kamsi Req 4
**Purpose:** Record deployment status and pre-deploy checklist
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Business Question:** Where and how should Kamsi Req 4 be deployed, if approved?
**PostgreSQL Sources Checked:** Not checked for this task because copy-only reuse was requested
**External Sources Checked:** Not checked for this task because copy-only reuse was requested

## Status: NOT DEPLOYED — no approval requested for this task

Per the task's explicit rule ("No deployment performed" is a PASS condition; "deployment was performed" is a FAIL condition), this build has **not** been pushed to Vercel. It currently exists only as local files:
- `reports/digital-marketing-member-pages/pages/kamsi-req4-product-priority-guidance.html` (live-site copy — same Vercel project as all other member pages, `digital-marketing-member-pages`)
- `reports/Kamsi/kamsi-requirement-4-product-priority-guidance.html` (archival copy)

## Recommendation
Deploy to the **same Vercel project** already used for Kamsi's other requirements: `digital-marketing-member-pages` (project ID `prj_ziowoLxTbIReqBYx1zVweZZBaBDg`), same as Dilaksi Req 2 and Kamsi Req 1–3. No new project needed.

## Pre-deploy checklist (for when approval is given)
- [ ] Confirm the tab label decision (see evidence/handover files) is acceptable to Kuberan
- [ ] Confirm page opens locally without console errors (same JS as Dilaksi Req 2, already verified working there)
- [ ] Run `vercel deploy --prod --yes` from `reports/digital-marketing-member-pages/`
- [ ] Verify live: HTTP 200 on `kamsi-req4-product-priority-guidance.html`, 5,179 rows in embedded dataset, tab-nav shows R4 active and links correctly to R1–R3
- [ ] Verify Kamsi's R1/R2/R3 pages' new "Requirement 4" tab link resolves correctly post-deploy
- [ ] Confirm no Dilaksi pages were affected by the deploy

**Next step:** obtain explicit deploy approval from Kuberan, then execute checklist above.
