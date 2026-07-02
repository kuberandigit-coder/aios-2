# Closure — Requirement 2 Shopify Sales Discovery

**Title:** Shopify discovery closed for Requirement 2 (Category/SKU/Sales)
**Purpose:** Record completion of the discovery-only task.
**Date:** 2026-07-02 · **Requirement Number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.

**Result:** All three Shopify-sourced fields verified with live queries: Category via Admin GraphQL collections (5/5 handles found, 1,230 product memberships), SKU via product variants, Sales (£) + Units via ShopifyQL sales cube (`SINCE -30d`). Join key product_id proven. PostgreSQL has no Shopify sync tables. Correct ShopifyQL column names documented (product_variant_sku, quantity_ordered). No stop conditions triggered — reporting period comes from the requirement itself (Last 30 Days).

**Objects checked:** 5 collections, products/variants sample, ShopifyQL sales (3 test queries), PostgreSQL scans (referenced)
**Collections checked:** wall-light, plugin-lighting, table-lamps, spider-light, pendant-lights
**Files created:** evidence, source-map, prompt, validation, this closure, handover, docs entry
**Evidence path:** evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md
**Validation:** PASS
**Status:** CLOSED (discovery) — extraction awaiting approval
**Known limits:** rolling window; collection overlap; deleted-products sales bucket excluded.
**Next step:** approve full extraction (~25 paginated GraphQL calls + sales pull) → build Requirement 2 Shopify columns.
**PASS/FAIL:** PASS
