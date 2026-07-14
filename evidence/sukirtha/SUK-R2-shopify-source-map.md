---
title: SUK-R2 — Shopify Source Map
requirement_id: SUK-R2
type: evidence
---

# Title
SUK-R2 — Shopify Source Map

# Requirement ID
SUK-R2

# Purpose
Document exactly which Shopify objects, fields, and API mechanisms this
requirement reads from, and confirm no other data source was used.

# Requirement Source
`prompts/sukirtha/SUK-R2-duplicate-listing-price-check-prompt.md`

# Business Question
Which ledsone.de variants share a SKU across multiple listings, and do
those listings have different prices?

# Shopify Store
ledsone.de (ledsone-de.myshopify.com), confirmed via `get-shop-info`
(domain `ledsone.de`, currency EUR, country Germany) before any query ran.

# Shopify Objects and Fields Checked
- `Product`: `id`, `title`, `handle`, `status`, `updatedAt`
- `ProductVariant`: `id`, `title`, `sku`, `price`, `compareAtPrice`,
  `updatedAt`
- `shop.myshopifyDomain` — used only to resolve the Admin API host for the
  live serverless endpoint.

# Data Grain
One record per Shopify `ProductVariant` (a "listing" = one variant on one
product; a product with N variants contributes N rows, each carrying that
product's `/products/{handle}` URL).

# Two retrieval paths (both read-only, both used)
1. **Discovery/one-off pull** (this session): Admin GraphQL
   `bulkOperationRunQuery` — a single async read query, not a mutation of
   store data. Output: `reports/sukirtha/data/2026-07-14_suk-r2_bulk_products.jsonl`
   (13,146 JSONL records: 2,568 products + variant edges), processed by
   `reports/sukirtha/data/2026-07-14_suk-r2_parse_and_detect.js`.
2. **Live production path** (what the dashboard actually calls on every
   page load): `reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`
   — a Vercel serverless function that paginates
   `products(first:100){variants(first:100){...}}` directly against
   `https://ledsone-de.myshopify.com/admin/api/2024-10/graphql.json` using
   a Shopify Admin access token read from `process.env.SHOPIFY_ADMIN_TOKEN`
   (server-side only — never in HTML or client JS). Both paths produced
   identical summary counts when cross-checked (see validation report).

# No mutation performed
Every call used is a read (`products`, `shop`, `currentBulkOperation`, or
the bulk query result itself). No `productUpdate`, `productVariantUpdate`,
inventory, or any other write mutation was called at any point.

# Files Modified
- `reports/digital-marketing-member-pages/pages/sukirtha.html` (Requirement
  2 tab added)
- `reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`
  (new)
- `reports/sukirtha/data/2026-07-14_suk-r2_bulk_products.jsonl`,
  `2026-07-14_suk-r2_parse_and_detect.js`,
  `2026-07-14_suk-r2_variant_rows.json`,
  `2026-07-14_suk-r2_sku_groups.json` (new, discovery/backing data)

# Evidence Location
This file, plus `SUK-R2-duplicate-sku-evidence.md`,
`SUK-R2-price-mismatch-summary.md`, `SUK-R2-data-quality-summary.md`.

# Owner
Kuberan (AIOS) / Claude Code session, on behalf of Sukirtha.

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending review

# Queryability Reviewer
Tamil Selvan — pending review

# Business Validator
SEO Lead — pending review

# Status
Live, deployed.

# Known Limitations
1. Live endpoint paginates 100 products/page with nested 100 variants/page
   — if any single product ever exceeds 100 variants, later variants on
   that product would be silently missed. No current ledsone.de product
   approaches that count (largest sampled had 10 variants).
2. Serverless function has Vercel's execution time limit; a ~2,600-product
   paginated pull completes in a few seconds today, but as the catalog
   grows this should be monitored.

# Duplicate-Truth Risk
See `SUK-R2-data-quality-summary.md` — a prior static report
(`evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md`)
covered the same store; this dashboard supersedes it with a live,
refreshable, variant-grain view.

# Parent AIOS Candidate Status
Not promoted. The duplicate-SKU + price-mismatch detection method mirrors
Kamsi Requirement 6 (built for `ledsone.co.uk`) — flagged as reusable
pattern only, not merged into a shared Parent AIOS asset.

# Next Step
Kuberan/Sajeesan technical review of the live endpoint and numbers.

# PASS / FAIL
PASS
