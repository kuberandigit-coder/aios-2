# Validation — Kamsi Requirement 1: Slow-Moving Product Visibility

**Title:** Kamsi Req 1 validation · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan
**Purpose:** Confirm every requirement checkpoint. **Requirement Source:** Kamsi via Kuberan prompt 2026-07-03.
**Business Question:** Which products have low sales but high current stock and need SEO/product visibility attention?

| Check | Result |
|---|---|
| Existing assets searched (all 6 AIOS folder sets + member pages + grep) | PASS |
| Duplicate risk documented (none; decision Create New + Reuse catalog + Extend placeholder) | PASS |
| PostgreSQL inspected read-only only (information_schema scan, get_object_details, SELECT-only) | PASS |
| Shopify accessed read-only only (graphql_query; zero mutations) | PASS |
| Units Sold (90d) = SUM(quantity), source SHOPIFY, cancelled excluded, window 2026-04-04→2026-07-03, per SKU | PASS (3,855 SKUs with sales; sample WSSS70CO=5, 12ASIP20100=19) |
| Current Stock field confirmed (inv_final_stock summed across warehouses; cross-checked vs live Shopify: 656/613, 154/121) | PASS (definition documented on page) |
| Status condition applied verbatim (<10 AND >100 → Slow-Moving; unknown stock never Slow-Moving) | PASS (1,388 slow / 3,405 active of 4,793) |
| No invented seasonal tags (tags inspected live; promo tags rejected; "Not Available" used) | PASS |
| HTML table renders (4,793 rows, fixed-layout, Dilaksi design language) | PASS |
| Search works (SKU + URL/title fields; static check id="q" + flt()) | PASS |
| Filters work (Status / Category / Seasonal Tag selects + reset + live counter) | PASS |
| Sorting works (all 8 columns, numeric-aware for Units/Stock) | PASS |
| CSV export works (exports visible/filtered rows; JS syntax validated with node --check) | PASS |
| Last-updated timestamp + mobile responsive @media styles present | PASS |
| AIOS files saved (prompt/evidence/validation/report/handover/vercel in Kamsi folders) | PASS |
| No deployment performed (page exists locally + in repo only) | PASS |

**Files Created:** see evidence file. **Evidence Location:** `evidence/Kamsi/2026-07-03_kamsi_req1_slow_moving_evidence.md`
**PostgreSQL Sources Checked / External Sources Checked:** see evidence Step 2/3.
**Known Limitations:** 5-collection catalog scope; warehouse stock vs Shopify sellable delta; Shopify-channel sales only; Seasonal Tag not available.
**Next Steps:** Kuberan approval → deploy → live verification.
**Status:** Complete (undeployed) · **PASS/FAIL: PASS**
