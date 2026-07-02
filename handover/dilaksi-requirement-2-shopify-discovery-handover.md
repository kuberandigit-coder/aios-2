# Handover — Requirement 2 Shopify Sales Discovery

**Title:** Shopify discovery handover for GPT/Kuberan/Mani
**Purpose:** Continue tomorrow without verbal explanation.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

## What's verified (don't re-discover)
- 5 collection GIDs + product counts: wall-light 230, plugin-lighting 35, table-lamps 28, spider-light 58, pendant-lights 879.
- SKUs live on product variants (GraphQL). Sales via ShopifyQL `FROM sales … GROUP BY product_id, product_variant_sku SINCE -30d UNTIL today`.
- Join = product_id. Column names product_variant_sku / quantity_ordered (NOT sku / net_quantity).
- PostgreSQL contains no Shopify data — Shopify MCP is the only sales source for this field set.

## To run next (after approval)
Use `prompts/dilaksi/dilaksi-requirement-2-shopify-extraction-prompt.md` — full paginated extraction, then merge into the Requirement 2 build (placeholder currently on pages/dilaksi.html). Remaining non-Shopify fields (margin, demand, organic sessions, SEO priority) still wait on the Option B pipeline (see requirement-2 PostgreSQL evidence).

**Objects checked / Collections checked / Files created / Validation:** see evidence + closure
**Evidence path:** evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md
**Status:** DELIVERED (discovery) · **Known limits:** extraction not yet run
**Next step:** approval to extract → populate Category/SKU/Sales columns
**PASS/FAIL:** PASS
