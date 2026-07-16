# Evidence — Thasitha Requirement 3: Hide zero-conversion "other campaigns" from overlap table

**Date:** 2026-07-16

## Purpose
User compared R3's overlap detection against Google Ads live UI for SKU `15367600439561` vs the "Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE-12/05" campaign. Verified via DB that the campaign genuinely served this product (real impressions/clicks/cost recorded by Google Ads' own reporting API on 2026-07-14/07-15), but it has **zero conversions** for this SKU. User asked to hide this kind of low-signal, non-converting overlap from the R3 table going forward (chosen option: "Hide campaigns with zero conversions").

## Change
`otherCamps` filter in `r3ComputeRow()` (thasitha.html) changed from:
```js
const otherCamps = camps.filter(function(c){ return !c.isThasi && c.isCurrentlyActive; })...
```
to:
```js
const otherCamps = camps.filter(function(c){ return !c.isThasi && c.isCurrentlyActive && c.conv>0; })...
```
An external campaign now only counts as an "overlapping" campaign if it has at least one conversion for that SKU in the selected date range, in addition to being currently active. Campaigns with clicks/cost but zero conversions (like AOVU15 for this SKU) are excluded — SKUs with no remaining converting overlap fall back to the existing "NO OVERLAP" row behavior (Camp.1 only, blank overlap fields), same code path as before.

## Status-note update
Added one line under the existing R3 default-date-range note: "Overlap qualification: an external (non-Thasitha) campaign only counts as 'overlapping' if it has at least one conversion for that SKU in the selected range — a campaign that only spent budget/got clicks with zero conversions is not shown, since it isn't a confirmed sales overlap."

## Validation
- Syntax check: both `<script>` blocks pass `new Function(...)`.
- Full runtime simulation (Node vm harness): all 5 tabs render without error. R3 table body shrank from 151,993 to 117,398 chars (confirms filter is active and reducing shown overlaps), R3 KPI/other tabs otherwise unaffected.

## Status
PASS. Deployed to production.
