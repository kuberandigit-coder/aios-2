# Validation — Requirement 2 Shopify Sales Discovery

**Title:** Validation of Shopify discovery for Category/SKU/Sales
**Purpose:** Confirm discovery met the brief without guessing.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

| Check | Result |
|---|---|
| Shopify connection working (ledsone.co.uk) | PASS — collections + sales queries returned live data |
| AIOS searched for existing Shopify sales reports | PASS — Ripsan report found (different scope); no duplicate |
| All 5 collections resolved with GIDs + product counts | PASS — 230/35/28/58/879 |
| SKU source verified | PASS — variants.sku returned in sample (ENC4449 etc.) |
| Sales (£) source verified with live test query | PASS — ShopifyQL FROM sales, 10 rows returned, £ values |
| Column names discovered, not assumed | PASS — two failed guesses documented; correct names recorded |
| Join key proven | PASS — product 8015418720506 in both collection + sales data |
| Reporting period | PASS — "Last 30 Days" from requirement text (SINCE -30d), not invented |
| PostgreSQL synced tables checked | PASS — none exist (prior evidence referenced) |
| No data changed; no report built | PASS — discovery only |

**Objects checked / Collections checked / Files created:** see evidence
**Validation:** PASS
**Status:** VALIDATED
**Known limits:** full extraction (row-level, ~25 pages) intentionally not run.
**Next step:** approve extraction run.
**PASS/FAIL:** **PASS**
