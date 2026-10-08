# Evidence — Mahima: "View Owned IDs" Button + Searchable Popup

**Date:** 2026-10-08
**Project:** dm-dashboard
**Requested by:** Kuberan, as a direct follow-up to the Req5b product-ownership bug fix —
wanted a way to see the full owned-ID list in-dashboard, not just the count in the footnote.

## What was built

- **Backend** — `GET /api/mahima/owned-product-ids` (`backend/app/staff_pages/mahima.py`): calls
  the same `_get_mahi_ft_product_ids()` source `/req5`/`/req5b` already use, returns
  `{count, productIds}` sorted by length then value.
- **Frontend** — `frontend/src/mahima/pages/ProductCampaignSales.jsx`: a small "View Owned IDs"
  button next to the existing Refresh button; opens `OwnedIdsModal`, a popup using the shared
  `jreq-modal-overlay`/`jreq-modal`/`jreq-modal-header`/`jreq-modal-body` CSS system already used
  elsewhere in the dashboard (e.g. `MetaTitleDescriptionAudit.jsx`) — no new design system
  introduced. Shows a live count badge and a client-side search-as-you-type filter over the
  already-fetched ID list (no extra request per keystroke).

## Verification

- `python -m py_compile backend/app/staff_pages/mahima.py` — clean.
- `npx vite build` (full frontend) — clean, built in 3.87s, only pre-existing unrelated
  `INEFFECTIVE_DYNAMIC_IMPORT` warnings (same ones present before this change).
- No live click-through performed (no server/browser access from this session) — flagged as the
  one remaining check before calling this fully verified.

## Files changed

`backend/app/staff_pages/mahima.py`, `frontend/src/mahima/pages/ProductCampaignSales.jsx`.
Commit `e453742`, pushed to `dev-work`.

## Status

**Built and pushed to `dev-work`.** Not yet merged to `main`, not yet live-clicked-through.
