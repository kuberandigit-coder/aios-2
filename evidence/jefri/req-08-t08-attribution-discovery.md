# Jefri Req 8 — T-08 — Attributed Date / Campaign (Step 3, Method 2) Discovery & Evidence

**Date:** 2026-08-20 · **Team Member:** Jefri · **Requirement:** T-08, Steps 3-7

## Why the original blocked conclusion changed
The original discovery (`req-08-t08-discovery.md`, `req-08-t08-postgres-source-mapping.md`) correctly found no Transaction ID data and no historized delta source in `google_ads.campaign_performance`. What changed: Kuberan pointed out (a) `campaign_performance` is not the only conversion_value-bearing table — `google_ads.product_performance` is per-product, much finer grain, and (b) a real column `google_ads.campaigns.customer_acquisition` exists (found via a second, more targeted search for "acquisition"/"bonus" terms — missed in the first discovery pass) confirming Google Ads' "New Customer Acquisition" bid strategy is active on these campaigns, and Kuberan supplied the actual bonus € amounts directly from the Google Ads UI (not present anywhere in Postgres — only the on/off flag is).

## Proof-of-concept (done BEFORE writing any code)
1. Exhaustively searched one real order's exact value (€51.61) across every `conversion_value` column in the entire ledsone.de account (198 campaigns), all-time, zero date restriction — **zero matches anywhere**. Confirmed `campaign_performance`-style exact matching genuinely does not work (it aggregates every order converting that campaign/day into one number).
2. A real example from Kuberan (order `#LSDE19240`, €171.72) matched `product_performance` conversion_value €172.72 for campaign `Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05` on the order's own date, with `conversions=1` — difference of exactly €1.00, which is that campaign's real "New Customer" bonus. Verified directly in Postgres, not just the Google Ads UI screenshot Kuberan showed.
3. Second independent order (€51.61) matched `product_performance` conversion_value €52.31 for campaign `Pmax DE | Mahi | Klarna | DE | All_Myid | MCV`, `conversions=1`, difference exactly €0.70 — that campaign's real "New Customer" bonus. Two independent exact-to-the-cent matches confirmed the method works, not coincidence.

## Important limitation found (verified, not assumed)
Fetched order `#LSDE19240`'s actual Shopify line items via GraphQL — the real purchased product ("Vintage Billardlampe...") differs from the product on the matched `product_performance` row ("Gestufte Pendelleuchte..."). This confirms Google Ads Shopping/PMax can attribute conversion value to whichever product ad was last clicked, not necessarily what ended up in the cart. **Matching is therefore done on Campaign + Date + Value only — never on product identity** — no Shopify-line-item-to-Merchant-Center-item resolution is used or needed.

## Bonus values (supplied by Kuberan, not in Postgres)
All 16 currently-active campaigns (Jefri/Thasi/Mahima's) resolved to real `campaign_id`s via a live query, with New Customer / High Value Customer bonus € amounts hardcoded in `jefriReq8HandlerModule.ACTIVE_CAMPAIGN_BONUS` (api/requirement.js). Two campaigns (`AOVU15`, `TOP-MAHI`) only have one bonus value supplied (New Customer only).

## Method implemented
For each order: search `product_performance` (campaign_id IN the 16 known campaigns, date within order date −1 to +3 days, `conversions=1`) for rows where `conversion_value` equals the order value exactly, or exactly minus that campaign's New Customer bonus, or exactly minus its High Value Customer bonus (±€0.03 tolerance — real matches seen were exact to the cent). Zero candidates -> "No match". Exactly one -> "Matched". More than one -> "Ambiguous" (shown for review, never silently resolved).

## Real result on live data (19-20 Aug 2026, 44 orders)
20 Matched, 2 Ambiguous, 22 No match.

## Status
Live in production since 2026-08-20. Explicitly labeled as Method 2 (inferred), per T-08's own Step 7 caveat — not proof, not Transaction ID passthrough.
