# Handover — Kamsi Req 1: Shopify-Only Source Migration (2026-07-06)
- **Title:** Slow-Moving Product Visibility now 100% Shopify-sourced
- **Purpose:** Continuation notes for the next session/agent
- **Requirement Source:** Kamsi (via Kuberan, 2026-07-06) · **Owner:** Kamsi · **Reviewer:** Kuberan
- **Status:** Built & validated locally; NOT deployed (needs Kuberan approval) · **PASS**

## What changed
Units Sold (90d), Current Stock, Last Order Date migrated from PostgreSQL (order_transaction / inv_final_stock) to Shopify Admin API bulk exports. New results: 13,866 SKUs, 4,351 Slow-Moving, 9,515 Active, 1,937,897 units in slow-movers, 0 stock-unknown.

## Pipeline (rerun order)
1. `reports/Kamsi/data/2026-07-06_kamsi_req1_shopify_aggregate.py` (needs the two bulk-export JSONLs — see prompt file for the bulk queries)
2. `reports/Kamsi/data/2026-07-06_kamsi_req1_page_builder.py` → writes both HTML copies

## Pending
- **Deploy** dashboard page to Vercel — waiting on Kuberan approval (push to Staff-requirements as digitalmarketing author).
- **Seasonal Tag decision** — new prompt lists the column; Kuberan removed it 2026-07-03. Kept removed; ask Kuberan.
- 2026-07-03 data files kept for history; old builder untouched.

- **PostgreSQL Sources Checked:** reference only · **External Sources Checked:** Shopify bulk ops (IDs in evidence file)
- **Files Created / Evidence Location / Validation:** see evidence + validation files of same date
- **Known Limitations:** negative inventoryQuantity possible for oversold SKUs · **Next Steps:** approval → deploy → update daily log on "done for today"
