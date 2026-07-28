# SUK-R5 — Handover

**Title:** Low-Stock Alerts — Handover
**Requirement ID:** SUK-R5
**Purpose:** Allow another engineer/LLM to continue, deploy, or debug this work without re-deriving context.
**Business Question:** Which products/variants on ledsone.de currently have low stock and require attention?
**Shopify Store:** ledsone.de
**Shopify Objects/Fields Used:** see `evidence/sukirtha/SUK-R5-shopify-source-map.md`
**Inventory Locations:** single active location "LEDSone DE LTD"
**Current Stock Logic:** SUM(`available`) across operational locations, null if untracked
**Low-Stock Threshold Source:** user-confirmed in conversation 2026-07-27 — Current Stock < 10 (not inferred/invented)
**Status Logic:** Not Assessable → Low Stock (<10) → OK
**Refresh Architecture:** Browser → `/api/requirement?fn=req2-req3&req=5` → Shopify Admin GraphQL (ledsone-de.myshopify.com) → sanitized JSON → table/cards/timestamp update

## Files Modified

1. `reports/digital-marketing-member-pages/pages/sukirtha.html`
   - Added `Requirement 5 · Low-Stock Alerts` tab button (`tabBtn5`) and content block (`reqTab5`), after Requirement 4, following the exact same header/cards/tablebox/footnotes structure as R2/R3.
   - Extended `showReqTab(n)` to handle `n === 5` and lazy-load on first view (`r5Loaded`).
   - Appended a full R5 JS section at the end of the `<script>` block: `r5loadCachedOrFetch`, `r5load` (fresh fetch, "Refreshing Shopify inventory..." / "Unable to refresh Shopify inventory." states), `r5applyLoadedData`, `r5renderCards`, `r5filteredRows` (search SKU/Product ID, Status, Product Status, Inventory Location filters), `r5sortBy` (default sort key `currentStock` ascending), `r5render` (pagination, expandable detail row with Product Title/Variant Title/Variant ID), `r5exportCsv` (exports the currently filtered view), and matching event listeners. Uses the existing IndexedDB cache helpers (`idbGet`/`idbSet`) with a new key `suk_r5_cache_v1`, same pattern as R2/R3.
   - Nothing in Requirements 1–4's markup, IDs, or functions was touched.

2. `reports/digital-marketing-member-pages/api/requirement.js`
   - Inside the existing `req2Req3HandlerModule` IIFE (same scope as `handleReq2`/`handleReq3`, sharing its `shopifyGraphQL`/`STORE_DOMAIN`/`SHOPIFY_ADMIN_TOKEN` setup): added `R5_LOW_STOCK_THRESHOLD = 10`, `r5ComputeStatus(currentStock, tracked)`, and `handleReq5(req, res)` which reuses `r3FetchAllVariants()` (no new Shopify query — same product/variant/inventory shape already used by SUK-R3) and returns `{ summary, rows }` with `summary.lowStockThreshold`, `summary.inventoryLocations`, counts (totalProducts/totalVariants/totalCurrentStock/lowStockCount/okCount/outOfStockCount/missingSku/inventoryNotTracked).
   - Extended `req2Req3Handler`'s dispatcher to route `?req=5` to `handleReq5` (alongside existing `?req=2` default and `?req=3`). No new Vercel serverless function was created — stays under the Hobby plan's 12-function cap by reusing the merged `req2-req3` endpoint, matching the project's existing convention.
   - No credentials were added or changed; `SHOPIFY_ADMIN_TOKEN` guard already existed and covers R5 too.

## Continuing This Work

- To verify live: deploy to Vercel (not yet done — awaiting approval, see `vercel/sukirtha/SUK-R5-deployment-readiness.md`), open the Sukirtha member page, click "Requirement 5 · Low-Stock Alerts", confirm the table populates and "Refresh Data" triggers a new fetch.
- If the threshold ever changes, update the single constant `R5_LOW_STOCK_THRESHOLD` in `api/requirement.js` and the two footnote/chip text references in `sukirtha.html` (`reqTab5` header) — do not hardcode the number elsewhere.
- If ledsone.de ever adds a second active inventory location, no code change is needed — `r3FetchAllVariants()` already sums across all returned `inventoryLevels` edges.

## Evidence Location

`evidence/sukirtha/SUK-R5-shopify-source-map.md`, `evidence/sukirtha/SUK-R5-inventory-validation.md`

## Validation Result

See `validation/sukirtha/SUK-R5-validation-report.md` — PASS (code-level), live browser verification pending deployment.

## Status

Implementation complete. Not yet deployed/pushed (per instructions, no git push or Vercel deploy without explicit approval).

## Known Limitations

- Not yet verified against live production Shopify data in a browser.
- CSV export not yet byte-verified by downloading an actual file.

## Next Step

Get user approval to deploy to Vercel and/or push to GitHub, then perform live browser verification of Requirement 5 end-to-end.

## PASS / FAIL

PASS (implementation + code validation)

Owner: Sukirtha · Coordinator: Kuberan · Technical Reviewer: Sajeesan · Queryability Reviewer: Tamil Selvan · Business Validator: SEO Lead
