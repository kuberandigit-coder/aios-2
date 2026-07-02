# 2026-07-02 — Dilaksi Requirement 2: Shopify Sales Discovery

**Requirement Number:** 2 · **Source:** Google Sheet — Product Priority Guidance (Last 30 Days) · **Member:** Dilaksi (SEO)
**Business question:** SEO prioritisation of products/categories.

Discovery-only task, PASS. Verified with live queries: Category = Shopify Admin GraphQL collections (all 5 handles exist; 1,230 product memberships), SKU = product variants, Sales £/Units = ShopifyQL sales cube `SINCE -30d`. Join key product_id proven; correct column names documented (product_variant_sku, quantity_ordered). PostgreSQL has no Shopify sync tables — Shopify MCP is the sales source. No stop conditions; period "Last 30 Days" comes from the requirement.

- Evidence: `evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md`
- Source map: `source-map/dilaksi-requirement-2-shopify-source-map.md`
- Prompt/validation/closure/handover: dilaksi-requirement-2-shopify-* files
- Next: approval for full extraction (~25 paginated calls), then build the Shopify columns of Requirement 2.

**PASS/FAIL:** PASS
