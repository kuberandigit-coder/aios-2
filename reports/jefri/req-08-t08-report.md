# Jefri Req 8 — T-08 Order Conversion Split by Campaign Date — Report

**Status: BLOCKED** (discovery-stage stop, per the governing prompt's own explicit STOP conditions — no implementation attempted, no data invented, no code changes made).

## Summary
T-08 requires matching Shopify orders to Google Ads campaign+date conversion attribution, either exactly (via Transaction ID) or by inference (via a "Current Update − Last Update" delta, adjusted for bid bonuses). Read-only PostgreSQL discovery confirmed that **none of these required data sources exist in the connected database**: no Google Ads transaction/conversion-level table (only campaign+date aggregates), no historical/versioned snapshot to compute deltas from, no bid-adjustment data, and no UTM data for the independent "Order Summary" field.

## Purpose / Business Question
For each Shopify order in a date range, show which Google Ads campaign(s) and date(s) received its conversion value — correctly split when an order's value was attributed across more than one campaign/date, reconciled to ±1 of the order's actual value.

## Requirement Source
`prompts/jefri/req-08-t08-update-prompt.md` (the CSV referenced in the original prompt, `/mnt/data/What_I_Need_To_Improve_ADS_Performance - Jefri.csv`, was not accessible in this environment — the prompt's own embedded 13-step logic was used as authoritative instead, per the prompt's explicit instruction).

## Existing Assets Checked
`prompts/jefri/`, `evidence/jefri/`, `validation/jefri/`, `handover/jefri/`, `reports/jefri/`, `vercel/jefri/` (grepped, no prior T-08 work) + direct inspection of `pages/jefri.html` (Req1–7 confirmed present, no overlap). **Duplicate-risk: GREEN.**

## PostgreSQL Objects Checked (read-only)
- `google_ads` schema — all 21 tables enumerated; full column list of `google_ads.campaign_performance` (the only campaign+date-level conversion_value table) inspected.
- Whole-database search (not schema-scoped) for `%transaction%`, `%conversion%`, `%offline%`, `%attribution%`, `%utm%` table names.
- `order_management.orders` columns matching UTM/source/medium/campaign/term/shipping/total/tax/id.

## Data Mapping (partial — Google Ads side incomplete, blocking)
| Requirement Field | Source | Status |
|---|---|---|
| Order Number | `order_management.orders.order_id` | Plausible, not yet verified |
| Order Value Excl. Shipping | `order_management.orders.sub_total` (candidate) | Plausible, not yet verified against real order arithmetic |
| Order Summary (UTM) | — | **No source exists** |
| Campaign / Attributed Date / Conv. Value per campaign-date | `google_ads.campaign_performance` (campaign_id, date, conversion_value) | Exists, but **only as a campaign+date aggregate — no order-level linkage possible** |
| Transaction ID (Method 1) | — | **No source exists anywhere in the database** |
| Current Update / Last Update (Method 2 Delta) | — | **No source exists — table is flat/overwritten, not versioned** |
| Bid adjustment (Step 4) | — | **No source exists** |

## Implementation
None — no code was written, no `pages/jefri.html` changes made, per explicit governing-prompt STOP-condition instructions.

## Files Modified
None (HTML/code). AIOS documentation files only (listed in handover).

## Validation
See `validation/jefri/req-08-t08-validation.md` — full checklist, all data-dependent items correctly marked ❌/N/A rather than fabricated as passing.

## AIOS Evidence
- `prompts/jefri/req-08-t08-update-prompt.md`
- `evidence/jefri/req-08-t08-discovery.md`
- `evidence/jefri/req-08-t08-postgres-source-mapping.md`
- `validation/jefri/req-08-t08-validation.md`
- `handover/jefri/req-08-t08-handover.md`
- `vercel/jefri/req-08-t08-vercel-deployment.md`

## Duplicate Risk
**GREEN** — no existing capability answers T-08.

## Known Limitations
Entire Google Ads side of this requirement (Transaction ID, Delta, bid adjustment) has no current data source. UTM-based Order Summary also has no data source, independently. Shopify-side fields (order number, order value excl. shipping) look plausible but were not verified end-to-end since the task stopped before reaching implementation.

## Deployment
**NOT APPLICABLE** — no code exists to deploy.

## Final PASS/FAIL (as of original discovery)
**BLOCKED.**

---

# UPDATE — 2026-08-20: built and deployed incrementally, live in production

**Status: PARTIAL PASS.** Built step by step per Kuberan's explicit instruction, using real data Kuberan supplied that the original discovery didn't have access to (Google Ads bid-bonus € values, only available via the Google Ads UI, not Postgres).

## What's live now
1. **Order Number + Order Value (Excl. Shipping)** — direct from Shopify Admin API, not Postgres.
2. **Order Summary** — Shopify's own `customerJourneySummary` (Conversion Summary data), classified Google Ads/Meta Ads/Direct/Organic/Other, campaign-matched where UTM tags confidently identify one of the known campaigns.
3. **Campaign + Attributed Date** — Method 2 (inferred), matching each order's value against `google_ads.product_performance` (`conversions=1` rows) minus real campaign-specific bonus amounts, labeled Matched/Ambiguous/No match. Proven with two independent, exact-to-the-cent real-order matches verified in Postgres before any code was written.

## Real validation (44 real orders, 19-20 Aug 2026)
20 Matched, 2 Ambiguous, 22 No match. Filters added: Order Summary type, Attribution status, Campaign (dynamic), plus CSV export.

## Files added this update
`evidence/jefri/req-08-t08-order-summary-discovery.md`, `evidence/jefri/req-08-t08-attribution-discovery.md`

## Known Limitations (updated)
- Method 1 (Transaction ID) still confirmed unavailable — unchanged from original discovery.
- Matched `product_performance` rows are NOT necessarily the literal product purchased (verified on a real order) — matching is Campaign+Date+Value only.
- Steps 8-10 (per-campaign/date row splitting + reconciliation) and Step 12 (Attributed-Date-based filtering) not yet built.
- "No match" (22 of 44 orders) is an honest inference-method limitation, not a data error.

## Deployment (updated)
**LIVE** on `dm-dashboard.vintageinterior.co.uk` — `pages/jefri.html` Requirement 8 tab, `api/requirement.js` `jefriReq8HandlerModule`.

## Final PASS/FAIL (current)
**PARTIAL PASS** — Steps 1-3 implemented, deployed, and validated against real data. Steps 8-10, 12 remain unbuilt. Method 1 remains genuinely unavailable.
