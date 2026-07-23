# Evidence — Kamsi Req4 Live Summary Cards

**Date:** 2026-07-23
**Commit:** `1070910`

## Purpose
Kamsi Req4 is an exact duplicate of Dilaksi Req2 (same store, same 5,179 products, same SEO priority rule) that had never had a live-refresh path added.

## Changes

### `reports/digital-marketing-member-pages/pages/kamsi.html`
- Added a Refresh button to Req4's summary cards, wired to the **existing** `fn=dilaksi-req2-live` endpoint rather than duplicating the backend logic — since Req4 is data-identical to Dilaksi Req2, no new server-side code was needed.
- Demand (Semrush search volume) stays frozen, same documented limitation as Dilaksi's version (see `2026-07-23_req1-req2-live-refresh-fixes.md`).

## Raw diff
See `git show 1070910` (51 lines changed in `kamsi.html`, no backend changes).
