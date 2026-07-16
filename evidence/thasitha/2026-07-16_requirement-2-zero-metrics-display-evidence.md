# Evidence — Thasitha Requirement 2: Show 0.00/€0.00 instead of N/A for zero-denominator metrics

**Date:** 2026-07-16
**File:** `reports/digital-marketing-member-pages/pages/thasitha.html`
**Purpose:** User found "N/A" confusing/not simple enough for CTR, Avg CPC, Conv. Rate, ROAS cells when Impressions/Clicks/Cost = 0. Requested visible, simple values instead of N/A.

## Context
The underlying calc (`renderR2()`) already guards against division-by-zero by setting these fields to `null` when the denominator is 0 (matches Google Ads' own UI convention of showing "--" in the same scenario — confirmed to user this isn't a bug). User still wants the AIOS dashboard to show a plain value rather than N/A.

## Changes made
Row-render template in `renderR2()`:
- CTR: `r.ctr!=null ? r.ctr.toFixed(2)+'%' : N/A-span` → now `(r.ctr!=null?r.ctr.toFixed(2):'0.00')+'%'`
- Avg CPC: `r.avgCpc!=null ? eur(r.avgCpc) : N/A-span` → now `eur(r.avgCpc!=null?r.avgCpc:0)`
- Conv. Rate: same pattern as CTR → `0.00%` fallback
- ROAS: same pattern → `0.00%` fallback

All four now render `0.00%` / `€0.00` instead of the `<span class="t1-na">N/A</span>` badge when the underlying value is null (zero denominator).

## Commit
`52e9540` — pushed to `github.com/kuberandigit-coder/aios-2` (main).

## Deploy
`vercel --prod --yes` — production deployment `digital-marketing-member-pages-rn2l5lajp.vercel.app`, READY.
