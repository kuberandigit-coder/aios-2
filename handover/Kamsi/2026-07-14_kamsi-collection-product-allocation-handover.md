---
title: Kamsi Collection Product Allocation — Handover
requirement_id: SUK-KAMSI-ALLOC-1
type: handover
---

# Title
Kamsi Collection Product Allocation — Handover

# Requirement ID
SUK-KAMSI-ALLOC-1

# Purpose
Continuation context for any future session picking up Kamsi's
collection-based sales-attribution product allocation.

# Business Question
Which Shopify products belong to Kamsi's 29 assigned ledsone.co.uk
collections, deduplicated by Product ID, ready for future sales
attribution via Variant ID?

# Staff
Kamsi — SEO — ledsone.co.uk — ownership via 29 Shopify collections.

# Knowledge Source
`ledsone-aios-knowledge-base` (checked first; no prior Kamsi
collection-allocation asset existed).

# Primary Business Data Source
`ledsone-db-mcp` → `listings.shopify_collections` →
`listings.shopify_collection_products` → `listings.shopify_listings`
(parent) → `listings.shopify_listings_parent_child_mapping` →
`listings.shopify_listings` (child, `all_list=1`). `sub_source = 104`
filter enforced at every step = ledsone.co.uk.

# Fallback Source
LEDSone.co.uk Shopify Admin GraphQL API — **not used**. All 29
collections and 725 product memberships resolved fully from the
database. Only gap: Variant ID/GID, which the database does not store
at all (see below) — **no ledsone.co.uk Shopify credentials exist in
this AIOS session** to fill that gap live.

# Ownership Key
Shopify Product ID (`shopify_product_id`).

# Future Sales Join Key
Shopify Variant ID — **not yet available**. Recorded as
`MISSING_FROM_DB` in both output files.

# Product Deduplication
Shopify Product ID — verified 725 rows, 725 unique IDs, 0 duplicates.

# Multiple Collection Membership
Preserved — 141 of 725 products belong to 2+ of the 29 collections;
counted once in the allocation file, every membership retained in the
relationship file and in the allocation file's pipe-separated
`collection_handles` column.

# Database Schemas Checked
`accounting, amazon_campaigns, business_reports, customer_service,
customers, google_ads, google_analytics, google_search_console,
inventory, listings, order_management, public, reports, staff,
suppliers` (via `search_objects`). Note: the task prompt's example
schema list — `staging_ai`, `development`, `daily_task`, `shopify` —
does not match the real database; those schemas do not exist.

# Tables and Views Checked
`listings.shopify_collections`, `listings.shopify_collection_products`,
`listings.shopify_listings`, `listings.shopify_listings_parent_child_mapping`,
`order_management.sub_source`.

# Selected Source
`listings.shopify_collections` JOIN `listings.shopify_collection_products`
JOIN `listings.shopify_listings` (parent) JOIN
`listings.shopify_listings_parent_child_mapping` JOIN
`listings.shopify_listings` (child) — the exact verified join chain
documented in
`database/postgresql/schemas/listings/shopify-collections-relationships.md`.

# Source Freshness
Collections: 2026-07-06 to 2026-07-13. Listings: up to 2026-07-14.

# Files Created
`reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv` (725 rows),
`reports/Kamsi/data/2026-07-14_kamsi-product-collection-relationships.csv` (932 rows),
`evidence/Kamsi/2026-07-14_kamsi-collection-product-allocation-source-map-and-db-discovery.md`,
`evidence/Kamsi/2026-07-14_kamsi-29-collection-resolution-table.md`,
`validation/Kamsi/2026-07-14_kamsi-collection-product-allocation-validation-report.md`,
this handover file.

# Files Updated
None — all new files, no existing Kamsi asset was modified or
duplicated. **`sale.html` does not exist in this repository and was
not created or touched.**

# Validation
PASS on all checklist items except Variant ID/GID enrichment (documented
data gap, not a defect) — see the validation report for the full table.

# Security
Read-only access throughout — zero Shopify mutations, zero database
writes. No database password, Shopify token, or API secret was stored
in any output file (verified by grep scan before committing).

# Data Quality Finding
Found and documented that `listings.shopify_collection_products`
currently contains duplicate `(collection_id, product_id)` pairs with
distinct row `id`s — contradicts the knowledge base's "duplicate-free
as of 2026-07-09" note. Deduplicated correctly in this extraction via
`SELECT DISTINCT` on the pair, not just `id`. Flagged for the sync-job
owner.

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Complete. Git not yet committed — pending user instruction (this task's
instructions permit a local commit consistent with project rules; no
push without explicit approval).

# PASS / FAIL
PASS

# Next Step
1. If the user wants this committed: stage only
   `reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv`,
   `reports/Kamsi/data/2026-07-14_kamsi-product-collection-relationships.csv`,
   and the 3 new `evidence/`/`validation/`/`handover/` files — confirm
   `sale.html` is not in the diff before committing.
2. To close the Variant ID gap: get a ledsone.co.uk Shopify custom-app
   read-only token (same method as SUK-R2/R3/R4 for ledsone.de) and run
   the documented `collectionByHandle` GraphQL query per handle to
   backfill `shopify_variant_id`/`shopify_variant_gid` into both CSVs.
3. `sale.html` future dashboard can then join
   `kamsi-product-allocation.csv` → `shopify_variant_id` → Shopify order
   line items to compute Kamsi's individual net sales, per the task's
   documented attribution chain — not calculated in this task, by
   design.
