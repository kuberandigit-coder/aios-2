# Evidence — Thasitha Requirement 2: PMax Product Zero-Performance — Live Refresh

**Title:** Req2 live refresh — data source verification
**Purpose:** Record what was found analyzing the static page, and the sources used to rebuild it live.
**Requirement Source:** prompts/thasitha/2026-07-29_requirement-2-live-refresh-prompt.md

## Analysis finding (before any code change)
`thasitha.html` contained a hardcoded `const R2_PRODUCTS = [...]` array (~831 rows, ~900KB of embedded JSON) baked in at build time 2026-07-15/16 — no `fn=thasitha-req2` endpoint existed in `api/requirement.js`, no refresh button, no live fetch. Confirmed via `grep`/code read: only `thasitha-req1` and `thasitha-req3` dispatch entries existed.

Also found: the live page's "Data Check" column (Approved/Not Approved/Not in Merchant Center Feed) contradicted `evidence/thasitha/2026-07-15_requirement-2-pmax-zero-performance-discovery.md`, which states real GMC approval status was confirmed structurally unavailable and the column was supposed to be removed by user instruction. Reported this to the user; user decided to keep the column and reuse Mahima's derived proxy.

## PostgreSQL Sources Used
- `google_ads.campaigns` (`group_name = 'Thasi'`) — campaign_id, campaign_name, budget. Live-verified: 3 campaigns now (the original 2 PMax campaigns plus a new one, `24051146082` "Shopping DE | Mahi..." — actually `Pmax | Thasi | Klarna | SUMT | NewProduct | MCV -22/07`, added 2026-07-22, which the old static build could never have picked up).
- `google_ads.product_performance` — impressions/clicks/cost/conversions/conversion_value per campaign×product, trailing 30-day window anchored to the live max date. `MIN(date)` per campaign×product used as "Date Added" proxy (same method as the original 2026-07-15 build), days live computed live as `range_end - first_date`.
- `google_ads.merchant_products` — title/image/link/availability, deduped `DISTINCT ON (product_id)` preferring `lan='de'` (same dedup rule as the original build).
- `raw_data.gmc_product_diagnostics_daily` — re-confirmed does not exist (live, 2026-07-29).

## Shopify Sources Used
- Live stock via Shopify Admin GraphQL (`ledsone-de.myshopify.com`, `SHOPIFY_ADMIN_TOKEN`), same technique as Mahima Req1/Req2 — `product_item_id` values for this scope are already Shopify variant IDs (confirmed live: 738 of 926 rows returned a real quantity).

## Bugs found and fixed during build (live-tested against production)
1. `fetchLiveStock` from Mahima's module is scoped inside a different IIFE closure and wasn't reachable from the new `thasithaReq2HandlerModule` — calling it silently threw "not defined", caught and surfaced as a generic stock error for every row. Fixed by adding a self-contained `t2FetchLiveStock`/`t2ShopifyGraphQL` inside the new module (same pattern already used by `kamsiLiveHandlerModule`).
2. `first_date` from `pg` comes back as a JS `Date` object; `String(date)` produces a locale string ("Mon Apr 27") not ISO. Fixed with `.toISOString().slice(0,10)`.
Both confirmed fixed via live curl re-checks after redeploy.

## Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js` — new `thasithaReq2HandlerModule`, dispatch `fn=thasitha-req2`.
- `reports/digital-marketing-member-pages/pages/thasitha.html` — removed the ~900KB static `R2_PRODUCTS` array, added live fetch/refresh/IndexedDB-restore wiring matching Req1/Req3's pattern.
