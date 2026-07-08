# Evidence — Kamsi Req2: Custom Date Range Filter (Start Date / End Date)

**Title:** Added Start date / End date range inputs alongside the existing single-day picker; same date = single-day view, different dates = aggregated range view
**Purpose:** User request — view aggregated totals across a custom date range, not just one day at a time
**Requirement Source:** User instruction, 2026-07-08 (reference screenshot: Google Ads-style Start date / End date pair)
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan
**Scope confirmed with user beforehand:** June 2026 only (data does not extend into July)

## What was built
- Added two new date inputs (`rangeStart2`, `rangeEnd2`, both `min="2026-06-01" max="2026-06-30"`) next to the existing single-day picker (`daypick2`).
- Generalized the day-filter logic: replaced `dayBase(day)` (single day only) with `rangeBase(start,end)`, which sums impressions/clicks across every day in the selected range per page, recomputes CTR (`clicks/impressions`) and Avg Position (mean of the days with data) and the Low CTR flag from the aggregated totals.
- `pickDay2(day)` (the existing single-date picker) now sets both `curStart2` and `curEnd2` to the same date, keeping the single-day view working exactly as before, and keeps the two range inputs in sync.
- `pickRange2()` reads both range inputs; if only one is filled it treats it as a single day; if start is after end, it swaps them; if both are cleared, reverts to Full Month.
- Label updates dynamically: "Full Month", "Jun 5, 2026" (single day), or "Jun 1 – Jun 5, 2026" (range).
- "Clear (Full Month)" button now clears all three date controls at once.

## Bug found and fixed before shipping
- `pickRange2` is called via an inline `onchange="pickRange2()"` attribute, which requires the function to be in **global** scope — but it's defined inside Req2's IIFE. It was not exposed on `window` in the first draft (only `pickDay2` was). This would have made every range selection silently do nothing (`pickRange2 is not a function`). Caught by a Node.js functional simulation *before* deployment, not after — fixed by adding `window.pickRange2=pickRange2` alongside the existing `window.pickDay2` exposure.

## Verification performed
- **Consistency check:** selecting the same date via the range inputs (start=end=2026-06-05) produces byte-identical table output to selecting that date via the original single-day picker.
- **Aggregation correctness:** for range 2026-06-01 to 2026-06-05, the top page's impressions came out to exactly **3,462** in simulation — cross-checked by manually summing that page's daily impressions across those 5 days directly from the raw dataset in Python: **3,462, exact match.**
- Div balance: 158 open / 158 close
- `node --check` syntax validation: passed, exit 0
- Live deployment fetch confirmed both range inputs and the `window.pickRange2` exposure are present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_before_req2_date_range_backup.html` — safety backup before this change

## What was explicitly NOT touched
- No new data fetch needed — reuses the existing June-2026 `d2day` dataset (GSC-API-sourced, from the earlier pass)
- Req1, Req3, Req4, Req5 tabs unaffected
- No PostgreSQL/GSC API calls made in this pass (pure client-side aggregation of already-embedded data)

## Deployment
Deployed to Vercel production and verified live: HTTP 200, both range inputs present, exposure fix confirmed live, all 5 tabs intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** Constrained to June 2026 only, per explicit user confirmation; extending into July would require an additional GSC fetch pass.
**Next Steps:** none unless July range support is requested later
**PASS / FAIL:** PASS
