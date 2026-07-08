# Validation — Mahima Requirement 1: Product-Level Correction

**Title:** Validation checklist for the product-level report update
**Purpose:** Confirm all PASS criteria are met
**Requirement Source:** GPT planning layer instruction, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan
**PostgreSQL Sources Checked:** Yes, read-only

| Check | Result |
|---|---|
| mahima.html clearly shows product-level report | PASS — "Table grain: one row per product within each campaign" banner added above KPI cards |
| One row equals one product within one campaign | PASS — confirmed 680 rows = sum of distinct-product-per-campaign counts (72+114+30+464) |
| Product column is visible | PASS — new "Product" column (title where matched, else Data Missing) |
| Product ID is visible if source has it | PASS — new "Product ID" column (`google_item_id`) |
| Multiple products can appear under the same campaign | PASS — verified per-campaign distinct product counts (72/114/30/464), all >1 |
| Data source and stale date are visible | PASS — header, chip, and new "Data Freshness Date" KPI card all show 2026-06-11 |
| Missing data is marked Data Missing | PASS — Product Cost, Gross Profit, Profit After Ads, Feed Status, Missing Attribute, Last 7/30 Days ROAS all show styled "Data Missing", not blank or invented |
| AIOS files are updated | PASS — prompts/evidence/validation/handover/vercel all created this pass |
| Evidence proves PostgreSQL read-only inspection | PASS — exact SQL queries and results quoted in evidence file |
| Report is campaign-level only | **FAIL condition avoided** — confirmed genuinely product-level, not aggregated |
| Product cost/feed data invented | **FAIL condition avoided** — confirmed no invention; new Product Title/Price only added via a verified, fan-out-free join, with honest partial coverage disclosed |
| Source date hidden | **FAIL condition avoided** — shown in 3 places on the page |
| AIOS evidence missing | **FAIL condition avoided** — all 6 folders updated |
| PostgreSQL inspection skipped | **FAIL condition avoided** — full read-only inspection performed and documented |

## Additional verification performed
- Div balance: 37 open / 37 close
- `node --check` JS syntax validation: passed, exit 0
- Row count cross-check: `const ROWS` embedded array = 680, matches Postgres query result exactly
- Product Title/Price match rate cross-check: 127 of 680 rows (18.7%), consistent between the raw query result and the rendered page
- Confirmed zero fan-out in the Product Title/Price join (`count(*) > 1` per product_id under the country='DE' filter returns 0 rows)

**Validation result:** PASS on all listed criteria.
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — not yet deployed
**Known Limitations:** see evidence file
**Next Steps:** Kuberan review + deployment approval
**PASS / FAIL:** PASS
