# Handover — Req 2 Semrush Demand

**Title:** Demand field handover for GPT/Kuberan/Mani · **Date:** 2026-07-02 · **Requirement number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance · **Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

## State
- Local `pages/dilaksi-req2-all-products.html` now shows Semrush demand: collection headers (5 head terms) + purple badges on top 30 sellers. Live Vercel site still serves the pre-demand version until deploy is approved.
- Builder script with the demand dictionaries: scratchpad `req2/build_page.py`; canonical mapping table lives in the evidence file (scratchpad is session-temporary).
- Coverage decision: top 30 by sales + collection heads. Remaining ~1,200 products deliberately unmapped (cost + junk-keyword risk from raw titles) — flagged, not guessed.

**Semrush source checked:** keyword_research → phrase_these, uk, 2026-07-02
**Keywords checked:** 39 (mapping table in evidence)
**Files created or modified:** 2 HTML + AIOS set
**Evidence path:** evidence/dilaksi/2026-07-02_dilaksi_req2_semrush_demand_evidence.md
**Validation result:** PASS · **Owner/reviewer:** Kuberan · **Status:** DELIVERED (local)
**Known limits:** partial product coverage; UK assumption.
**Next step:** (1) deploy on approval (`vercel deploy --prod --yes` from member-pages folder); (2) full-catalog batch decision; (3) remaining req2 fields (margin, organic sessions, SEO priority rule) still pending pipeline.
**PASS/FAIL rule:** future changes PASS only with executed Semrush values + updated evidence.
