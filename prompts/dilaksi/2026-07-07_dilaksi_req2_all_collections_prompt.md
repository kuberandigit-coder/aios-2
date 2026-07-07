# Prompt — Dilaksi Req 2: Expand Scope to All Collections

**Title:** Change Dilaksi Requirement 2 scope from 5 collections to ALL Shopify collections
**Purpose:** Give SEO team full-catalog product priority visibility instead of a 5-collection subset
**Date:** 2026-07-07 · **Requirement source:** GPT planning layer, user-approved · **Requirement number:** 2
**Team member:** Dilaksi · **Team:** SEO
**Scope change:** 5 collections (pendant-lights, wall-light, spider-light, plugin-lighting, table-lamps) → ALL {475} real Shopify collections (user explicitly chose "literally everything", no exclusions)
**Business question:** Across all Shopify collections, which products should be prioritised for SEO based on sales, demand, organic sessions, profit margin (if available), and the SEO Priority rule?

## Original instruction (verbatim summary)
Search existing AIOS files for the 5-collection Req 2 implementation; confirm current scope; expand to all Shopify collections; retrieve all products/variants (collection, title, product ID, variant ID, SKU, sales, units); map Semrush demand per product; pull GA4 organic sessions per product landing page; apply the approved 6-condition SEO Priority rule; update `dilaksi-req2-all-products.html` and create `dilaksi-req2-all-collections-product-priority.html`; save AIOS docs; do not deploy without approval; do not invent missing values (Profit Margin stays N/A, documented).

## Data sources used
- Shopify Admin GraphQL (collections enumeration + Bulk Operations API full product/variant/collection export)
- Shopify ShopifyQL analytics (`FROM sales SHOW net_sales, net_items_sold, orders GROUP BY product_id, product_variant_id`)
- Semrush `keyword_research` toolkit, `phrase_these` report, UK database
- GA4 Data API (property 408110563), Organic Search channel, true last 30 days

**PASS/FAIL rule:** PASS only if scope is verifiably expanded from 5 to all real collections, verified source data is used throughout, the SEO Priority rule is applied exactly, AIOS files are complete, and no fake/invented data is used.
