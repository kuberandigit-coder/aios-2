# Evidence — Incremental July Live-Refresh + "Check New Orders" Rollout to All Member Tabs

**Date:** 2026-07-23
**Commits:** `c61ac4a` (perf), `81c315f` (feat, initial 2 tabs), `be89ae8` (feat, rollout to all + Mahima Req3 relocation), `863a41a` (feat, remove Refresh button)

## Purpose
The July "live month" tabs across `sales.html` re-scanned the **entire month** from Shopify on every Refresh click (`created_at:>=2026-07-01`), getting slower as the month progressed — e.g. Mahima's Organic tab took 7-14s per click, Kamsi's took ~52s. User asked to fetch only new/changed orders instead, then to roll the same speed-up out to every member tab, then to simplify the two-button UX down to one button.

## Step 1 — incremental fetch, Mahima only (`c61ac4a`)
- `reports/digital-marketing-member-pages/api/sales.js`: added an in-memory `RAW_ORDERS_CACHE` (keyed by store+month) holding raw Shopify order nodes already fetched. On repeat requests, queries Shopify with `updated_at:>=lastCutoff` instead of `created_at:>=monthStart` — `updated_at` also catches refunds/edits on already-cached older orders, so the cache never goes stale on that front. A full month re-fetch still runs automatically at least once per hour as a safety net (`RAW_FULL_REFETCH_INTERVAL_MS`).
- Verified live: first call (cold) `incrementalFetch:false`, 9 pages, ~13.5s; second call `incrementalFetch:true`, 1 page, ~740ms — identical 53-order result set both times (no data loss from the incremental path).

## Step 2 — two-button UX, Mahima only (`81c315f`)
- Added a separate "Check New Orders" button next to "Refresh": Refresh forces a full month re-fetch (`&fullResync=1`), Check New Orders uses the fast incremental path.

## Step 3 — rollout to all 12 remaining member tabs + Mahima Req3 relocation (`be89ae8`)
- Extended the same incremental-caching pattern (own isolated `RAW_ORDERS_CACHE`/hourly-safety-net/`forceFullResync`) into 4 separate handler modules that previously had no incremental logic at all: Kamsi (`kamsiHandlerModule`), Dilaksi (`dilaksiHandlerModule`), Sukirtha-UK (`sukirthaUkHandlerModule`), and Sukirtha-DE-Email (`handleEmail`).
- Added the same "Check New Orders" + "Refresh" button pair to all remaining member tabs (Jeffri, Hetheesha, Thivagini, Thasitha, Sajeepan, Theekshy, Sonya, Kamsi, Dilaksi, Sukirtha UK/DE/DE-Email) — 14 tabs total with both buttons at this point.
- Verified live: Kamsi full-fetch 52.1s → incremental 4.4s; Dilaksi 37.7s → 4.7s; Sukirtha-UK 35.9s → 4.2s; Sukirtha-DE-Email 12.9s → 0.7s.
- Same commit also relocated Mahima Req3 (see `mahima/2026-07-23_req3-search-terms-live-relocation.md`) — bundled because both changes touched `sales.html` in the same working session.

## Step 4 — remove the Refresh button entirely (`863a41a`)
- Per user request, the separate "Refresh" (forced full re-fetch) button was removed from all 14 tabs — "Check New Orders" is now the sole control.
- On click, the button now shows "Refreshing…" and reverts to "Check New Orders" on completion; status chip wording updated everywhere (footnotes, period-sub text) to reference "Check New Orders" instead of "Refresh".
- The automatic hourly full-resync safety net (server-side) is unchanged — full accuracy is preserved even though there's no longer a user-facing manual trigger for it.
- Verified live post-deploy: 0 `RefreshBtn` elements remain, 14 `NewOrdersBtn` elements present, API still returns `incrementalFetch` correctly.

## Raw diff
See `git show c61ac4a`, `git show 81c315f`, `git show be89ae8`, `git show 863a41a`.
