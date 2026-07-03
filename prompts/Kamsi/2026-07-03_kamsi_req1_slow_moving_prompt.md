# Prompt Copy — Kamsi Requirement 1: Slow-Moving Product Visibility

**Title:** Kamsi Req 1 prompt (as received, condensed) · **Date:** 2026-07-03
**Purpose:** Preserve the requirement prompt for reruns.
**Requirement Source:** Kamsi (Digital Marketing / SEO team), via Kuberan session prompt 2026-07-03.
**Business Question:** Which products have low sales but high current stock and need SEO/product visibility attention?
**Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** Delivered (deploy pending approval)

## The requirement (operative parts, verbatim where it matters)
- Status condition: **If Units Sold (90d) < 10 AND Current Stock > 100 → Slow-Moving, else Active.**
- Columns: SKU, Page URL, Category, Units Sold (90d), Current Stock, Last Order Date, Seasonal Tag, Status.
- Data: Shopify products/inventory/orders primary; PostgreSQL read-only discovery secondary.
- Rules: read-only everywhere; no deploy without approval; no invented business logic or seasonal tags; duplicate check first; Dilaksi design language.
- UI: KPI cards (Total / Slow-Moving / Active / Stock in slow-movers), search, filters (Status, Category, Seasonal), sortable table, CSV export, last-updated stamp, responsive.

## Rerun prompt
```
Rerun Kamsi Requirement 1 (Slow-Moving Product Visibility):
1. Refresh PG aggregates read-only: Shopify-channel units sold + last order date per SKU for the trailing 90 days (public.order_transaction, source_name='SHOPIFY', exclude cancelled), and per-SKU stock summed across warehouses (public.inv_final_stock). Parse the MCP result files with reports/Kamsi/data/2026-07-03_kamsi_req1_parse_pg_results.py.
2. Product catalog: reuse the Shopify-sourced catalog CSV (reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv + handle map) or refresh it via the Shopify connector if stale.
3. Run reports/Kamsi/data/2026-07-03_kamsi_req1_page_builder.py (update GEN/WINDOW dates first).
4. Spot-verify 2 SKUs against the live Shopify Admin (productVariants query) and record the numbers in evidence.
5. Save AIOS files, commit, push origin. Deploy only with Kuberan's approval.
```

**Files Created / Evidence / Validation:** see `evidence/Kamsi/` and `validation/Kamsi/` 2026-07-03 files.
**Known Limitations:** catalog scope = 5 core collections; stock = warehouse total (Shopify sellable is slightly lower); Seasonal Tag = Not Available (no reliable field).
**Next Steps:** deploy on approval; optionally expand catalog to all Shopify products.
**PASS/FAIL:** PASS
