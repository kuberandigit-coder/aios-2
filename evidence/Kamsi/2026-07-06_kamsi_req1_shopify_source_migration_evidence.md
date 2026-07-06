# Evidence — Kamsi Req 1: Shopify-Only Source Migration (2026-07-06)
- **Title:** Old PostgreSQL sources vs new Shopify sources for the 3 metric fields
- **Purpose:** Prove Units Sold (90d), Current Stock, Last Order Date now come from Shopify only
- **Requirement Source:** Kamsi (via Kuberan, 2026-07-06)
- **Business Question:** Which products have low sales but high stock, with Shopify as source of truth?
- **PostgreSQL Sources Checked:** public.order_transaction, public.inv_final_stock — REFERENCE ONLY this run, no longer final sources (read-only, unmodified)
- **External Sources Checked:** Shopify Admin API (LEDSone UK, ledsone.co.uk) via MCP connector — read-only bulk operations
- **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** Done, deploy pending approval · **PASS**

## Old sources (2026-07-03 build)
| Field | Old source |
|---|---|
| Units Sold (90d) | PostgreSQL public.order_transaction (SHOPIFY channel mirror) |
| Current Stock | PostgreSQL public.inv_final_stock (warehouse totals) |
| Last Order Date | PostgreSQL public.order_transaction |

## New sources (2026-07-06 build) — Shopify only
| Field | New source | Shopify field |
|---|---|---|
| Units Sold (90d) | Bulk op gid://shopify/BulkOperation/11262998118786 (orders created_at>=2026-04-07, 7,232 orders, 17,264 objects) | Order.lineItems.quantity summed per SKU, Order.cancelledAt IS NULL |
| Current Stock | Bulk op gid://shopify/BulkOperation/11262990451074 (full catalog, 22,699 objects) | ProductVariant.inventoryQuantity (available across locations) |
| Last Order Date | Same orders bulk op | max(Order.createdAt) per SKU, non-cancelled only |

Raw exports kept: `reports/Kamsi/data/2026-07-06_kamsi_req1_shopify_catalog_inventory.jsonl`, `2026-07-06_kamsi_req1_shopify_orders_90d.jsonl`. Aggregator: `2026-07-06_kamsi_req1_shopify_aggregate.py` (output: orders=7232, cancelled_excluded=4, skus_with_sales=3021, skus_with_stock=13866).

## Cross-check (old vs new, SKU 12ASIP20100)
- Stock: PG warehouse 154 → Shopify sellable **121**. Matches Friday's manual Shopify Admin check (noted "121 vs 154") — confirms the new figure is genuine Shopify available inventory.
- Units sold: 19 → 17 (window shifted 3 days: 2026-04-07→07-06). Last order date unchanged (2026-06-25).

## Result deltas
Products 13,866 (unchanged) · Slow-Moving 4,115 → **4,351** · stock-unknown SKUs 76 → **0** (every active SKU has a Shopify inventory value). Increase expected: Shopify sellable stock is the stricter, channel-true number and window moved.

- **Evidence Location:** this file + raw JSONL/CSV in reports/Kamsi/data/
- **Validation:** validation/Kamsi/2026-07-06_kamsi_req1_shopify_source_migration_validation.md
- **Known Limitations:** Seasonal Tag column remains removed (Kuberan 2026-07-03 instruction) though the 2026-07-06 prompt lists it — awaiting Kuberan's call. inventoryQuantity can be negative for oversold SKUs (kept as-is).
- **Next Steps:** Kuberan review → deploy on approval.
