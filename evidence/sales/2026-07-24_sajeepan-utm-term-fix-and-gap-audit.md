# Evidence — Sajeepan Google Ads utm_term Fix + Paid-Search Gap Audit

**Date:** 2026-07-24
**Commits:** `e65fa5e`, `062cb2a`, `b2c115c`

## Purpose
A deep audit of every real `utm_term` recorded on January UK orders (not just ones already classified as Sajeepan's) found 4 recurring terms user-confirmed as hers: `GENAI`, `Top_SELL`, `unnai_nampu`, `Wall_Light`. Two of them (`GENAI` under campaign `Shop_DM_PMax-25`, `Wall_Light` under `Shop_SJ_PMax-25`) were **not** in her existing 11-campaign whitelist added 2026-07-22 — meaning 144 real orders / £4,731+£12 net sales were silently excluded from her tab every month.

## What Was Done
1. (`e65fa5e`) Layered a `utm_term` match (7 confirmed values, including the literal `"{keyword}"` ValueTrack placeholder) **on top of** the existing campaign-name rule — an order counts if EITHER matches, so the proven campaign rule is supplemented, not replaced. Added a `matchedOn` field (`'campaign'` vs `'utm_term'`) to each row for transparency.
2. (`062cb2a`) Regenerated Jan-May and Jul snapshots with the corrected rule. Added a paid-search unclaimed-gap audit to the `uk-total-debug` endpoint (surfaced the DM-tab opportunity documented separately).
3. (`b2c115c`) June snapshot finally succeeded after 8 prior attempts (recurring Shopify timeout specific to that month).

## Files Changed
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/scripts/bulk-sajeepan-refresh.js` (new)
- `reports/digital-marketing-member-pages/api/data/sajeepan-uk-ads-sales-2026-0{1,2,3,4,5,6,7}.json`

## Status
Deployed/committed same day. All 7 months (Jan-Jul) refreshed with the corrected rule.

## PASS/FAIL
PASS (reconstructed).

## Next Step
None — the gap audit's other finding (DM tab) is tracked separately in `evidence/digital-marketing-member-pages/2026-07-24_dm-google-ads-tab-and-backfill.md`.
