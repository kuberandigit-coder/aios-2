# Prompt — Dilaksi Req 2: SEO Priority Rule Application

- **Title:** Reusable prompt — apply approved SEO Priority business rule to Req 2 all-products page
- **Purpose:** Recalculate the SEO Priority badge for all products whenever data refreshes.
- **Date:** 2026-07-02 · **Requirement source:** User-approved business rule (GPT planning layer, 2026-07-02) · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which products should the SEO team prioritise, using demand, sales, organic sessions and (when available) profit margin?

## SEO Priority rule used (exact order — do not reorder)
1. Demand < 100 AND Sales < £2,000 → **Low — flag for review**
2. Sales ≥ £10,000 AND Profit Margin ≥ 30% → **High**
3. Demand ≥ 2,000 AND Organic Sessions < (Demand × 0.5) → **High**
4. Sales ≥ £4,000 AND Profit Margin ≥ 25% AND Demand ≥ 500 → **Medium**
5. Demand ≥ 500 AND Organic Sessions ≥ (Demand × 0.5) → **Medium**
6. Else → **Low**

Missing-data handling: never invent profit margin; apply only rules that do not require it; if priority is genuinely undeterminable, mark "Pending — missing required data" and document.

## How to rerun
```
python "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\dilaksi\data\2026-07-02_req2-page-builder.py"
```
The builder computes priorities (function `seo_priority`), writes the per-row calculation log to `reports/dilaksi/data/2026-07-02_req2-seo-priority-log.csv`, and regenerates the page + synced guidance copy.

- **Files created or modified:** see evidence file.
- **Evidence path:** `evidence/dilaksi/2026-07-02_dilaksi_req2_seo_priority_rule_evidence.md`
- **Validation result:** PASS (0 mismatches on independent re-check of 1,231 rows)
- **Status:** Completed · **Known limits:** Profit margin N/A (COGS pending) — provably not required for this dataset (max sales £1,995.12 < £4,000). Not deployed (approval pending).
- **Next step:** Deploy after approval; re-add PM rules evaluation when COGS lands.
- **PASS/FAIL rule:** PASS only if the rule is applied in exact order with no invented values, evidence saved, HTML validated, AIOS updated. **PASS**
