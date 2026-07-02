# Source Map — Req 2 Demand (searches/mo)

**Title:** Demand field source mapping · **Date:** 2026-07-02 · **Requirement number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance · **Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

| Report field | System | Object/report | Params | Notes |
|---|---|---|---|---|
| Demand (searches/mo) — collection level | Semrush MCP | keyword_research → `phrase_these` | database=uk, phrase="pendant lights;wall lights;spider light;plug in lighting;table lamps" | HIGH confidence head terms |
| Demand (searches/mo) — product level (top 30) | Semrush MCP | keyword_research → `phrase_these` | database=uk, 30 cleaned-title keywords (see evidence) | MEDIUM/LOW; fallbacks documented |
| Demand — remaining ~1,200 products | pending | same report, batched | — | awaiting approval (API cost) |

**Semrush source checked:** phrase_these schema + 2 executed batches (2026-07-02)
**Keywords checked:** 39 total (see evidence table)
**Files created or modified:** all-products page + reports/dilaksi copy + AIOS set
**Evidence path:** evidence/dilaksi/2026-07-02_dilaksi_req2_semrush_demand_evidence.md
**Validation result:** PASS · **Owner/reviewer:** Kuberan · **Status:** ACTIVE
**Known limits:** UK database assumption documented; head-term volumes not product-exact.
**Next step:** full-catalog batch on approval.
**PASS/FAIL rule:** PASS if every displayed volume traces to an executed report line.
