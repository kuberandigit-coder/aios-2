# Handover — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Let another LLM or team member understand and continue this work without verbal explanation.

## What Req 6 does
A new "Requirement 6" tab in `jefri.html`. **Always shows a table of every listing belonging to Jefri** (all ~8,127 distinct product/listing IDs that have ever run in Jefri's 5 Google Ads campaigns) — no search required up front (search box only filters the already-shown table). Each row has an inline Image Update Date input; once set, that row computes SKU, Days Live, Total Sales Since Update, Pre-Update Baseline Sales, % Change, and a Trend badge (Improved / Same / Dropped / Insufficient data) in place.

**Important — this was reworked same-day from an earlier single-search-box-then-one-result version.** Kuberan explicitly rejected that first version ("no need this format ... need like show always but only jeffri"). If you see any reference to a single `Listing ID` text input + `Calculate` button design, that's the OLD version — the current one is the always-visible table described above.

## Where it's implemented
- **Backend:** `reports/digital-marketing-member-pages/api/requirement.js` — search for `jefriReq6HandlerModule` (a self-contained IIFE right after `jefriReq5HandlerModule`, before `module.exports`). It returns `{ handleJefriReq6, handleJefriReq6List }` (an object, not a single function — different from every other handler module on this page, which return a bare function). Two routes:
  - `GET /api/requirement?fn=jefri-req6-list` — all Jefri listings, no params. This is what the table loads on tab open.
  - `GET /api/requirement?fn=jefri-req6&listingId=<id>&imageUpdateDate=YYYY-MM-DD` — per-row calculation, called once a date is set on a row.
- **Frontend:** `reports/digital-marketing-member-pages/pages/jefri.html` — search for `req6Tab` (HTML panel, now just a `tablebox`/search bar, no single-listing form) and `r6Init`/`r6LoadList`/`r6Calc`/`r6OnDateChange`/`r6Render` (JS, appended right after Req5's `r5ExportCsv` wiring inside the same `<script>` block). Nav item: `<li><a data-req="req6">Requirement 6</a></li>`.
- **Date persistence:** per-row Image Update Dates are stored in the browser via `idbGet`/`idbSet` (IndexedDB, same helper Req2 already uses), key `jefri_r6_dates`, value `{ listingId: 'YYYY-MM-DD', ... }`. **Not stored in Postgres** — Req6's spec was explicit read-only against the DB, so no new table was created. This means dates are per-browser/per-device, not shared across the team. If that turns out to be a real problem, the fix is a small writable Postgres table (would need explicit sign-off, since the original spec forbade schema changes without it).

## How the data flows
1. User submits Listing ID + Image Update Date → `r6Load()` fetches `/api/requirement?fn=jefri-req6&...`.
2. Backend resolves `listingId` → `listings.shopify_listings` row (`item_id`, `sku`, `is_parent`, `is_child`), channel `'LEDSone DE'`.
3. Computes `daysLiveSinceUpdate = today - imageUpdateDate` (whole days).
4. Runs two identical-shaped sales queries against `order_management.orders` + `order_item_info` (`sub_source_id=108`, `status='Completed'`, matched on `product_id` if the listing is a Parent, `variant_id` if it's a Variant/child):
   - Post window: `order_date >= imageUpdateDate` (open-ended)
   - Baseline window: `[imageUpdateDate - daysLiveSinceUpdate days, imageUpdateDate)` — always exactly `daysLiveSinceUpdate` days long
5. `pctChangeVsBaseline = ((post - baseline) / baseline) × 100`, or `null` if baseline is `0`/the window is empty (`daysLiveSinceUpdate = 0`).
6. `trend`: `Improved` if `≥ +15`, `Dropped` if `≤ -15`, `Same` otherwise, `Insufficient data` if `pctChangeVsBaseline` is `null`.
7. `r6Render()` writes the result table and a colored Trend badge; 5-minute server-side cache (same pattern as Req4/Req5) keyed on `listingId|imageUpdateDate`.

## Listing ID → SKU mapping
`listings.shopify_listings.item_id` (text, the raw Shopify product/variant ID) → `.sku`. In this store, **every** `is_parent=1` row has `sku IS NULL` (2,704 variation-template rows, `all_list=0` — not real sellable listings); all 11,722 `is_child=1` rows have a real SKU. So in practice every valid Listing ID a user enters resolves as `level: "Variant"`. This was verified with a `GROUP BY is_parent, is_child` count query, not assumed.

## PostgreSQL source
Read-only. Tables: `listings.shopify_listings`, `order_management.orders`, `order_management.order_item_info`. Same DB pool/connection pattern as every other handler in `requirement.js` (`process.env.DATABASE_URL` or `PGHOST`/etc., max 3 connections, 30s statement timeout).

## Sales source
Gross line-item revenue: `item_price × item_quantity`, `status = 'Completed'`, `sub_source_id = 108` (Shopify DE / ledsone.de). Identical definition to Req5's `SHOPIFY_SALES_QUERY` — deliberately reused, not reinvented.

## Date logic
`daysLiveSinceUpdate` and window boundaries are computed in plain JS (`Date` arithmetic on `YYYY-MM-DD` strings, all UTC-midnight-implicit, no timezone library) rather than in SQL, for simplicity — verified equivalent to the SQL `CURRENT_DATE - date` approach used elsewhere on this page via a direct side-by-side SQL query during validation (see evidence file). Post window's upper bound is exclusive-of-tomorrow (`order_date < tomorrow`) so "today" is fully included.

## Baseline logic
Always exactly `daysLiveSinceUpdate` calendar days immediately before Image Update Date. Not a fixed 7/30-day window — this was the single most load-bearing rule in the spec and is enforced structurally (the baseline start date is derived FROM `daysLiveSinceUpdate`, so it cannot drift out of sync).

## Trend logic
`Improved ≥ +15%`, `Same` from `-14%` through `+14%`, `Dropped ≤ -15%`. Boundaries are inclusive on both sides (`>=`/`<=`, not `>`/`<`) — confirmed via unit test that exactly `+15` and exactly `-15` classify correctly.

## Known edge cases
- **Zero baseline** (baseline sales = £0, but `daysLiveSinceUpdate > 0`): `pctChangeVsBaseline: null`, `trend: "Insufficient data"`, `zeroBaseline: true`. Reused muguntha.html's "Target Achievement" N/A convention rather than inventing a new rule.
- **Image updated today** (`daysLiveSinceUpdate = 0`): no baseline window exists at all — same `null`/`"Insufficient data"` treatment, plus `insufficientData: true` and an info banner telling the user to check back tomorrow.
- **Future date**: rejected with `400`.
- **Listing not found** / **found but no SKU**: `200` with `found:false` or `sku:null` plus a human-readable `error` string — not a silent failure.

## Files changed
- `reports/digital-marketing-member-pages/api/requirement.js` (both repos)
- `reports/digital-marketing-member-pages/pages/jefri.html` (both repos)

## Validation status
PASS — all 10 required tests + 4 edge cases, run against live production data. See `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`.

## Deployment status
DEPLOYED — live at `https://dm-dashboard.vintageinterior.co.uk/pages/jefri.html#req6`, confirmed via direct `curl` against `fn=jefri-req6-list` (8,127 rows returned), `fn=jefri-req6` (per-row calc), and the page markup, after the always-visible-table rework.

## Next action
None outstanding. Two open questions for Jefri, not blockers: (1) currency in € instead of £ — one-line change in `r6Money()`; (2) whether browser-local (not team-shared) date persistence is acceptable, or whether a small writable Postgres table should be added for it (would need explicit sign-off first, per the original read-only-DB constraint).
