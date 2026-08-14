# Handover — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Let another LLM or team member understand and continue this work without verbal explanation.

**This feature went through 4 iterations same day, each following an explicit correction from Kuberan.** This document describes the FINAL, current architecture only:
1. ~~Single search-box, manual Listing ID + Image Update Date → one result~~
2. ~~Always-visible table of every listing in Jefri's Google Ads campaigns~~
3. ~~Image Update Date auto-fetched live from Shopify per listing~~
4. **CURRENT: fully manual, permanently stored, user-curated tracker.**

## What Req 6 does
A small tracker table on the "Requirement 6" tab in `jefri.html`. The user adds a row by typing four things — **Label, Listing ID, SKU, Image Update Date** — nothing auto-filled or auto-discovered. Once added, the row's Days Live, Total Sales Since Update, Pre-Update Baseline Sales, % Change, and Trend are calculated automatically from real Shopify sales data and shown immediately, and stay live (recalculated fresh) every time the tab loads. Rows can be deleted. The list is **not** tied to Jefri's Google Ads campaigns at all anymore — it's whatever the user has chosen to add.

## Where it's implemented
- **Backend:** `reports/digital-marketing-member-pages/api/requirement.js` — search for `jefriReq6HandlerModule`. Returns `{ handleJefriReq6List, handleJefriReq6Add, handleJefriReq6Delete }`. Three routes:
  - `GET /api/requirement?fn=jefri-req6-list` — every tracked row + live-computed sales/trend.
  - `POST /api/requirement?fn=jefri-req6-add` — body `{label, listingId, sku, imageUpdateDate}`, all required.
  - `POST /api/requirement?fn=jefri-req6-delete` — body `{id}`.
- **Frontend:** `reports/digital-marketing-member-pages/pages/jefri.html` — search for `req6Tab` (Add form + table, no search-then-calculate flow) and `r6Init`/`r6LoadList`/`r6AddSubmit`/`r6DeleteRow`/`r6Render`.

## Storage — the important architectural detail
**Two separate Postgres databases are involved, on purpose:**
1. **Tracker data** (Label, Listing ID, SKU, Image Update Date) — a NEW table, `public.jefri_req6_tracker`, on the **writable** Neon DB already used by Sajeepan's Req4 feed-optimization tracker (`process.env.FEED_TRACKER_DB_URL || process.env.AUTH_DATABASE_URL` — same exact fallback pattern as `handleSajeepanTrackerSave` in `members-api.js`). Self-provisioned via `CREATE TABLE IF NOT EXISTS` the first time any Req6 endpoint runs — no manual migration was needed, confirmed working live.
2. **Sales calculation** — the main **read-only** analytics Postgres (`DATABASE_URL`), `order_management.orders` + `order_item_info`, exactly as every other requirement on this page.

**Do not connect to `DATABASE_URL` expecting to find `jefri_req6_tracker` there — it's on the other database.** This distinction matters if you're debugging or extending this feature.

## How the data flows
1. `r6LoadList()` → `GET fn=jefri-req6-list`. Backend reads all rows from `jefri_req6_tracker` (tracker DB), computes `daysLiveSinceUpdate` and both time windows per row in JS, then runs ONE bulk SQL query (`unnest`-based, `BULK_SALES_QUERY`) against the main DB covering every row's post + baseline window in a single round trip, merges the results, returns.
2. Add: `r6AddSubmit()` → `POST fn=jefri-req6-add` with all 4 fields → `INSERT INTO jefri_req6_tracker` → frontend reloads the list.
3. Delete: `r6DeleteRow(id)` → confirm() → `POST fn=jefri-req6-delete` → `DELETE FROM jefri_req6_tracker WHERE id=$1` → frontend reloads the list.

## Sales matching (simplified from every prior version)
The user-typed Listing ID is matched directly against `order_item_info.product_id` **OR** `.variant_id` in one condition — `(oii.product_id = w.match_id OR oii.variant_id = w.match_id)`. There is **no** lookup against `listings.shopify_listings` anymore to determine "is this a Parent or Variant" — the user provides the identifier by hand, so there's nothing to resolve. Verified this produces identical sales figures to the old resolved-lookup version for the same listing/date (£32.56 for `57163495964937` / `2026-07-01`, matching every earlier version's independently-validated result for that exact case).

## Days Live / Baseline / % Change / Trend (unchanged formulas across all 4 versions)
- `daysLiveSinceUpdate` = today − Image Update Date, whole days.
- Post window: `order_date >= imageUpdateDate` (open-ended).
- Baseline window: exactly `daysLiveSinceUpdate` calendar days immediately before Image Update Date — always equal-length by construction.
- `pctChangeVsBaseline` = `((post − baseline) / baseline) × 100`, or `null` if baseline is `0`/undefined.
- `trend`: `Improved` ≥ +15%, `Dropped` ≤ −15%, `Same` otherwise, `Insufficient data` if `pctChangeVsBaseline` is `null`.

## Known edge cases
- Zero/undefined baseline sales → `null`/"Insufficient data", never `Infinity`/`NaN` (same convention as muguntha.html's Target Achievement metric).
- Missing/invalid required field on add → `400` with a specific field-level error message.
- Delete has a client-side `confirm()` but no server-side soft-delete/audit trail — it's a hard `DELETE`.

## Files changed (this final version)
- `reports/digital-marketing-member-pages/api/requirement.js` (both repos) — `jefriReq6HandlerModule` fully rewritten.
- `reports/digital-marketing-member-pages/pages/jefri.html` (both repos) — Req6 tab HTML + JS fully rewritten.
- **Deleted** (obsolete, from version 3): `api/scripts/generate-jefri-req6-snapshot.js`, `.github/workflows/jefri-req6-snapshot-refresh.yml`, `api/data/jefri-req6-snapshot.json`.

## Validation status
PASS. Full add → list → verify-sales-match → delete → verify-removed round trip tested live against production, plus the missing-field validation path. Formula/threshold logic itself was validated extensively earlier the same day across the previous 3 versions and is unchanged here — only how Listing ID/SKU/Image Update Date get INTO the system changed (now: typed by hand, not discovered/fetched). See `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md` and the evidence file's four CORRECTION sections for the complete trail.

## Deployment status
DEPLOYED — live at `https://dm-dashboard.vintageinterior.co.uk/pages/jefri.html#req6`. A test row was added and deleted during verification; one real row ("Ceiling Light 60cm") was re-added afterward so the tracker isn't left empty.

## Next action
None outstanding for Req6 itself. Two carried-over notes unrelated to this feature, surfaced during earlier reworks: the pre-existing hourly sales/Postgres snapshot GitHub Action may be silently failing (broken default base URL, confirmed via curl, not fixed — outside this task's scope); and it's worth deciding whether tracker deletions should ever need an audit trail.
