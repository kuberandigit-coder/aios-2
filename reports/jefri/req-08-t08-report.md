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

## Final PASS/FAIL
**BLOCKED.**
