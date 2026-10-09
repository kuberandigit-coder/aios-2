# Handover — Shopify Price Check Page

**Date:** 2026-10-09 · **Owner:** Kuberan

## What's done

New common Development Task page, "Shopify Price Check — Final Price vs Current Shopify Price", built into
DM Dashboard following the repo's real existing conventions (dev_tasks package, task_auth, devTasksRegistry /
taskRegistry, jreq-* CSS). Reads Balance Price from Business Database 2
(`blos.listing_channel_price_v1`, platform='shopify', 732/1,808 SKUs populated — verified live) and current
price from Business Database 1 (`listings.shopify_listings`). Backend verified end-to-end against real data;
frontend build-verified.

## Open items (next session should pick these up)

1. **No PPC-rate source exists anywhere** — every record is `MISSING_INPUT`, 0 Final Prices computed. Need to
   locate or build a category-wise PPC rate source before Steps 4/5 can ever produce real output.
2. **No approved OK-tolerance setting** — ask Kuberan what tolerance to approve, then set
   `APPROVED_OK_TOLERANCE_PCT` in `backend/app/dev_tasks/shopify_price_check/engine.py`.
3. **Manual browser click-through not yet done** this session — do that before calling the page fully tested.
4. Run `POST /api/admin/dev-tasks/shopify-price-check/run` once in production to populate the first real
   snapshot (page shows "never — click Run Report" until then).

## Evidence / Closure

`evidence/dm-dashboard/2026-10-09_shopify-price-check-page_evidence.md`
`closure/dm-dashboard/2026-10-09_shopify-price-check-page_closure.md`
