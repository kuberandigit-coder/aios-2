# Evidence — Mahima Req5b: Wrong Product-Ownership Rule (non-Mahima products showing)

**Date:** 2026-10-08
**Project:** dm-dashboard
**Reported by:** Kuberan, via live screenshots — product `5481828778151` showing €1,396.12 of
organic sales on Req5b ("Product × Campaign Sales"), confirmed absent from the Product Ownership
page's tag-based list for Mahima ("No products for Mahima" when searched).

## Investigation

1. Confirmed `/req5` (Product ID Coverage) correctly filters via `_get_mahi_ft_product_ids()` —
   the real Shopify `Mahi-ft` tag on `ledsone_de`, fixed on 2026-09-22 per an existing code
   comment in `backend/app/staff_pages/mahima.py`.
2. Confirmed the screenshot's page is a **different** endpoint: `/api/mahima/req5b`, powered by
   `frontend/src/mahima/pages/ProductCampaignSales.jsx`.
3. Read `_req5b_build_report()` and its ownership source, `_r5b_get_mahima_owned_product_ids()`
   (`mahima.py`, pre-fix lines ~901-923): built from
   `SELECT DISTINCT product_item_id FROM google_ads.product_performance WHERE campaign_id = ANY(...)`
   — i.e. "Mahima's products" = any product with a row under her campaign IDs, including
   zero-current-spend historical rows.
4. This is the exact flawed approach the 2026-09-22 fix's own code comment describes replacing:
   "Replaces trying to infer ownership from which products happen to already have ad spend — a
   tagged product with zero spend yet ... is exactly the case the old campaign-derived approach
   would have missed." That fix was applied to `/req5` only; `/req5b` was never touched.

## Fix

`backend/app/staff_pages/mahima.py`: `_r5b_get_mahima_owned_product_ids()` now simply calls
`_get_mahi_ft_product_ids()` — the same tag-based source `/req5` already uses — instead of its own
separate, campaign-spend-derived query. Removed the now-dead `_r5b_normalize_product_item_id`
helper the old logic needed.

## Validation

`python -m py_compile backend/app/staff_pages/mahima.py` — clean. Confirmed `_get_mahi_ft_product_ids`
is defined earlier in the file (no forward-reference issue). No live click-through from this
session (no server access) — flagged below.

## Known follow-up (not yet done)

`req5b_snapshot`'s cached payload was computed under the old rule (synced 2026-10-08 16:38:38 per
the reporting screenshot) — needs a fresh `POST /api/mahima/req5b/sync/run-now` (or the page's own
Refresh button, if wired to it) after this deploys, or it will keep serving the stale,
incorrectly-scoped data until the next scheduled run.

## Files changed

`backend/app/staff_pages/mahima.py`. Commit `1af4327`, pushed to `dev-work`.

## Status

**Fixed in code, pushed to `dev-work`.** Not yet merged to `main` (per this project's
dev-work-only push policy — Kuberan merges via the Dev Tools UI). Not yet live-verified against
the real deployed server, and the stale snapshot has not yet been refreshed.
