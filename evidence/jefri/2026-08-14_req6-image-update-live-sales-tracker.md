# Evidence — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Record of discovery, data-source verification, and implementation for Jefri's T-06 requirement.

## Requirement
Requester: Jefri (Digital Marketing — Google Ads). Two manual inputs (Listing ID, Image Update Date); everything else (SKU, Days Live, sales, baseline, % Change, Trend) computed live. Baseline window must be the same number of days immediately before the Image Update Date as have elapsed since it — not a fixed 7/30-day window.

## Existing assets discovered and reused (no duplicate truth created)
- **Tab pattern:** jefri.html's Req5 (`req5Tab`, `showReqTab`, `#msNavList a[data-req]`) — Req6 reuses the exact same tab-switch/nav-wiring mechanism and CSS conventions, added as `req6Tab` / `data-req="req6"`.
- **Listing ID → SKU:** `listings.shopify_listings.item_id` / `.sku`, `channel = 'LEDSone DE'` — the same table/column/channel filter used by every other query in `api/requirement.js` (Req1, Req4 mapping, Req5's `resolutionCte`). Verified live: `item_id='57163495964937'` → `sku='ENC4361'`, `is_child=1`.
- **Shopify sales source:** `order_management.orders` JOIN `order_management.order_item_info`, `sub_source_id = 108` (Shopify DE), `status = 'Completed'`, gross revenue `item_price × item_quantity` — byte-identical definition/columns to Req5's `SHOPIFY_SALES_QUERY`. Parent listings match on `oii.product_id`; child/variant listings (all real Listing IDs in this store — see below) match on `oii.variant_id`.
- **Order Date field:** `order_management.orders.order_date` (`timestamp without time zone`) — same field Req5/Req4 already filter on.
- **Zero-baseline convention:** no existing rule in this project for this exact case, but `muguntha.html`'s "Target Achievement" metric (`2026 Net ÷ (2025 Net × 1.30)`, requires both years' Net > £0, else N/A) already established this site's approved pattern for an undefined/zero denominator — reused rather than inventing a new rule: baseline = 0 or window-empty (`daysLive = 0`) → `pctChangeVsBaseline: null`, `trend: "Insufficient data"`.

## Database inspection (read-only)
- `listings.shopify_listings`: confirmed `item_id`, `sku`, `is_parent`, `is_child`, `channel` columns exist and behave as documented.
- Confirmed via `SELECT is_parent, is_child, count(*) ... GROUP BY 1,2` that **every** `is_parent=1` row in this store has `sku IS NULL` (2,704 rows — variation template parents, `all_list=0`, not real sellable listings) while all 11,722 `is_child=1` rows carry a real SKU. In practice every valid Req6 Listing ID resolves as `level: "Variant"` — documented, not assumed; a parent-level ID correctly returns "Listing found but has no SKU on record" rather than a guess.
- `order_management.order_item_info`: confirmed `product_id` (parent match), `variant_id` (child match), `item_price`, `item_quantity` columns.
- No writes performed. No schema changes. No production data modified.

## Implementation
- **Backend:** `api/requirement.js` — new `jefriReq6HandlerModule` (self-contained IIFE, own DB pool, own cache, same shape as `jefriReq5HandlerModule`), routed via `fn=jefri-req6`. See file for full SQL/logic; key formulas:
  - `daysLiveSinceUpdate = floor((today - imageUpdateDate) / 1 day)`
  - Post window: `order_date >= imageUpdateDate` (open-ended, grows daily)
  - Baseline window: `[imageUpdateDate - daysLiveSinceUpdate days, imageUpdateDate)` — by construction always exactly `daysLiveSinceUpdate` calendar days
  - `pctChangeVsBaseline = ((post - baseline) / baseline) × 100`, `null` if baseline is `0`/undefined
  - `trend`: `Improved` ≥ +15%, `Dropped` ≤ −15%, else `Same`; `Insufficient data` if `pctChangeVsBaseline` is `null`
- **Frontend:** `pages/jefri.html` — new `req6Tab` section (input area: Listing ID + Image Update Date + Calculate button; result table matching the spec's required field list) plus `r6Init`/`r6Load`/`r6Render`/`r6Money`/`r6SetMsg` functions, wired into the existing `showReqTab`/nav-click/hash-restore machinery (`validTabs` extended to include `req6`).

## Validation performed
See `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md` for the full 10-test run (all pass), including direct-SQL cross-checks against the live API response for a real Dropped-trend listing (`44963099312393`, -48.15%) and a real zero-baseline listing (`35211971264679`).

## Files touched
- `reports/digital-marketing-member-pages/api/requirement.js` (both repos)
- `reports/digital-marketing-member-pages/pages/jefri.html` (both repos)

## Known limitations
- Parent-level (template) Listing IDs have no SKU in this store and will always return "no SKU on record" — this is real store data, not a bug.
- No caching invalidation beyond the existing 5-minute TTL pattern used by Req4/Req5 — acceptable per the "must update automatically as new sales are recorded" requirement (5 minutes, not real-time-to-the-second).
- Currency displayed as `£` (GBP) matching the rest of this Vercel project's UI convention, even though the underlying store is `ledsone.de` — consistent with how Req5's cards already display `€` for Ads spend but Shopify sales elsewhere on this page are shown unprefixed/£; flagged for Jefri/Kuberan review if a strict €-only display is required.

## Deployment
Deployed to production (`vercel --prod --yes`), confirmed live via direct `curl` against `/api/requirement?fn=jefri-req6` and the `jefri.html` tab markup.

**Status:** PASS (initial build — see UI correction below)
**Reviewer:** Kuberan (pending review)

---

## CORRECTION — 2026-08-14, same day, later in session

Kuberan clarified the UI was wrong: "no need this format ... currently only search and show right no need like this need like show always but only jeffri" — the single search-first-then-show-one-listing form was rejected in favour of an always-visible table of every listing belonging to Jefri, with search only as an optional filter on top.

**Clarified via AskUserQuestion:** "Jefri listings" = every distinct product/listing ID that has ever appeared in Jefri's 5 named Google Ads campaigns (`google_ads.product_performance`, same source as Req1/Req4/Req5) — Kuberan's own recommended option, confirmed.

**Rework:**
- New backend endpoint `fn=jefri-req6-list` (`handleJefriReq6List`, same `jefriReq6HandlerModule` IIFE) — returns all ~8,127 distinct Jefri listing IDs resolved to Shopify SKU/level, deduped on matched Shopify listing (several raw Ads ID formats can resolve to the same real listing). 5-minute cache, same pattern as everything else on this page.
- `jefri.html`'s Req6 tab now renders this full list as an always-visible table (same `tablebox`/`tbar`/`scroll` pattern as Req5) on tab open — no search or manual entry required to see it. A search box filters the already-loaded table client-side (Listing ID or SKU).
- Each row has an inline, per-row `<input type="date">` for Image Update Date. Since Req6 is explicitly read-only against Postgres (no schema/table changes permitted per the original spec), these dates are **not** stored in Postgres — they're persisted in the browser via the existing `idbGet`/`idbSet` IndexedDB helpers (same store Req2 already uses), keyed `jefri_r6_dates`. Documented as browser-local, not shared across devices/users, in the tab's own footnotes so this isn't a hidden surprise.
- Once a row has a date, the existing single-listing `fn=jefri-req6` endpoint is called for that row (unchanged logic/formula — same Days Live / baseline / % Change / Trend calculation validated earlier the same day) and the row's remaining columns populate in place.

**Verified live post-rework:**
- `fn=jefri-req6-list` returns 8,127 rows (query cost ~680ms via `EXPLAIN ANALYZE`, well within the function's 300s timeout, cached 5 min after).
- `fn=jefri-req6` per-row calc endpoint still returns correct results for a listing pulled straight from the new list (`35309184319655` → zero-baseline case, correctly `Insufficient data`).
- `scripts/check-live-deploy.js` re-run post-deploy — all pre-existing canaries still OK, no regression to any earlier same-day fix.

**Process note:** before pushing this rework, `git fetch` on the Staff-requirements worktree found 13 new commits Piranav had pushed in the meantime (Jackson tab, Staff ID Performance additions). Pulled them in first (fast-forward, no conflicts — different files) rather than overwriting, per the standing "don't touch Piranav's work" rule.

**Status:** PASS (table rework — superseded by a second correction below)
**Reviewer:** Kuberan (pending review)

---

## SECOND CORRECTION — 2026-08-14, same day, later in session

Kuberan corrected the design again: "I mean the image update date no need as input fir that listing show when i update the listing i think that is available in shopify so using ledsone de api for this data after get that after image date change find the sales that is also in shopify so get that and update before sales also available in shopify gather that from shipfy and update other two with these data" — the manual per-row date `<input>` (and its browser-local IndexedDB persistence) was the wrong design entirely. Image Update Date should be resolved automatically, live, from Shopify itself — not entered by a human at all.

**Rework:**
- New `fetchShopifyImageUpdateDate(productId)` in `jefriReq6HandlerModule` — calls the Shopify Admin **REST** API (`GET /admin/api/2024-10/products/{productId}/images.json`, ledsone-de.myshopify.com), takes `MAX(updated_at)` across every image on that product as the Image Update Date. REST was used deliberately over GraphQL: Shopify's GraphQL `Image` type (used elsewhere in this file for live stock) does not expose per-image timestamps; REST's image object reliably does.
- Images live on the parent **product**, not a variant — a child/variant Listing ID is first resolved to its parent's Shopify product ID via `listings.shopify_listings_parent_child_mapping` (same mechanism Req5 already uses for sales rollup) before the Shopify call.
- `handleJefriReq6` no longer accepts or requires an `imageUpdateDate` query param at all — it's entirely server-resolved. Removed the now-dead `isValidDateR6`/future-date-rejection logic that existed only to validate a manual input.
- Cached 24h server-side per product ID (`IMAGE_DATE_CACHE`) — image edits are infrequent, and this avoids repeatedly hitting Shopify's API across ~8,000 Jefri listings.
- Frontend: removed the per-row date `<input>`, the `idbGet`/`idbSet` persistence, and `r6OnDateChange` entirely. Rows now auto-fetch (Shopify image date + sales calc together, one call) via an `IntersectionObserver` as they scroll into view — deliberately lazy, since firing all ~8,000 requests at once on tab open would hammer both Postgres and the Shopify Admin API. A row's cells patch in place (`r6PatchRow`) once its data arrives, rather than re-rendering the whole 8k-row table and losing scroll position.

**Bug found and fixed during this rework:** first live test threw `ReferenceError: SHOPIFY_STORE_DOMAIN is not defined`. Root cause: `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_API_VERSION` (used by the existing live-stock code) are declared *inside* `jefriProductStatusHandlerModule`'s own IIFE (lines 9–1345 of `requirement.js`) — despite zero indentation making them look file-level, they are not reachable from `jefriReq6HandlerModule`, which is a separate IIFE much further down the same file. This exact class of bug already has a precedent/workaround in this codebase (`T2_SHOPIFY_STORE_DOMAIN`, used by another module for the identical reason) — followed the same pattern: duplicated the two constants locally as `R6_SHOPIFY_STORE_DOMAIN`/`R6_SHOPIFY_API_VERSION`. Confirmed fixed via live curl test immediately after.

**Verified live post-rework (after the scope-bug fix):**
- `fn=jefri-req6&listingId=44963099312393` → real Shopify data: `imageUpdateDate:"2024-02-29"` (897 days live), `totalSalesSinceUpdate:4537.97` — matches this listing's lifetime sales figure observed earlier in the session (consistent: all its recorded sales occurred after this 2024 image update), `preUpdateBaselineSales:0` → correctly `zeroBaseline:true`, `trend:"Insufficient data"`.
- `fn=jefri-req6&listingId=57163495964937` → `imageUpdateDate:"2026-07-01"`, sales £32.56, zero-baseline case again correctly handled.
- `fn=jefri-req6&listingId=0000000000000` (not found) → unchanged, correct `found:false`.
- `fn=jefri-req6-list` → unchanged, still 8,127 rows.
- `scripts/check-live-deploy.js` re-run — all pre-existing canaries OK, no regression to any earlier same-day fix.
- Before pushing, `git fetch` again found new Piranav commits (Jackson product ID additions to Staff ID Performance) — pulled in first, no conflicts (different files), per the standing "don't touch Piranav's work" rule.

**Status:** PASS (Shopify-live rework — superseded by a third, architectural correction below)
**Reviewer:** Kuberan (pending review)

---

## THIRD CORRECTION — 2026-08-14, same day, later in session

Kuberan questioned the architecture directly: "now the current behavior is while scroll loading data why can you made for this as snapshot method?" — the IntersectionObserver-driven live-on-scroll approach (built moments earlier, working correctly) was still the wrong shape: it redid live Shopify + Postgres work every time a row scrolled into view for anyone. This repo already has an established fix for exactly this class of problem — a scheduled snapshot job that precomputes slow data once, with the live path serving the finished static file (`jefri-req4-mapping`, `mahima-req1`, etc. all already work this way, and there's already an hourly GitHub Action, `hourly-july-snapshot-refresh.yml`, that does the pattern generically). Reused that convention instead of building something new.

**What changed:**
- New `fn=jefri-req6-snapshot-batch&cursor=N&limit=M` endpoint (`handleJefriReq6SnapshotBatch`) — processes a bounded batch of unique parent Shopify products (grouped, since every variant of one product shares the same images/Image Update Date — confirmed via SQL: ~8,127 Jefri listings resolve to only ~850 computable unique parent products with a SKU), fetching each parent's image date once and computing sales for every listing under it via a single bulk SQL query (`unnest`-based, one round trip per batch instead of 2 queries × every listing). Returns `nextCursor` to continue, `null` when done — designed to comfortably fit inside a single request (measured: 80 parents ≈ 21s).
- New `api/scripts/generate-jefri-req6-snapshot.js` — loops the batch endpoint via curl (same pattern as the existing `generate-snapshots.js`) until exhausted, writes the complete result to `api/data/jefri-req6-snapshot.json` in one shot (never a partial file).
- New `.github/workflows/jefri-req6-snapshot-refresh.yml` — runs the generator every 6 hours (image updates are infrequent; no benefit to hourly), commits the refreshed JSON, redeploys. Same commit/deploy steps as the existing hourly workflow.
- `handleJefriReq6List` now checks for the static snapshot file FIRST (same `fs.existsSync`/`staticPath` pattern as `jefri-req4-mapping`) and serves it directly with every row's data already computed — no per-row calls needed at all when the snapshot is warm.
- Frontend: `r6LoadList` seeds `R6_CALC` directly from any snapshot rows that already carry calculated fields, and `r6Render` shows real values immediately for those. The `IntersectionObserver`/`r6Calc` live-fetch path from the previous rework is kept, but now only as a **fallback** for rows the snapshot hasn't covered yet (or before the very first snapshot has ever run) — not the primary mechanism.

**Bug found and fixed during first-run testing:** the generator script's default `SNAPSHOT_BASE_URL` (`https://digital-marketing-member-pages.vercel.app` — the same default this repo's OTHER existing snapshot scripts/workflows already use) returned `DEPLOYMENT_NOT_FOUND`. Confirmed via direct curl. Switched the script's default and the new workflow's env var to the working custom domain (`https://dm-dashboard.vintageinterior.co.uk`). **Flagged, not fixed:** the pre-existing `hourly-july-snapshot-refresh.yml` and `generate-snapshots.js` still use the broken raw-Vercel-domain default — worth Kuberan checking whether that job has actually been silently failing. Left untouched since it's outside this task's scope and not something to change unilaterally.

**Verified live:**
- Batch endpoint: `cursor=0&limit=5` → real grouped data (5 parent products' variants, correct shared `imageUpdateDate` per group). `cursor=0&limit=80` → 21.5s (well inside limits).
- Full generator run: 11 batches, 4,566 rows across 850 parent products, ~2.5 minutes total, written to `api/data/jefri-req6-snapshot.json`.
- `fn=jefri-req6-list` post-deploy → `"source":"static-snapshot"`, 4,566 rows, 1.25s response (vs. the old scroll-triggered approach where every row needed its own live round trip).
- `scripts/check-live-deploy.js` — all pre-existing canaries still OK.

**Disclosed scope trim:** the snapshot only contains listings that resolve to a real Shopify SKU (~4,566 of the ~8,127 Ads-tracked items) — the remainder are Ads items with no Shopify listing match at all, which were never computable anyway (previously shown as informational "Unmatched" rows in the live-list path). The static-snapshot path currently doesn't carry those placeholder rows forward; only the live (non-cached) list path still shows them. Flagged for Kuberan/Jefri to confirm this trade-off is acceptable, or ask for the placeholders to be merged back in.

**Status:** PASS (snapshot method — superseded by a fourth, final correction below)
**Reviewer:** Kuberan (pending review)

---

## FOURTH CORRECTION (FINAL) — 2026-08-14, same day, later in session

Kuberan redefined the feature entirely: "sorry some mistake, i need first column as label user need to add the label and listing id and sku and image update date also user can add [these all] ... need to store these all and others are same, after add these all by user show all these by calculation from shopify please change all and need to store all user input permanent create table in neon and add all". Clarified via AskUserQuestion that all 4 fields (Label, Listing ID, SKU, Image Update Date) should be **fully manual** — nothing auto-filled — reversing the entire Google-Ads-campaign auto-discovery premise every prior version of this feature was built on.

**What changed (replaces everything above):**
- The feature is no longer tied to Jefri's Google Ads campaigns at all. It's a small, user-curated tracker: you add a row by typing Label, Listing ID, SKU, and Image Update Date; Days Live / Total Sales Since Update / Pre-Update Baseline Sales / % Change / Trend are still calculated automatically (unchanged formulas, validated multiple times earlier the same day), but from that manually-entered data, not from an auto-discovered listing set.
- New Postgres table `public.jefri_req6_tracker` (id, label, listing_id, sku, image_update_date, created_at, updated_at) — **on the same writable Neon database Sajeepan's existing feed-optimization tracker uses** (`FEED_TRACKER_DB_URL` / `AUTH_DATABASE_URL` fallback, exact same convention as `handleSajeepanTrackerSave` in `members-api.js`), NOT the main read-only analytics Postgres this whole file otherwise uses for everything else. Self-provisioned via `CREATE TABLE IF NOT EXISTS` on first request — no manual migration step, confirmed working live (first `fn=jefri-req6-list` call created the table with zero rows, no error).
- Three new/changed endpoints, replacing all of `jefri-req6-list` (rewritten)/`jefri-req6`/`jefri-req6-snapshot-batch`:
  - `GET fn=jefri-req6-list` — reads all tracked rows from the tracker DB, computes sales live in one bulk query against the main read-only Postgres (`unnest`-based, one round trip for every row's post + baseline window), returns the merged result.
  - `POST fn=jefri-req6-add` — body `{label, listingId, sku, imageUpdateDate}`, validates all 4 required, inserts, returns the new row's id.
  - `POST fn=jefri-req6-delete` — body `{id}`, removes a tracked row.
- Sales matching simplified: since the Listing ID is now user-typed rather than resolved through `listings.shopify_listings`, the sales query matches it directly against EITHER `order_item_info.product_id` OR `.variant_id` — no dependency on Postgres listing resolution at all anymore.
- Removed entirely as dead code: the Shopify Admin REST image-date lookup (`fetchShopifyImageUpdateDate`, `R6_SHOPIFY_STORE_DOMAIN`, `IMAGE_DATE_CACHE`), the Google Ads campaign discovery queries (`ALL_JEFRI_ITEMS_QUERY`, `GROUPED_LISTINGS_QUERY`, `getGroupedListings`), the batch-snapshot endpoint, and the snapshot generator script + GitHub Action + committed JSON file from the previous architecture.
- Frontend: replaced the auto-populated 8k-row table with an "Add" form (Label/Listing ID/SKU/Image Update Date inputs + Add button) above a much smaller table (Label, Listing ID, SKU, Image Update Date, plus the 5 calculated columns, plus a delete "×" per row). No more `IntersectionObserver`/lazy-loading — the tracked list is expected to stay small (user-curated), so it's fetched and rendered in full on every load.

**Verified live, full round trip:**
- `fn=jefri-req6-list` (empty tracker) → `{"rows":[]}`, confirmed the table auto-created with no error.
- `fn=jefri-req6-add` with a real listing (`57163495964937` / `ENC4361` / `2026-07-01`) → `{"ok":true,"id":1}`.
- `fn=jefri-req6-list` again → the row appears with `totalSalesSinceUpdate:32.56` — the exact same figure independently validated multiple times earlier in the day for this listing/date via the DB-direct, single-endpoint, and snapshot-batch versions of this feature. Confirms the simplified direct product_id/variant_id-OR match produces identical results to the old listings.shopify_listings-resolved version.
- `fn=jefri-req6-add` with missing fields → correctly rejected (`"Listing ID is required."`).
- `fn=jefri-req6-delete` → row removed, confirmed via a follow-up list call.
- `scripts/check-live-deploy.js` — all pre-existing canaries OK, no regression to any earlier same-day fix.
- Re-added a real entry (Ceiling Light 60cm) after delete-testing so the tracker isn't left empty.

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** None blocking. This is the final architecture for Req6 — add real tracked listings via the UI going forward. Two carried-over, non-blocking notes from earlier reworks: (1) the pre-existing `hourly-july-snapshot-refresh.yml`/`generate-snapshots.js` still default to a Vercel domain that returns `DEPLOYMENT_NOT_FOUND` — worth Kuberan checking if that job has been silently failing (unrelated to Req6, not touched); (2) no delete-confirmation audit trail exists yet if that's ever needed (currently a hard DELETE, no soft-delete/history).
