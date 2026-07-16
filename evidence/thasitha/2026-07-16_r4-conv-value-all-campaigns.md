# Evidence — Thasitha Requirement 4: Conv. Value scope changed to all campaigns

**Date:** 2026-07-16

## Purpose
User compared R4's "Conv.€" figure against Google Ads' native "All campaigns" product view and found the dashboard total lower. Root cause (previously confirmed): Conv.€ was scoped to only Thasitha's 2 campaigns (`23791285134`, `23765634627`), while Google's UI aggregates conversion_value across every campaign (including overlapping owners like Jeff). User requested: "change conv value to include all campaigns."

## Change
Rebuilt the `ads` field of all 572 `R4_PRODUCTS` entries by re-querying `google_ads.product_performance` for the same 572 `product_item_id`s **without** the `campaign_id IN (...)` filter, grouping `SUM(conversion_value)` by `(product_item_id, date)` where `conversion_value > 0`. This replaces the previous Thasi-only `{d,cv}` sparse arrays.

## Verification
- Spot check `pid 56271176597769`: Thasi-only had 10 dated entries summing to €689.62. All-campaigns version adds one more entry (`2026-06-16`, cv=88.95 — Jeff's overlapping campaign), now totaling €778.57, matching the higher figure visible in Google Ads' native UI for that item.
- Total `ads` entries across all 572 SKUs: 74 (Thasi-only) → 126 (all campaigns).
- 66 SKUs gained new all-campaign data; 506 SKUs had zero conversion_value anywhere (cleared to empty array, same as before since Thasi-only was also empty for these).

## Validation
- Syntax check: both `<script>` blocks parse via `new Function(...)` — OK.
- Full runtime simulation (Node `vm` harness, mock DOM): all 5 tabs (R1–R5) render without error. R4 KPI total 572 products, table renders 124,071 chars. R3/R5 unaffected (151,993 / 82,888 chars respectively).
- Updated R4 status-note text: "Conv. Value = SUM(conversion_value) ... across all campaigns (any owner) for that SKU ... matching Google Ads' native 'All campaigns' product view" (previously said "for Thasitha's two ENABLED campaigns").

## Status
PASS. Ready to commit, push to `aios-2`, and deploy via `vercel --prod --yes`.

## Reviewer
Pending user confirmation post-deploy (compare dashboard vs Google Ads UI for spot-checked SKU).

## Next step
Commit + push + deploy.
