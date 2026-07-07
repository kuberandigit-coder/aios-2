# Vercel Notes — Kamsi Requirement 5: Missing Meta Title & Meta Description Detection

**Title:** Deployment recommendation for Kamsi Req 5
**Purpose:** Record deployment status and pre-deploy checklist
**Requirement Source:** Kamsi Google Sheet sample / screenshot provided by Kuberan
**Business Question:** Where and how should Kamsi Req 5 be deployed, if approved?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only
**External Sources Checked:** None (GA4/GSC excluded)

## Status: NOT DEPLOYED — no approval requested for this task

Per the task rule ("No deployment performed" is a PASS condition), this build has **not** been pushed to Vercel. It currently exists only as local files:
- `reports/digital-marketing-member-pages/pages/kamsi-req5-missing-meta-detection.html` (live-site copy — same Vercel project as all other member pages)
- `reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html` (archival copy)

## Recommendation
Deploy to the **same Vercel project** already used for all Kamsi/Dilaksi requirements: `digital-marketing-member-pages` (project ID `prj_ziowoLxTbIReqBYx1zVweZZBaBDg`). No new project needed.

## Pre-deploy checklist (for when approval is given)
- [ ] Confirm the Action Needed tie-break rule (see evidence/handover files) is acceptable to Kuberan
- [ ] Run `vercel deploy --prod --yes` from `reports/digital-marketing-member-pages/`
- [ ] Verify live: HTTP 200 on `kamsi-req5-missing-meta-detection.html`, 5,179 rows in embedded dataset, KPI cards match (Total 5,179 / Missing Title 854 / Missing Desc 1,415 / Both Missing 795 / OK 3,705)
- [ ] Verify search, filters, sort, and CSV export work on the live page
- [ ] Verify Kamsi's Req 1–4 pages' new "Requirement 5" tab link resolves correctly post-deploy
- [ ] Confirm no Dilaksi or Hetheesha pages were affected by the deploy
- [ ] Sync to Staff-requirements repo (same pattern as prior Kamsi/Dilaksi deploys)

**Next step:** obtain explicit deploy approval from Kuberan, then execute checklist above.
