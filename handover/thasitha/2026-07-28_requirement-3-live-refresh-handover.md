# Thasitha Requirement 3 — Live PostgreSQL Refresh (bug fix) — Handover

**Date:** 2026-07-28

## What this is

Fixed a reported bug: Requirement 3 (SKU Overlap & CPC Inflation) on `reports/digital-marketing-member-pages/pages/thasitha.html` was showing products as "overlapping" with Jefri campaigns they'd actually been removed from months earlier, because the entire page was a static JSON snapshot frozen on 2026-07-15/16 with no refresh mechanism. Converted to live PostgreSQL, same pattern as Requirement 1 (see `handover/thasitha/2026-07-28_requirement-1-live-refresh-handover.md`).

## Files Modified

1. `reports/digital-marketing-member-pages/api/requirement.js`
   - Added `thasithaReq3HandlerModule`/`handleThasithaReq3`, dispatched via `?fn=thasitha-req3`. Own `pg` Pool with a 60s `statement_timeout` (this query is heavier than R1's — took 30-45s in testing) and a 3-minute in-memory cache (bypassed by `&refresh=1`).
   - Query: finds all products ever advertised by a `group_name='Thasi'` campaign, restricts to ones with 2+ distinct campaigns historically, aggregates daily cost/clicks/conversions/conversion_value per (product, campaign, date), computes `last_active` = live `MAX(date)` per pair, resolves SKU/title/image/URL via the same `listings.shopify_listings` join Jefri's Req1 uses. Excludes blank `product_item_id` rows (found 12 stray ones).
   - Registered dispatch: `if (fn === 'thasitha-req3') return thasithaReq3HandlerModule(req, res);`

2. `reports/digital-marketing-member-pages/pages/thasitha.html`
   - Replaced the ~470KB static `const R3_DATA = [...]` literal with `let R3_DATA = []`.
   - `R3_LATEST_DATE`/`R3_ACTIVE_THRESHOLD` changed from `const` to `let` — now recomputed from the live payload's `latestDate` on every load (threshold = latestDate − 1 day, preserving the original 1-day-lag design intent, just live instead of frozen).
   - Added `#r3LiveChip` / `#r3RefreshBtn` to the R3 header (same visual pattern as R1's `#t1LiveChip`/`#t1RefreshBtn`).
   - Added `r3Load(force)` + `applyR3LiveData(data)`, mirroring `r1Load`/`applyLiveData`.
   - `initR3Filters()` (populates the Campaign/Type filter dropdowns) converted from a one-shot IIFE to a re-callable function, now re-run after every successful live load so new campaigns appear in the filters.
   - No changes to `r3ComputeRow`/`renderR3Row`/`renderR3`/CPC-inflation/risk logic — the live payload is shaped identically to the old static data, so that logic works unchanged.

## Issue found and fixed during verification

First production deploy returned HTTP 500 on the live endpoint — the query's actual runtime (~33s) exceeded the pool's `statement_timeout: 30000`. Raised to 60000ms and increased the cache TTL from 60s to 3 minutes (to avoid re-running this heavier query on every page load), redeployed, re-verified 200 OK.

## Verified

Deployed via `vercel --prod` from `reports/digital-marketing-member-pages/`, then hit the live production endpoint directly. Confirmed the exact bug is fixed: a Jefri campaign with `lastActive: "2026-03-04"` on a specific product is correctly excluded from that product's "currently overlapping" campaign list, while campaigns still active in June/July 2026 remain shown.

## Continuing this work

- Not yet interactively verified in a browser (only via API/curl) — worth a manual check of the R3 tab: filters, date-range recompute, pagination, and the KEEP/REMOVE action column with live data.
- If R3's ~30-45s query time becomes a UX problem, the next optimization would be adding an index on `google_ads.product_performance(product_item_id, campaign_id, date)` if one doesn't already exist, or narrowing `overlap_products` further before the `daily` aggregation.

## Evidence Location

`evidence/thasitha/2026-07-28_requirement-3-live-refresh-evidence.md`

## Status

Implemented, deployed to production, and live-verified via direct API testing.

## Next Step

Manual browser check of the R3 tab's UI, then normal git commit/push of the source changes (deploy already done, ahead of the push, per the "deploy before git push for Vercel work" convention).
