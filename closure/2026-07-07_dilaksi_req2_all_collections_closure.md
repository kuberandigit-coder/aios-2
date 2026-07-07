# Closure — Dilaksi Req 2: All Collections Scope Expansion

**Title:** Requirement 2 rebuilt for all Shopify collections (was 5)
**Purpose:** Close the scope-expansion task
**Date:** 2026-07-07 · **Requirement source:** GPT planning layer, user-approved · **Requirement number:** 2
**Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
**Scope change:** 5 collections → ALL 475 collections
**Business question:** Which products should be prioritised for SEO across the entire catalog?

## Outcome
Dilaksi Requirement 2 now covers the **entire ledsone.co.uk catalog — 5,179 products across all 475 Shopify collections** (previously 1,231 products / 5 collections). Every row carries Demand (Semrush UK), Organic Sessions (GA4, true last 30 days), Sales/Units (Shopify ShopifyQL), and an SEO Priority badge from the unchanged approved 6-condition rule. Profit Margin remains N/A (COGS not in Postgres) but is proven not required for any row (max sales £1,705.42, well below rule thresholds). **Not deployed — approval pending**, per the rule that deployment requires explicit sign-off.

**SEO Priority totals:** High 313 · Medium 1 · Low 992 · Low — flag for review 3,873.

## Data sources used
Shopify Admin GraphQL Bulk Operations API, ShopifyQL analytics, Semrush `keyword_research`/`phrase_these` (UK, 25 batches, ~24,560 API units approved and spent), GA4 Data API.

## Collections checked
All 475 collections referenced by at least one product (verified via full product-level export, not the raw collection list, which is more reliable and avoids counting 0-product collections).

## Fields collected
Collection(s), product title, product ID, variant ID(s), SKU(s), sales (£), units sold, orders, status, vendor, demand, keyword, organic sessions, SEO Priority, matched rule condition.

## Files created or modified
7 AIOS docs (this set) + 5 builder/data scripts + ~35 intermediate data files under `reports/dilaksi/data/` + 2 HTML pages (`reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html`, `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html`).

**Evidence path:** `evidence/dilaksi/2026-07-07_dilaksi_req2_all_collections_evidence.md`
**Validation result:** PASS (`validation/2026-07-07_dilaksi_req2_all_collections_validation.md`)
**Status:** Completed locally — deploy approval pending
**Known limits:** Profit Margin N/A (proven not required); ~4,940 of 5,179 products use auto-derived (not manually curated) keywords, confidence LOW/MEDIUM/AUTO; user explicitly chose to include catch-all/seasonal/junk collections in scope (no exclusions).
**Next step:** obtain deployment approval; redeploy Vercel; verify live.
**PASS/FAIL rule:** PASS — scope verifiably expanded to all collections, verified source data throughout, SEO Priority rule applied exactly, AIOS complete, zero invented data.
