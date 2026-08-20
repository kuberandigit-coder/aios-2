# Jefri Req 8 — T-08 — Discovery & Existing-Asset Search

**Title:** T-08 Order Conversion Split by Campaign Date — discovery phase
**Purpose:** Determine whether T-08 can be implemented on `pages/jefri.html`, per the governing prompt's mandatory discovery-before-code process.
**Requirement Source:** `prompts/jefri/req-08-t08-update-prompt.md`
**Team Member:** Jefri · Channel: Google Ads
**Requirement:** T-08

## Business question
For each Shopify order in a selected attributed-date range, which Google Ads campaign(s)/date(s) received the conversion value, split correctly (not double-counted, not collapsed) when an order's conversion value was attributed across more than one campaign/date.

## Existing assets checked (before any code)
- `prompts/jefri/`, `evidence/jefri/`, `validation/jefri/`, `handover/jefri/`, `reports/jefri/`, `vercel/jefri/` — grepped for `T-08|Req.?8|Order Conversion Split|Transaction ID` (case-insensitive). No prior work found.
- `pages/jefri.html` inspected directly — confirmed Requirements 1–7 exist (`data-req="req1"` through `"req7"`); no existing tab or logic addresses order-to-campaign conversion splitting.
- **Duplicate-risk: GREEN** — no existing capability answers this question, confirmed before any Postgres inspection.

## PostgreSQL Source Checked
Read-only only (SELECT + `information_schema` queries — no INSERT/UPDATE/DELETE/DDL issued at any point). Full detail: `evidence/jefri/req-08-t08-postgres-source-mapping.md`. Summary of what was checked:
- Every table in `google_ads` schema (21 tables) via `information_schema.tables`.
- Full column list of `google_ads.campaign_performance` (the only table with campaign+date-level `conversion_value`).
- Whole-database search (not schema-scoped) for tables named `%transaction%`, `%conversion%`, `%offline%`, `%attribution%`, `%utm%`.
- `order_management.orders` columns matching UTM/source/medium/campaign/term/shipping/total/tax/id patterns.

## Result: STOP condition triggered (per prompt section 24)
This governing prompt explicitly lists these exact STOP conditions, and this discovery triggered four of them simultaneously:
- **"Transaction ID logic is unclear"** — actually worse than unclear: confirmed **absent**. No Google Ads transaction-ID/conversion-level table exists anywhere in this database (only campaign+date aggregates).
- **"Delta source is unavailable"** — confirmed absent. `campaign_performance` has no "current update"/"last update" pair or any historical versioning; it's a flat, overwritten-in-place aggregate table.
- **"bid adjustment source is unavailable when Method 2 is required"** — confirmed absent, and moot anyway since Method 2's own Delta input doesn't exist.
- **"required data does not exist"** — also true independently for the UTM-based "Order Summary" field (no UTM table/column anywhere in the DB).

Per the prompt's own instruction: *"Do not work around a stop condition silently."* This task is being reported as **BLOCKED**, not force-completed with invented logic, fabricated deltas, or a fake bid-adjustment source.

## What WOULD need to exist for T-08 to become buildable
1. A Google Ads conversion-level (not campaign-aggregate) data feed that includes Transaction ID / Order Number per conversion — e.g. from Google Ads' own "Conversions" or "Offline conversion imports" report, ingested into a new table.
2. If Transaction ID isn't available even at the source, a historized/snapshotted version of `campaign_performance` (e.g. captured daily into an append-only log) so day-over-day deltas per campaign+date can actually be computed.
3. A bid-strategy-bonus data source (Google Ads doesn't always expose this at all via API — would need confirming with Jefri/Google Ads UI whether this is even extractable).
4. A UTM-tracking data source for Shopify orders (e.g. `order_management.orders` extended with `utm_source`/`utm_medium`/`utm_term`, or a separate marketing-attribution table) — this affects only the "Order Summary" column, independent of the Google Ads blockers above.

## Status
**BLOCKED at discovery** — no HTML/code changes were made to `pages/jefri.html`, per the prompt's own STOP-condition instructions (no workaround, no invented data).

## Next Step
Report back (this task's "Final Response to GPT" — see `handover/jefri/req-08-t08-handover.md`) with the specific missing data sources listed above, so a decision can be made on whether to build a new Google Ads conversion-level import, or whether T-08 should be descoped/redefined against what the source systems can actually provide.
