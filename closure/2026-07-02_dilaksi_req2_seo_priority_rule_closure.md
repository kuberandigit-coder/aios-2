# Closure — Dilaksi Req 2: SEO Priority Rule

- **Title:** SEO Priority column completed on Req 2 all-products page
- **Purpose:** Close the SEO Priority task under the approved business rule.
- **Date:** 2026-07-02 · **Requirement source:** user-approved rule (GPT planning layer) · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which products should the SEO team prioritise?
- **SEO Priority rule used:** 6-condition ordered rule — full text in prompt/evidence files.

## Outcome
All 1,231 product rows now carry an SEO Priority badge computed strictly from the approved rule: **High 110 · Medium 0 · Low 435 · Low — flag for review 686 · Pending 0**. Profit margin was missing for every row but provably never required (max product sales £1,995.12 < the £4,000/£10,000 thresholds of the margin rules) — nothing invented. Per-row calculation log saved; independent re-check found 0 mismatches. Required note added to the page. **Deployed to Vercel production after user approval (2026-07-02): `dpl_5ewCmKKhNZwX4das8Vg9gM8yxmLe`, verified live (HTTP 200, 1,235 badges, rule note present, Req 1 unaffected).**

- **Files created or modified:** builder, page, synced copy, priority log CSV, 7 AIOS files (full list in evidence)
- **Evidence path:** `evidence/dilaksi/2026-07-02_dilaksi_req2_seo_priority_rule_evidence.md`
- **Validation result:** PASS (`validation/2026-07-02_dilaksi_req2_seo_priority_rule_validation.md`)
- **Status:** Completed — deployed and verified live
- **Known limits:** PM pending (COGS); Medium tier empty on current data; demand = Semrush UK snapshot 2026-07-02
- **Next step:** When COGS lands, rerun builder — rules 2/4 will activate automatically if sales ever reach thresholds — and redeploy.
- **PASS/FAIL rule:** PASS only if rule applied exactly, evidence saved, HTML validated, AIOS updated. **PASS — RAG GREEN**
