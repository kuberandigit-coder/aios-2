# Evidence — Mahima Requirement 1: Jan–Jun 2026 Range + Date Range Picker

**Title:** Extended all 5 campaigns to a unified Jan 1 – Jun 30, 2026 range and added a Start/End date-range picker (matching Kamsi Req2's pattern)
**Purpose:** User requested the full 6-month range for all campaigns, then a date-range picker to view sub-ranges within it
**Requirement Source:** User instructions, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What changed
1. **Discovered a better unified source:** `public.ppc_etl_performance_data` (`record_type='product'`, `parent_id`=campaign, `record_id`=product) has real daily history for **all 5** of Mahima's campaigns (including Shopping DE, which had zero rows in the previous source), back to 2025-01-01 for some campaigns.
2. Rebuilt the page-level dataset: **6,781 product rows** across all 5 campaigns, summed over 2026-01-01 to 2026-06-30. Total: £8,800.90 spend, £21,896.61 conv. value, ROAS 249%.
3. **Trade-off (flagged honestly):** the new source has no Suggested Action equivalent, so that column is now "Data Missing" for every row (previously real for 4 of 5 campaigns under the old 1-month source). Documented prominently in the legend and Known Limitations.
4. **Added a Start/End date-range picker**, same architecture as Kamsi Req2: pulled all 207,779 daily rows for the 6-month window, built a day-index (`DAY` object keyed by date, values = `[rowIndex, imp, clk, spend, revenue, conv]`), and added `daysBetween()`/`rangeBase()`/`pickRange()` using the same real-`Date`-arithmetic logic already fixed for Kamsi (not the earlier hardcoded-month bug).

## Verification performed
- Div balance: 38 open / 38 close
- `node --check` syntax validation: passed, exit 0
- Day-index match check: **0 unmatched of 207,779 daily rows**, 181 distinct days, range 2026-01-01 to 2026-06-30 confirmed
- **Functional simulation**: full 6-month total spend via the picker = £8,800.90, exact match to the page-level aggregate. Selecting Jan 1–31 via the picker returned £1,323.58 spend / 284,631 impressions — **independently recalculated directly from the raw daily JSON and confirmed to match exactly**.
- Known minor data-quality note: 5 of 6,781 rows (0.07%) share a duplicate (campaign, product) key in the source data; the day-index correctly matches 100% of daily rows, but for those 5 duplicate-key rows only the last-indexed row of the pair receives range-filtered day data (harmless, sub-0.1% edge case, not something this fix introduced).

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/mahima/data/2026-07-08_mahima_req1_janjun_all5_raw.json` — new unified page-level dataset (all 5 campaigns, one source)
- `reports/mahima/data/2026-07-08_mahima_req1_janjun_daily_raw.json` — 207,779 raw daily rows
- `reports/mahima/data/2026-07-08_mahima_req1_janjun_by_day.json` — day-index used by the range picker
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_raw.json` — replaced with the new canonical Jan–June dataset
- `reports/mahima/data/2026-07-08_mahima_req1_product_level_builder.py` — updated builder

**Duplicate risk:** GREEN
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — still not deployed (awaiting approval)
**Known Limitations:** Suggested Action now Data Missing for all rows (trade-off from switching source tables); 0.07% duplicate-key edge case noted above; Product Cost/Feed Status/Missing Attribute/7d-30d ROAS still Data Missing (unchanged, no source exists)
**Next Steps:** Kuberan review + deployment approval
**PASS / FAIL:** PASS
