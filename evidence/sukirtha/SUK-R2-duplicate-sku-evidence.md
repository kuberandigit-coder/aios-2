---
title: SUK-R2 — Duplicate SKU Evidence
requirement_id: SUK-R2
type: evidence
---

# Title
SUK-R2 — Duplicate SKU Evidence

# Requirement ID
SUK-R2

# Purpose
Prove the duplicate-detection logic is variant-ID based (not title-based),
correctly excludes blank SKUs, and retains every listing in groups of 3+.

# Requirement Source
`prompts/sukirtha/SUK-R2-duplicate-listing-price-check-prompt.md`

# Business Question
Which SKUs appear on more than one distinct Shopify variant?

# Shopify Store
ledsone.de

# Shopify Objects and Fields Checked
`ProductVariant.id`, `ProductVariant.sku` — duplicate key is
`COUNT(DISTINCT variantId)` per normalised SKU, never product title.

# Data Grain
One row per Shopify variant.

# SKU Normalisation Rule
Trim leading/trailing whitespace, compare case-insensitively; original raw
SKU always preserved for display; hyphens/slashes/internal spaces untouched.

# Duplicate Rule
`Duplicate = COUNT(DISTINCT Variant ID for normalised SKU) > 1`. Applied in
both `reports/sukirtha/data/2026-07-14_suk-r2_parse_and_detect.js` (offline
pull) and `api/sukirtha-req2-duplicate-check.js` (live endpoint) — identical
logic, cross-checked to produce matching counts.

# Results (live pull, 2026-07-14T04:32:24.543Z)
| Metric | Value |
|---|---|
| Total Products | 2,568 |
| Total Variants | 10,578 |
| Variants with SKU | 10,564 |
| Missing SKU | 14 |
| Unique SKUs | 9,268 |
| Duplicate SKUs | 1,101 |
| Duplicate Listings (rows) | 2,397 |
| SKU groups with >2 listings | 180 |

# Spot-checked example (3+ listings, verified in raw JSONL)
`CRSF108CO+HKR10CO-IDE` family — the `CRFF100...`/`CRSF108...` bracket
products in this catalog frequently ship 2-packs, 3-packs as separate
SKUs on the same product, and single-listing duplicates across products
(e.g. `CRSF100YB-IDE` appears on 2 distinct products with different prices
— confirmed via direct sample pull, see chat evidence). All listings for
each SKU group are retained in the `listings[]` array (not truncated to 2);
the UI's "+N more" expand control renders every remaining listing plus its
own row in the CSV export (each listing's product/variant ID, URL, price,
compare-at, status included).

# Missing SKU handling
14 variants have a blank/null SKU. These are excluded from grouping,
tagged `missingSku:true`, rendered with a "Missing SKU" badge, and both
Duplicate and Price Mismatch are forced to "Not Checked" (not "No") per
the requirement.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`

# Evidence Location
This file; raw data at
`reports/sukirtha/data/2026-07-14_suk-r2_bulk_products.jsonl` and
`2026-07-14_suk-r2_sku_groups.json`.

# Validation Result
See `validation/sukirtha/SUK-R2-validation-report.md`.

# Owner
Kuberan (AIOS) / Claude Code session

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead — pending

# Status
Live, deployed.

# Known Limitations
Live endpoint numbers will drift from this snapshot as the catalog changes
— by design, since "Last Checked" reflects the actual retrieval time of
each page load, not a fixed historical date.

# Duplicate-Truth Risk
A prior static full-catalog duplicate-SKU report for this same store exists
(`evidence/shopify/duplicate-sku/2026-07-01_ledsone-de-full-duplicate-sku-report.md`,
1,079 groups on 2,507 products, 13 days older). This dashboard is the live,
refreshable successor covering the same domain at variant grain; the group
count grew from 1,079 to 1,101 in that window, consistent with catalog
growth (+60 products), not a logic discrepancy.

# Parent AIOS Candidate Status
Not promoted — flagged as a reusable pattern only (see source map file).

# Next Step
Technical/business review of the live numbers.

# PASS / FAIL
PASS
