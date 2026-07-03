# Handover — Kamsi Requirement 1: Slow-Moving Product Visibility

**Title:** Kamsi Req 1 handover · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** Delivered, deploy pending approval
**Purpose:** Let any future session continue without re-discovery.
**Requirement Source:** Kamsi via Kuberan session prompt 2026-07-03. **Business Question:** low sales + high stock → SEO attention list.

## What exists now
- Report page (both copies): `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` + `reports/Kamsi/kamsi-requirement-1-slow-moving-products.html`
- Builder (single source of truth): `reports/Kamsi/data/2026-07-03_kamsi_req1_page_builder.py` — rerun to regenerate.
- Data: `2026-07-03_kamsi_req1_shopify_orders_90d.csv` (PG SHOPIFY channel, 90d), `2026-07-03_kamsi_req1_stock_by_sku.csv` (PG warehouses summed), `2026-07-03_kamsi_req1_handle_map.csv` (1,182 products→handles), parse script for PG MCP result files.
- Member page `pages/kamsi.html` links R1.

## Key numbers (2026-07-03)
4,793 active products · 1,388 Slow-Moving · 3,405 Active · 418,658 units stock in slow-movers · 313 SKUs unknown stock ("—", never Slow-Moving).

## Data pipeline (all read-only)
1. Catalog: reused Dilaksi Req2 Shopify export (5 core collections). Full-store expansion = refetch catalog via Shopify connector.
2. PG MCP `execute_sql` → results auto-saved to tool-result files → parsed by `2026-07-03_kamsi_req1_parse_pg_results.py` (handles python-repr incl. datetime.date/Decimal).
3. Seasonal: none reliable (promo tags rejected) → "Not Available".
4. Verification: PG stock vs live Shopify sellable spot-checked (656/613, 154/121).

## Not done / decisions awaiting Kuberan
- **Deploy** (rule: no deploy without approval). Deploy = `cd reports/digital-marketing-member-pages && vercel deploy --prod --yes`, then verify live; also subtree-push to shared Staff-requirements repo. Vercel git integration is DISCONNECTED (hung builds 2026-07-03) — CLI deploy is the working path.
- Full-store catalog scope (currently 5 core collections).
- All-channel sales variant (currently Shopify channel per requirement).

**Known Limitations:** see validation. **Evidence:** `evidence/Kamsi/2026-07-03_...` **Validation:** `validation/Kamsi/2026-07-03_...`
**Next Steps:** approval → deploy → live verify → update index.html Kamsi card if Kuberan wants R1 surfaced there.
**PASS/FAIL:** PASS
