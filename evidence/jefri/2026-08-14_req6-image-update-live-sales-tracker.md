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

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** None — feature complete and live with fully automatic, Shopify-sourced Image Update Date. Only open question for Jefri: currency display (£ vs €).
