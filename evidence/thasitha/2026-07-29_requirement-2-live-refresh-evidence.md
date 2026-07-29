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

## Follow-up fix: missing images/titles for the new campaign (2026-07-29, same day)
User reported missing product images/data for Thasitha's newest campaign (`24051146082`, "Pmax | Thasi | Klarna | SUMT | NewProduct | MCV -22/07", added 2026-07-22). Investigated live: this campaign has 226 distinct products, but only 33 (15%) had a matching row in `google_ads.merchant_products` — 193 genuinely don't exist there yet (0 rows, any country/channel), because the campaign is only 7 days old and Google's merchant feed export hasn't caught up. Not a query bug — a real sync-lag gap.

Fix (pass 1): extended `T2_NODES_QUERY` (the same live Shopify variant lookup already used for stock) to also request `product { title, handle, featuredImage { url } }`, and added a fallback in `handleThasithaReq2` — when `merchant_products` has no title/image/link for a product, use the live Shopify value instead. Confirmed live: title coverage for this campaign went from 33/226 (15%, feed-only) to 191/223 (86%).

Fix (pass 2, same day): user reported a specific still-missing product (`15604018675977`, "Product ID Coverage" tab screenshot). Investigated: this and 127 other still-missing rows across ALL campaigns (not just the new one — correlation with days-live was ruled out, dl ranged 2-100) genuinely don't resolve as Shopify variant nodes via the Admin GraphQL API either. Found a better source live: `listings.shopify_listings` (channel='LEDSone DE') — checked coverage, 458 of 463 products missing from `merchant_products` resolve there (99%). Added it to the SQL as a second `COALESCE` fallback (`merchant_products.title` → `listings.shopify_listings.title`, same for image/link), keeping a separate `merch_title` column so the Data Check "nofeed" classification still correctly reflects real `merchant_products` absence rather than being masked by the fallback. Confirmed live: title/image coverage is now 922/926 (99.6%).

Fix (pass 3, same day): user asked where "Stock Status" (In Stock/Out of Stock/Unknown) comes from and why it still showed Unknown for products fixed in pass 2. Root cause: `av` was only ever read from `merchant_products.availability` — the pass-2 fallback only backfilled title/image/link, not availability, so products resolved via `listings.shopify_listings` still had no stock-status signal. Fixed by deriving Stock Status from the already-fetched live Shopify quantity (`qty > 0` → in stock, `qty === 0` → out of stock) whenever `merchant_products.availability` is absent — live Shopify data is the most authoritative source anyway (`listings.shopify_listings.quantity` was checked and rejected as a fallback since it's a periodic sync snapshot, not live).

## Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js` — new `thasithaReq2HandlerModule`, dispatch `fn=thasitha-req2`.
- `reports/digital-marketing-member-pages/pages/thasitha.html` — removed the ~900KB static `R2_PRODUCTS` array, added live fetch/refresh/IndexedDB-restore wiring matching Req1/Req3's pattern.
