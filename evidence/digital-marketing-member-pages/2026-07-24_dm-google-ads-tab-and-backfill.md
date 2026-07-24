# Evidence — New "DM" Google Ads Tab + Jan-Jun Snapshot Backfill

**Date:** 2026-07-24
**Commits:** `ca1ba6a`, `e3d2ef5`, `e507636`, `c812ee1`

## Purpose
The paid-search unclaimed-gap audit added earlier the same day (as part of the Sajeepan utm_term fix, `062cb2a`) surfaced a previously uncovered campaign: `Shop_DM_PMax-46_AguAsset` / `Our_Hreo` — 856 January orders / £19,378.72 not matched by any existing staff rule.

## What Was Done
- (`ca1ba6a`) Added a new "DM" tab to `sales.html`, mirroring the Sonya/Sajeepan/Theekshy tab pattern exactly (same backend dispatch in `api/sales.js`, same frontend structure, `dm`-prefixed globals).
- (`e3d2ef5`) January snapshot generated.
- (`e507636`) March-June snapshots generated.
- (`c812ee1`) February snapshot generated.
- Result: full Jan-Jun static snapshots + July live, matching the pattern used for Sajeepan/Sonya.

## Files Changed
- `reports/digital-marketing-member-pages/api/sales.js` (+83 lines)
- `reports/digital-marketing-member-pages/pages/sales.html` (+303 lines)
- `reports/digital-marketing-member-pages/api/data/dm-uk-ads-sales-2026-0{1,2,3,4,5,6}.json` (new)

## Status
Deployed/committed same day. Jan-Jun backfilled; July live by design (same convention as other Ads tabs).

## PASS/FAIL
PASS (reconstructed).

## Next Step
None. Confirm with user whether "DM" is the correct/final staff-facing name for this tab (not evidenced by commit message beyond the campaign name) — flagged as manual verification if a real staff name should replace "DM".
