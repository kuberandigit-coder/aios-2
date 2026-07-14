---
title: Kamsi Collection Product Allocation — Validation Report
requirement_id: SUK-KAMSI-ALLOC-1
type: validation
---

# Title
Kamsi Collection Product Allocation — Validation Report

# Requirement ID
SUK-KAMSI-ALLOC-1

# Purpose
Validate the Kamsi collection-based product allocation against the
task's required checklist.

# Business Question
Which Shopify products belong to Kamsi's 29 assigned ledsone.co.uk
collections, deduplicated by Product ID, with Variant IDs preserved for
future sales attribution?

# GA4 Property
n/a — this task does not use GA4.

# GSC Property
n/a — this task does not use GSC.

# Collection Validation

| Check | Result |
|---|---|
| 29 supplied URLs processed | PASS — all 29, see `evidence/Kamsi/2026-07-14_kamsi-29-collection-resolution-table.md` |
| No URL silently skipped | PASS — 29/29 accounted for with explicit status |
| Handles extracted correctly | PASS — exact `/collections/{handle}` extraction, verified against DB `handle` column |
| Domain is ledsone.co.uk | PASS — all queries filtered `sub_source = 104`, verified as `ledsone.co.uk` via `google_search_console.relationships.md` cross-reference |
| Database source freshness checked | PASS — `shopify_collections.updated_at` 2026-07-06 to 2026-07-13; `shopify_listings.updated_at` up to 2026-07-14 |
| Shopify fallback documented where used | PASS (n/a — not used; documented why in source-map evidence) |
| Redirects recorded | PASS — 0 redirects found |
| Handle mismatches recorded | PASS — 0; all 29 handles matched exactly |
| Empty collections recorded | PASS — 0 empty collections |
| Unresolved collections recorded | PASS — 0 unresolved |
| Pagination completed | PASS (n/a for DB path — SQL returns full result sets, no pagination needed; would apply only to the unused Shopify API fallback) |

# Product Validation

| Check | Result |
|---|---|
| Product IDs are present | PASS — 725/725 rows have `shopify_product_id` |
| Variant IDs are present where variants exist | **FAIL (documented gap)** — `listings.shopify_listings` has no Variant ID/GID column; recorded as `MISSING_FROM_DB` in both CSVs, not fabricated. See source-map evidence, Phase 5. |
| Main allocation deduplicated by Product ID | PASS — verified programmatically: 725 rows, 725 unique `shopify_product_id` values, 0 duplicates |
| Multiple collection memberships retained | PASS — 141 products span 2+ collections; `collection_count`/`collection_handles` columns list all memberships, pipe-separated |
| Product status recorded | PASS — ACTIVE (714), DRAFT (10), ARCHIVED (0); 1 row has no status (product not found in `shopify_listings` at all) |
| Product URL recorded | PASS where handle available; blank where `shopify_handle` is null in source data (not fabricated) |
| Store/domain validated | PASS — `sub_source = 104` enforced at every join |
| Missing SKUs identified | PASS — 0 variants without a SKU found (2,710/2,710 variants have a SKU) |
| Duplicate SKU groups identified | PASS — 295 SKU values appear on more than one variant row across the allocation; examples recorded in source-map evidence |
| No SKU-only ownership matching | PASS — ownership determined solely by `shopify_collection_products.product_id`, never by SKU |
| No duplicate Product IDs in the main allocation | PASS — see dedup check above |

# Relationship Validation

| Check | Result |
|---|---|
| Raw product-to-collection membership rows >= unique Kamsi product rows | PASS — 932 >= 725 |
| Every unique product in the allocation file has >=1 collection relationship | PASS — relationship file built from the same source map used to build the allocation file; by construction every allocation row has >=1 relationship row |
| Every relationship uses one of the supplied 29 collections | PASS — all 932 relationship rows reference one of the 29 supplied handles, 0 canonical replacements needed |
| All records belong to ledsone.co.uk | PASS — `sub_source = 104` enforced throughout |

# Data Quality Finding (new, not previously documented)
`listings.shopify_collection_products` is documented in the knowledge
base as duplicate-free as of 2026-07-09 (deduped on `id`). This
extraction found genuine duplicate `(collection_id, product_id)` pairs
with distinct `id` values now present (e.g. `2core-round`: 140 raw rows
for 28 distinct products). Handled by `SELECT DISTINCT` on
`(collection_handle, collection_id, product_id)` before building either
output file — verified the 932 relationship rows are true distinct
pairs. Recommend flagging to whoever owns the `listings:transfer` sync
job.

# Files Modified
None outside `reports/Kamsi/`, `evidence/Kamsi/`, `validation/Kamsi/`,
`handover/Kamsi/`. **`sale.html` was not touched — confirmed via
`find`, it does not exist anywhere in this repository.** No other staff
page was modified.

# Evidence
`evidence/Kamsi/2026-07-14_kamsi-collection-product-allocation-source-map-and-db-discovery.md`,
`evidence/Kamsi/2026-07-14_kamsi-29-collection-resolution-table.md`

# Validation Result
PASS on all checks except one documented, unavoidable data gap (Variant
ID/GID not stored anywhere in the current database for active
listings) — not a defect in this extraction, a genuine source-data
limitation requiring live Shopify API access this session does not
have credentials for.

# Owner
Kuberan (AIOS) / Claude Code session

# Reviewer
Kamsi / SEO Lead — pending

# Status
Complete, PASS with one documented open item (Variant ID enrichment).

# PASS / FAIL
PASS

# Next Step
Obtain a ledsone.co.uk Shopify Admin API custom-app token (read-only,
`read_products` scope minimum) to run the documented GraphQL fallback
query and backfill `shopify_variant_id`/`shopify_variant_gid` for all
725 products, following the same custom-app + local OAuth-script method
already proven for ledsone.de in SUK-R2/R3/R4.
