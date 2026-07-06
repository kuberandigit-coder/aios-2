# Validation — Kamsi Req 1: Shopify-Only Source Migration (2026-07-06)
- **Title:** Validation checklist for Shopify-only rebuild
- **Purpose:** PASS/FAIL each required check from the 2026-07-06 requirement
- **Requirement Source:** Kamsi (via Kuberan, 2026-07-06) · **Owner:** Kamsi · **Reviewer:** Kuberan
- **PostgreSQL Sources Checked:** reference only (unmodified) · **External Sources Checked:** Shopify Admin API bulk ops
- **Status:** Done, deploy pending approval

| # | Check | Result |
|---|---|---|
| 1 | Existing Kamsi Req 1 report found (reports/Kamsi/kamsi-requirement-1-slow-moving-products.html + dashboard page + builder) | PASS |
| 2 | Duplicate risk — extended existing report/builder pattern, no duplicate report created | PASS |
| 3 | PostgreSQL no longer final source for the 3 fields (builder reads only Shopify-derived files) | PASS |
| 4 | Units Sold (90d) from Shopify order line items | PASS |
| 5 | Current Stock from Shopify inventoryQuantity (sellable/available) | PASS |
| 6 | Last Order Date from latest non-cancelled Shopify order | PASS |
| 7 | Cancelled orders excluded (4 cancelled orders / 4 line items dropped; verified in aggregate script output) | PASS |
| 8 | 90-day range correct (order createdAt range in export: 2026-04-06→2026-07-05 UTC; query created_at>=2026-04-07 shop-time) | PASS |
| 9 | Status rule applied: <10 sold AND stock >100 → Slow-Moving (4,351), else Active (9,515) | PASS |
| 10 | HTML search works (SKU/URL/title, unchanged logic, data format identical) | PASS |
| 11 | Filters work (Status, Category dropdowns regenerate from new data) | PASS |
| 12 | Sorting works (numeric + text sort unchanged) | PASS |
| 13 | CSV export works (same columns, new filename date) | PASS |
| 14 | Evidence note on page: "Units Sold (90d), Current Stock, and Last Order Date are sourced from Shopify." | PASS |
| 15 | AIOS files saved (prompt, evidence, validation, handover, vercel note) | PASS |
| 16 | No deployment performed; Shopify & PostgreSQL unmodified (read-only ops only) | PASS |

Spot check: SKU 12ASIP20100 — Shopify stock 121 (matches 2026-07-03 manual Shopify Admin cross-check), units 17, last order 2026-06-25.

- **Files Created:** see prompt file · **Evidence Location:** evidence/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_evidence.md
- **Known Limitations:** Seasonal Tag column stays removed per Kuberan 2026-07-03 (conflicts with new prompt's column list — flagged). UI checks 10–13 validated by code identity with the previously browser-verified 2026-07-03 build (only embedded data values changed).
- **Next Steps:** Kuberan review → deploy on approval.
- **Overall: PASS**
