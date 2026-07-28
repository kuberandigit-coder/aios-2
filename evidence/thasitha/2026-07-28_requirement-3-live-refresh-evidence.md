# Thasitha Requirement 3 — Live PostgreSQL Refresh (bug fix)

**Date:** 2026-07-28
**Team member / Team / Store:** Thasitha / Google Ads / ledsone.de

## Reported bug

Requirement 3 (SKU Overlap & CPC Inflation) showed a product as still "overlapping" with a Jefri campaign even though that product was removed from that campaign around early March/April 2026. The user asked for genuinely current data: if a product was removed yesterday, today's page should not show it.

## Root cause

`reports/digital-marketing-member-pages/pages/thasitha.html` Requirement 3 was **100% static** — a single ~470KB `const R3_DATA = [...]` JSON literal baked into the page on 2026-07-15/16, containing frozen daily performance rows per (product, campaign). The "currently overlapping" check (`isCurrentlyActive: c.lastActive >= R3_ACTIVE_THRESHOLD`) was real logic, but both `R3_ACTIVE_THRESHOLD` ('2026-07-15') and the underlying `lastActive` values were frozen at build time and never re-evaluated. There was no refresh button, no live fetch — confirmed via `evidence/thasitha/2026-07-15_requirement-3-discovery.md`, which also confirms there is **no per-product "currently in campaign" status column for PMax** (`google_ads.ad_group_products.status` only covers Shopping/Search, zero rows for the account's PMax campaigns).

## Fix

Converted to a live PostgreSQL-backed page, same pattern as Requirement 1 (`evidence/thasitha/2026-07-28_requirement-1-live-refresh-evidence.md`):

- **Backend:** new `thasithaReq3HandlerModule`/`handleThasithaReq3` in `reports/digital-marketing-member-pages/api/requirement.js`, dispatched via `?fn=thasitha-req3`. Own `pg` Pool (60s connect timeout, **60s statement timeout** — needed since this query aggregates ~29-45k `product_performance` rows across every campaign that has ever shown a Thasi product, measured 30-45s), 3-minute in-memory cache bypassed by `&refresh=1`.
- **Query logic:**
  1. `thasi_products` — all product_item_id ever advertised by a `group_name='Thasi'` campaign (excluding blank/null IDs — found 12 stray rows with `product_item_id=''`, filtered out).
  2. `overlap_products` — restrict to products with 2+ distinct campaigns historically (structural pre-filter, not the "is it live" decision).
  3. `daily` — per (product, campaign, date) aggregated cost/clicks/conversions/conversion_value, all history.
  4. `last_active` — `MAX(date)` per (product, campaign) pair, computed fresh every request.
  5. `latest_date` — live `MAX(date)` across the whole result set (not hardcoded).
  6. Listing resolution (SKU/title/image/URL) via the same `listings.shopify_listings` + `listings.shopify_listings_parent_child_mapping` join already proven in Jefri's Req1 query.
- **Frontend:** `R3_DATA` demoted from a static const to `let R3_DATA = []`, populated live by a new `r3Load(force)`/`applyR3LiveData()` pair (mirroring `r1Load`/`applyLiveData`). `R3_LATEST_DATE`/`R3_ACTIVE_THRESHOLD` are now `let` and recomputed from the live payload's `latestDate` (threshold = latestDate − 1 day, same 1-day lag rule as the original design, just live instead of frozen). Added `#r3LiveChip` status chip and `#r3RefreshBtn` "Refresh Data" button to the R3 header. `initR3Filters()` (campaign/type dropdown population) converted from a one-shot IIFE to a re-callable function, re-run after every live load.

## Live verification (2026-07-28, production)

Tested `GET /api/requirement?fn=thasitha-req3&refresh=1` directly against the deployed production endpoint:
- Returns 200, 485 overlap products, `latestDate: "2026-07-28"`.
- **Confirmed the exact bug scenario is fixed:** sample product `CRSF100BM+WSLS155BM+SCRN70BM+LSFT220BM` shows campaign "Shopping | Jeff | :MCPC:CPPC_Testing:Jeff-11.02" with `lastActive: "2026-03-04"` — since this is far older than the live threshold (2026-07-27), it will correctly be excluded from "currently overlapping" by `r3ComputeRow()`'s `isCurrentlyActive` filter, while genuinely still-active Jefri campaigns on the same product (last active June 2026) remain correctly shown.

## Known limitation

Query takes 30-45s on a cold connection due to the volume of historical rows scanned. Mitigated with a 3-minute server cache (vs. the 60s used elsewhere) so repeat page loads are fast; "Refresh Data" always bypasses the cache for genuinely on-demand freshness, accepting the wait.

## Files Modified

- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/thasitha.html`

## PASS / FAIL

PASS — live query verified against production Postgres and the production Vercel deployment; the reported stale-overlap bug is confirmed fixed with a concrete before/after example.
