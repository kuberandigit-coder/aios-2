# Capabilities — 2026-07-06

## Capability — Shopify Bulk Operations as Source-of-Truth for Catalog-Wide Metrics

**Date:** 2026-07-06
**Owner:** Kamsi (via Kuberan)
**Project:** digital-marketing-member-pages, Kamsi Req1 (ledsone.co.uk)
**Status:** Done, deploy pending approval at time of writing

### Capability

Migrate a dashboard metric's source of truth from a PostgreSQL mirror/snapshot to **live Shopify
data via the Bulk Operations API**, for metrics that need a full-catalog or full-order-history
scan (too large for a normal paginated query) — with a documented before/after source table so the
switch is auditable, not silent.

### Technical implementation

- **Units Sold (90d)**: one Bulk Operation over all orders `created_at >= `(90 days ago), summing
  `Order.lineItems.quantity` per SKU, excluding any order with `cancelledAt` set. Replaced the old
  `public.order_transaction` (a Shopify-channel mirror) as the source.
- **Current Stock**: one Bulk Operation over the full catalog, reading
  `ProductVariant.inventoryQuantity` (available across all locations). Replaced
  `public.inv_final_stock` (a warehouse-totals mirror).
- **Last Order Date**: derived from the same orders Bulk Operation, `max(Order.createdAt)` per
  SKU, non-cancelled only.
- Raw JSONL exports kept alongside a Python aggregator script, with output counts logged
  (orders=7232, cancelled_excluded=4, skus_with_sales=3021, skus_with_stock=13866) — a concrete,
  checkable output rather than a black-box transform.

### Why this matters as a pattern

A full-catalog or full-order-history scan (tens of thousands of objects) is exactly the case where
Shopify's normal paginated Admin GraphQL API becomes impractical — the Bulk Operations API is the
intended tool for that scale, and this task documents a concrete working example of using it for 3
different metric types in one run.

### Originating task

`evidence/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_evidence.md`

### Reuse

Reusable for any future dashboard metric that currently relies on a Postgres mirror of Shopify data
and needs to move to Shopify-as-source-of-truth at full-catalog scale.

### Limitations

Written up from a single migration evidence file — whether the Postgres mirror tables
(`order_transaction`, `inv_final_stock`) were fully decommissioned afterward, or kept as a
fallback, was not traced forward past this task's own "deploy pending approval" status.
