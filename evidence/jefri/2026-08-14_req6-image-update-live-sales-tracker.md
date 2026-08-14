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

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** None — feature complete and live. Await Jefri's real-world usage feedback on the €/£ display question.
