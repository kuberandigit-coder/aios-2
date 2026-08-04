# Jefri Req2 — Campaign-Wise Breakdown + Filter (Validation)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## What was validated

- `node --check` on `api/requirement.js` before each deploy — syntax clean.
- Live endpoint test (`/api/requirement?fn=jefri-search-terms&refresh=1`) after deploy:
  `success:true`, `campaignList` has 5 entries, `campaignSummary` has 5 entries with
  plausible counts, sample row carries `campaignId`/`campaignName`.
- Confirmed a first deploy attempt failed (`JEFRI_CAMPAIGNS is not defined` — Req1's
  campaign list lives in a separate, inaccessible closure) via `vercel logs`, root-caused,
  fixed with a local copy, redeployed, re-verified successful.
- Confirmed the frontend UI elements (`r2f_campaign` filter, `r2CampaignSummaryBody` table)
  are present in the live-served HTML.
- Static snapshot file regenerated and confirmed to parse and match the live response shape.
- `div` tag balance checked before/after the HTML edit (89/88 → 91/90, a clean +2/+2 —
  the 1-off imbalance is pre-existing in this file, unrelated to this change).

## Checks

| Check | Result |
|---|---|
| Deployed to production | ✓ |
| Live endpoint returns campaign data | ✓ |
| Frontend filter + summary table render | ✓ |
| Static snapshot regenerated | ✓ |
| Synced to `aios-2` and staff repo | ✓ |
| No production system unrelated to this change touched | ✓ |

## Known limitations

Not independently verified against Jefri's own manual campaign-level totals in the Google
Ads UI — verification here is internal consistency (query logic + live response shape),
not a cross-check against an external source of truth.

## PASS / FAIL

PASS
