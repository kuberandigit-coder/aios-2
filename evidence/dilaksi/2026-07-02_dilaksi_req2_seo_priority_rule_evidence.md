# Evidence — Dilaksi Req 2: SEO Priority Rule Applied

- **Title:** SEO Priority column calculated for all 1,231 Req 2 product rows
- **Purpose:** Fill the SEO Priority column on the all-products page using the approved business rule.
- **Date:** 2026-07-02 · **Requirement source:** User-approved business rule (GPT planning layer) · **Requirement number:** 2
- **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
- **Business question:** Which products should the SEO team prioritise?

## SEO Priority rule used (exact order)
1. Demand < 100 AND Sales < £2,000 → Low — flag for review
2. Sales ≥ £10,000 AND Margin ≥ 30% → High
3. Demand ≥ 2,000 AND Organic < 50% of Demand → High
4. Sales ≥ £4,000 AND Margin ≥ 25% AND Demand ≥ 500 → Medium
5. Demand ≥ 500 AND Organic ≥ 50% of Demand → Medium
6. Else → Low

## Inputs per row (sources)
- **Sales (£, 30d net):** Shopify ShopifyQL extraction `reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv`
- **Demand (searches/mo):** Semrush UK keyword volumes (`2026-07-02_req2-keyword-map.json` + `2026-07-02_req2-semrush-volumes.csv`; top-30 manual map in builder)
- **Organic Sessions (30d):** GA4 Data API organic landing CSV joined by product handle (see 2026-07-02 GA4 organic sessions evidence)
- **Profit Margin:** N/A for all rows (COGS not yet in PostgreSQL) — **not invented**.

## Profit-margin decidability proof (why no row is "Pending")
Rules 2 and 4 are the only rules requiring profit margin, and they also require Sales ≥ £10,000 / ≥ £4,000. Verified against the sales dataset before build: **maximum 30-day product sales = £1,995.12; 0 products ≥ £2,000**. Therefore rules 2 and 4 cannot match any row and every row is fully decidable without profit margin.

## Per-row calculation log (each row: inputs, matched condition number, final priority)
`reports/dilaksi/data/2026-07-02_req2-seo-priority-log.csv` — 1,231 rows with columns: collection, product_id, title, sales_gbp_30d, demand_searches_mo, organic_sessions_30d, profit_margin (N/A), matched_condition, seo_priority.

## Results
| Priority | Rows | Matched condition |
|---|---|---|
| High | 110 | 3 (demand ≥ 2,000, organic < 50% of demand) |
| Medium | 0 | rules 4 (unreachable) and 5 (no product with demand ≥ 500 has organic ≥ 50% of demand) |
| Low | 435 | 6 |
| Low — flag for review | 686 | 672 via rule 1; 14 with unmapped demand keyword (priority is Low under both possible paths 1/6 — flagged, documented, nothing invented) |
| Pending — missing required data | 0 | none needed (see proof above) |

**Independent re-verification:** rule re-implemented from scratch against the log CSV → **0 mismatches / 1,231 rows**.

## Files created or modified
- Modified: `reports/dilaksi/data/2026-07-02_req2-page-builder.py` (added `seo_priority()`, badge, rule note, log writer)
- Modified: `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` (SEO badge on every row + red-bordered rule note + legend entry + footer update)
- Modified (auto-sync): `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`
- Created: `reports/dilaksi/data/2026-07-02_req2-seo-priority-log.csv`
- Created: the 7 AIOS files of this task

On-page note added (verbatim): *"SEO Priority calculated using approved Dilaksi Requirement 2 business rule. Rule documented in AIOS evidence."*

- **Evidence path:** this file · **Validation result:** PASS (see validation file)
- **Status:** Completed, NOT deployed (deployment approval pending)
- **Known limits:** Profit margin absent (COGS pending) but provably unrequired; Medium tier empty for current data; demand values are Semrush UK snapshots from 2026-07-02.
- **Next step:** Deploy on approval; recompute when COGS/PM becomes available.
- **PASS/FAIL rule:** PASS only if rule applied in exact order, no invented values, evidence saved, HTML validated, AIOS updated. **PASS**
