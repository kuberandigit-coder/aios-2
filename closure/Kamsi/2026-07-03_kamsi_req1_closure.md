# Closure — Kamsi Req 1: Slow-Moving Product Visibility (2026-07-03)

**Title:** Kamsi Req 1 closure · **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** CLOSED — live
**Purpose:** Close out all Req 1 work done 2026-07-03.
**Business Question:** products with low sales but high stock needing SEO/visibility attention.

## Delivered today (in order)
1. **Initial report** — 5-collection scope (reused Dilaksi Req2 Shopify catalog), rule verbatim (<10 sold 90d AND stock >100 → Slow-Moving). Deployed on approval.
2. **Expanded to FULL store** per Kuberan — read-only Shopify bulk export (22,699 records): **13,866 active SKUs · 4,115 Slow-Moving · 1,762,439 units in slow-movers**.
3. **Performance fix** per Kuberan ("page very load") — client-side pagination + compact JSON embed: 10.9MB → 2.6MB, instant filters/search/sort/export over full dataset. No data changes.
4. **Seasonal Tag column removed** per Kuberan (no reliable seasonal field; promo tags rejected earlier; a fetch-tags attempt was started and stopped on Kuberan's instruction — builder reverted before the column removal was implemented cleanly).

**Live:** /pages/kamsi-req1-slow-moving-products.html (verified after each deploy).
**Data sources:** Shopify bulk catalog (read-only) · PG order_transaction SHOPIFY 90d · PG inv_final_stock (warehouse-summed; PG refreshed daily ~08:10). Builder: `reports/Kamsi/data/2026-07-03_kamsi_req1_page_builder.py`.
**Evidence / Validation:** `evidence/Kamsi/2026-07-03_kamsi_req1_slow_moving_evidence.md` (+full-store update section) · `validation/Kamsi/2026-07-03_kamsi_req1_slow_moving_validation.md` · Vercel notes with deployment records.
**Known Limitations:** stock = warehouse total (Shopify sellable slightly lower, documented); Shopify-channel sales only; daily PG snapshot.
**Next Steps:** monthly/weekly rerun on request.
**PASS/FAIL:** PASS · RAG: GREEN
