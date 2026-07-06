# Prompt — Kamsi Req 1 Update: Shopify-Only Data Sources
- **Title:** Kamsi Requirement 1 — migrate Units Sold (90d), Current Stock, Last Order Date to Shopify-only sources
- **Purpose:** Reusable prompt for re-running the Shopify-only version of the slow-moving report
- **Requirement Source:** Kamsi (via Kuberan, GPT-structured prompt, 2026-07-06)
- **Business Question:** Which products have low sales but high current stock — using Shopify as the single source of truth?
- **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** Done (not deployed) · **PASS**

## Verbatim requirement (2026-07-06)
Change the data gathering source for 3 fields to Shopify only:
1. Units Sold (90d) — Shopify order line items, last 90 days, cancelled orders excluded.
2. Current Stock — Shopify sellable/available inventory per SKU (no PostgreSQL warehouse stock).
3. Last Order Date — latest non-cancelled Shopify order date per SKU.
PostgreSQL read-only for reference/evidence only. Do not modify Shopify or PostgreSQL. Do not deploy without approval.
Rule: Units Sold (90d) < 10 AND Current Stock > 100 → Slow-Moving, else Active.

## Rerun steps
1. Shopify bulk op 1: products + variants (id, sku, inventoryQuantity, status, handle, productType).
2. Shopify bulk op 2: orders `created_at:>=<today-90d>` with createdAt, cancelledAt, lineItems(sku, quantity).
3. Download both JSONL to `reports/Kamsi/data/`, run `<date>_kamsi_req1_shopify_aggregate.py`, then `<date>_kamsi_req1_page_builder.py`.

## Files
- Data/scripts: `reports/Kamsi/data/2026-07-06_kamsi_req1_*`
- Report: `reports/Kamsi/kamsi-requirement-1-slow-moving-products.html` + dashboard copy `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- Evidence: `evidence/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_evidence.md`
- Validation: `validation/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_validation.md`

## Known Limitations / Next Steps
- Seasonal Tag column stays removed per Kuberan's 2026-07-03 instruction (new prompt lists it — flagged for Kuberan's decision).
- Deploy pending Kuberan approval.
