# Handover — Mahima Requirement 1: Product Performance Report — STOPPED

**Title:** Continuation notes for Mahima Req 1
**Purpose:** Give Kuberan clear options to unblock this task
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Team Member:** Mahima · **Reviewer:** Kuberan
**PostgreSQL Sources Checked:** Yes, read-only (see evidence file for full detail)

## Where things stand
All the correct PostgreSQL tables for this report were found and confirmed:
- **Ads metrics:** `public.google_product_performance` (join via `product_item_id = google_merchant_products.product_id`, then filter `google_merchant_products.merchant_id` to ledsone.de's 4 active merchant IDs: `274357352`, `5351990695`, `5349761386`, `5348836557`)
- **Product catalog/price/stock:** `public.google_merchant_products`
- **Store mapping:** `public.google_merchants`
- **Feed status schema (empty):** `raw_data.gmc_product_diagnostics_daily`
- **Product cost schema (empty/unverified):** `development.sku_cogs`, `staging_ai.cppc_cogs_truth_model_v1`

But 3 real blockers stop the build:
1. **Stale Ads data** — no rows newer than 2025-04-28 (14+ months old). "Last 30 Days" as literally specified returns nothing.
2. **No product cost anywhere** — every candidate source is empty or has all-NULL verified values.
3. **No feed status data** — `gmc_product_diagnostics_daily` is completely empty.

## Options for Kuberan to choose from
1. **Wait for data pipelines to be fixed** — someone needs to re-run/refresh the Google Ads product performance ETL and the GMC diagnostics + COGS pipelines before this report can show real, current numbers. This is the "do it right" option but has no timeline I can commit to.
2. **Build with the stale data, clearly labeled** — use the most recent available 30-day window *within* the data (e.g. ~2025-03-29 to 2025-04-28) instead of "last 30 days from today," and label it prominently as historical/stale data pending a refresh. Still blocked on cost and feed status (would show "Data Missing" for those columns/KPIs across all rows).
3. **Build a reduced-scope version now** — drop Product Cost/Gross Profit/Profit After Ads and Feed Status/Missing Attribute from the "live" dashboard (mark them "Data Missing" as the task allows), keep everything else (impressions, clicks, CTR, CPC, cost, conversions, ROAS, stock status from `google_merchant_products.availability`), and adjust the Suggested Action rule to only use the criteria that have real data (e.g. drop the profit/feed-status legs of the rule, document this reduction clearly). Still blocked by the stale-date issue from option 1/2.
4. **Escalate to find out why 3 pipelines are simultaneously stale/empty** — this pattern (Ads data frozen at April 2025, COGS table empty, GMC diagnostics empty) suggests a broader ETL/ingestion problem worth investigating on its own, independent of this report.

## Recommendation
Option 4 first (this looks like a real operational issue, not just a report-scoping question), then likely option 2 or 3 depending on how urgently Mahima needs *something* live versus needing it to be current and complete.

## Next step
Waiting on Kuberan's decision on which option (or combination) to proceed with. No HTML has been built or deployed. No PostgreSQL data was modified.
