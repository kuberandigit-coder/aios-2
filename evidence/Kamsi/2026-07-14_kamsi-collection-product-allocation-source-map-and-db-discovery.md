---
title: Kamsi Collection Product Allocation — Source Map & Database Discovery
requirement_id: SUK-KAMSI-ALLOC-1
type: evidence
---

# Title
Kamsi Collection Product Allocation — Source Map & Database Discovery Evidence

# Requirement ID
SUK-KAMSI-ALLOC-1 (no prior requirement ID existed for this task — new)

# Purpose
Discover every Shopify product assigned to Kamsi through her 29 assigned
ledsone.co.uk collection URLs, using the approved AIOS knowledge base
and PostgreSQL database as primary sources, and produce an
authoritative, deduplicated product allocation for future sales
attribution.

# Business Question
Which Shopify products (by Shopify Product ID) belong to Kamsi's 29
assigned ledsone.co.uk collections, and what are their variant/SKU
details for future sales-attribution joins?

# Staff
Kamsi — Department: SEO — Store: ledsone.co.uk — Ownership Method:
Shopify collection membership.

## Phase 1 — AIOS Knowledge Base Discovery

Checked `ledsone-aios-knowledge-base` first, per task priority order.

- `search_files("Kamsi")` → **no results**. No existing Kamsi
  requirement, dataset, collection mapping, or source map exists in the
  knowledge base for this specific task (Kamsi's existing
  `reports/Kamsi/*.html` requirements 1–5 are unrelated: slow-moving
  products, low-CTR pages, GA4/SEO, product-priority guidance, missing
  meta — none is a collection-based product allocation).
- Read `database/postgresql/schemas/listings/README.md`,
  `shopify_collections.md`, `shopify_collection_products.md`,
  `shopify_listings.md`, `shopify_listings_parent_child_mapping.md`,
  and the full join guide
  `database/postgresql/schemas/listings/shopify-collections-relationships.md`
  — this is the existing, verified, reusable join chain and was reused
  exactly as documented (see Phase 2).
- Read `CONTEXT.md` — confirmed `ledsone.co.uk` = "LEDSone UK, Main UK
  website".
- Searched for `variant_id` — found only in `order_management.order_item_info`
  (`variant_id`, populated per-order-line, not per-listing) and
  `google_ads.ad_group_products`. **No table stores a persistent
  Shopify Variant ID or Variant GID per current listing/SKU** — this is
  a genuine, documented gap (see Missing Fields below).
- Searched `integrations/shopify/README.md` — placeholder only ("Details
  to be documented"), no reusable API script referenced there.
- No duplicate SKU warning doc specific to this dataset existed prior to
  this task; `business/rules/sku-format-rules.md` and
  `ebay-listing-sku-filter.md` exist but are eBay/general-SKU rules, not
  Shopify-collection-specific.

**No duplicate files or duplicate source mappings were created** — this
source map is new because no Kamsi collection-allocation asset existed.

## Phase 2 — Database Discovery

Checked `ledsone-db-mcp` schema/table metadata before writing any
extraction query, per task instruction (did not assume table names).

### Schemas actually present (verified via `search_objects`)
```
accounting, amazon_campaigns, business_reports, customer_service,
customers, google_ads, google_analytics, google_search_console,
inventory, listings, order_management, public, reports, staff,
suppliers
```
**Note:** the task's example schema list (`public`, `staging_ai`,
`development`, `daily_task`, `shopify`) does not match reality —
`staging_ai`, `development`, and `daily_task` **do not exist** as
schemas in this database, and there is no `shopify` schema (Shopify
data lives in the `listings` schema). Documented here rather than
assumed.

### Tables/views inspected
- `listings.shopify_collections` (~1,226 rows) — collection metadata
- `listings.shopify_collection_products` (~182,155 rows) — collection↔product membership
- `listings.shopify_listings` (~67,808 rows) — product/variant listings
- `listings.shopify_listings_parent_child_mapping` (~53,603 rows) — parent→child (variant) resolution
- `order_management.sub_source` — store/account mapping

### Store identification
`order_management.sub_source.id = 104` → `name = 'ledsone'`, confirmed
as ledsone.co.uk (matches `google_search_console.relationships.md`:
`sc-domain:ledsone.co.uk` → `sub_source = 104`). All queries in this
task filtered on `sub_source = 104` at every join step (collections,
parent listings, and child listings) to guarantee no ledsone.de/.fr/.us,
electricalsone.co.uk, vintagelite.co.uk, or dcvoltage.co.uk rows could
leak in.

### Selected authoritative source
`listings.shopify_collections` → `listings.shopify_collection_products`
→ `listings.shopify_listings` (parent, `is_parent=1`) →
`listings.shopify_listings_parent_child_mapping` →
`listings.shopify_listings` (child, `all_list=1`), exactly as documented
in `shopify-collections-relationships.md`. This join chain is marked
"verified" in the knowledge base (100% of resolvable membership rows
reach a real SKU) and was reused as-is — no naive
`product_id = item_id` shortcut was used.

### Join keys
`shopify_collections.collection_id → shopify_collection_products.collection_id`;
`shopify_collection_products.product_id::text → shopify_listings.item_id WHERE is_parent=1`;
`shopify_listings.id → shopify_listings_parent_child_mapping.parent_id`;
`shopify_listings_parent_child_mapping.child_id → shopify_listings.id WHERE all_list=1`.

### Source freshness
`shopify_collections.updated_at` ranged 2026-07-06 to 2026-07-13 across
the 29 target collections (all within the last 8 days at extraction
time). `shopify_listings.updated_at` (max per product) captured per row
in the allocation file's `source_updated_at` column — freshest observed
was 2026-07-14T00:16:xx (same-day sync).

### Duplicate risk found (new finding, not previously documented)
`shopify_collection_products` is documented in the knowledge base as
"verified duplicate-free (2026-07-09)" when deduped on `id`. **This
extraction found that is no longer true**: multiple distinct-`id` rows
now exist for the same `(collection_id, product_id)` pair (e.g.
`2core-round` had 140 raw `shopify_collection_products` rows for only
28 distinct products — verified NOT caused by a join bug, since
`COUNT(DISTINCT id) = COUNT(*)` for that collection). **Deduped by
`(collection_id, product_id)` pair** (not just `id`) for this
extraction — raw rows: 932 → distinct pairs: 932 after DISTINCT (the
932 relationship rows already reflect the deduped, correct pair count;
the underlying `shopify_collection_products` table itself contains far
more raw rows with true duplicates that were collapsed by `SELECT
DISTINCT`). **Recommend flagging this drift to whoever owns the
MySQL→PostgreSQL `listings:transfer` sync job.**

### Missing fields (confirmed via `information_schema.columns`)
`listings.shopify_listings` has **no** `admin_graphql_api_id` (Product
GID), **no** `variant_id`, and **no** `variant_gid` column. The only
Shopify Variant ID stored anywhere in this database
(`order_management.order_item_info.variant_id`) is populated per
*order line item*, not per current listing — it cannot be used to
build a complete current-catalog variant map, only a
historical-orders-touched one. **This is why `shopify_variant_id` and
`shopify_variant_gid` are recorded as `MISSING_FROM_DB` in both output
CSVs, not fabricated.**

### Why this source is reliable
- Verified end-to-end in the knowledge base (100% resolution rate,
  including multi-variant products).
- `sub_source` FK verified 0 orphan rows on both `shopify_collections`
  and `shopify_listings`.
- Same-day-to-8-day-old sync freshness.
- Read-only — zero writes to Shopify or the database.

## Phase 5 — Shopify API Fallback
**Not used.** The database fully resolved all 29 collections and 725/725
distinct product memberships (one product, `4417279983712`, is
referenced in `shopify_collection_products` but has no matching row in
`shopify_listings` at all — documented as a likely-discontinued product,
consistent with the knowledge base's own noted ~0.1% gap, not a query
defect). The one genuine gap (Variant ID/GID) is a **field**, not
**collection membership**, so it does not meet the task's Phase 5
trigger ("collection missing from DB" / "membership incomplete").
Filling it would require live LEDSone.co.uk Shopify Admin GraphQL API
calls — **no ledsone.co.uk Shopify Admin API credentials exist in this
AIOS session** (only a ledsone.de custom-app token was set up earlier
today, for an unrelated requirement). This is recorded as an open
blocker rather than attempted with the wrong store's credentials or
fabricated data.

## Files Created
`reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv`,
`reports/Kamsi/data/2026-07-14_kamsi-product-collection-relationships.csv`,
this file, `validation/Kamsi/2026-07-14_kamsi-collection-product-allocation-validation-report.md`,
`handover/Kamsi/2026-07-14_kamsi-collection-product-allocation-handover.md`.

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Complete — DB-sourced, Shopify Variant ID fallback blocked on missing
credentials (documented, not fabricated).
