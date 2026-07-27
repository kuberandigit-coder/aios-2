# Evidence — Meta UK Tab + Discovery of Cross-Tab Order Overlap

**Date:** 2026-07-27
**Commits:** `6153245` (uncommitted follow-up diff to `api/sales.js` also captured, see Files Changed)

## Purpose
User asked to find UK Meta/Facebook orders for January. A channel-breakdown audit showed 334 orders classified "Social" (£5,931.01) with no owning staff tab. Deep-diving that list also surfaced a bigger problem: comparing order names across Kamsi/Dilaksi/Sajeepan/Sonya/DM's January order lists showed 1,037 of 2,156 unique orders (48%) appear in more than one tab — because SEO tabs (Kamsi/Dilaksi) are product-scoped while Ads tabs (Sajeepan/Sonya/DM) are utm-scoped, so the same order can legitimately satisfy both definitions and gets counted twice.

## What Was Done
- (`6153245`) Added a "Meta UK" tab to `sales.html`/`api/sales.js`: orders whose first-session channel is Social (Facebook/Instagram/Pinterest/TikTok) AND aren't already claimed by Sajeepan/Theekshy/Sonya/DM's rules.
- Added `socialAudit` and `paidSearchGapAudit` tallies to the `uk-total-debug` endpoint (in `api/sales.js`) to identify exact campaign/term values behind unclaimed channels.
- (uncommitted at time of `/update-aios`, now committed) Added `firstSessionSplit` — a full first-session grouping of every order in a month (not just unclaimed ones), used to manually review and assign all ~2,489 January orders by channel + campaign/term/source, with order names listed per group.
- Confirmed via direct order-name comparison across tab JSON snapshots that overlap is real and large (not a rounding/display artifact) — this finding directly motivated the standalone `salesuk.html` page (see `evidence/salesuk/2026-07-27_standalone-order-level-page.md`).

## Files Changed
- `reports/digital-marketing-member-pages/api/sales.js` (Meta UK tab handler + `socialAudit`/`paidSearchGapAudit`/`firstSessionSplit` additions to `ukTotalDebugHandler`)
- `reports/digital-marketing-member-pages/pages/sales.html` (Meta UK tab, `MU`-prefixed globals)

## Status
Deployed live same day. Meta UK tab uses live fetch only (no static snapshot generated yet for Jan-Jun) — first real-user load will be slow (~90s) until a snapshot is generated the same way DM's tab was.

## PASS/FAIL
PASS — Meta UK tab verified live (334 orders / £5,931.01 for January via the underlying audit numbers). Overlap discovery independently confirmed via direct order-name-set comparison across 6 tabs' January JSON.

## Next Step
Generate Jan-Jun static snapshots for the Meta UK tab (same bulk-refresh pattern as Sajeepan/Sonya/DM) so it doesn't do a live 90s scan on every cold load.
