# Prompt Copy — Kamsi Requirement 6: Duplicate Listing & Price Check

**Title:** Verbatim task instruction record
**Purpose:** Preserve the exact requirement instruction for audit
**Requirement Source:** GPT planning layer instruction relayed by Kuberan, 2026-07-08
**Business Question:** Across the full Shopify product catalog, which SKUs appear on more than one product listing URL, and do those duplicated listings have price differences?
**PostgreSQL Sources Checked:** Not used — Shopify is the explicit source of truth per instruction
**External Sources Checked:** None

## Verbatim scope
> All Shopify product listings. Full catalog. Date Range: All. Source of Truth: Shopify only. Do NOT modify Shopify. Do NOT modify PostgreSQL. Do NOT deploy without approval.

## Required logic (summarized, full detail in evidence file)
- Duplicate? = Yes if the same SKU appears on ≥2 rows anywhere in the full catalog (blank/null SKUs excluded from this calculation, counted separately)
- Price Mismatch? = Yes only if Duplicate? = Yes AND not all rows sharing that SKU have the same Current Price
- Compare Price shown for reference, never used to decide mismatch
- One row per variant/listing URL; multi-variant-same-SKU products included as separate rows
- Required columns: SKU, Product Title, Variant Title, Listing URL, Current Price (£), Compare Price (£), Duplicate?, Duplicate Count, Price Mismatch?, Matching Listing URLs, Last Checked
- KPIs: Total Variant Rows Checked, Unique SKUs Checked, Duplicate SKUs, Rows With Duplicate SKU, Price Mismatch SKUs, Blank SKU Rows
- Explicit instruction: **extend existing Kamsi dashboard with a new tab; do not deploy without approval.**

**Status:** Built, validated, **not deployed** (per instruction)
**Owner:** Kamsi · **Reviewer:** Kuberan
**Next Steps:** Kuberan approval to deploy
**PASS / FAIL:** PASS
