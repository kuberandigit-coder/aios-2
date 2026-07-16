# Closure — Thasitha Requirement 2: Show 0.00/€0.00 instead of N/A

**Date:** 2026-07-16
**Status:** DONE — committed, pushed, deployed to production
**PASS/FAIL:** PASS

## Summary
CTR, Avg CPC, Conv. Rate, and ROAS cells in the R2 table now display `0.00%` / `€0.00` instead of "N/A" when the metric's denominator (Impressions/Clicks/Cost) is zero, per user request for simpler, more visible values. Confirmed to user beforehand that Google Ads' own dashboard shows "--" in this same scenario — not a bug, just a display preference change.

## Evidence
[[2026-07-16_requirement-2-zero-metrics-display-evidence]]

## Validation
[[2026-07-16_requirement-2-zero-metrics-display-validation]] — PASS

## Deploy
- Commit `52e9540` pushed to `github.com/kuberandigit-coder/aios-2` (main).
- `vercel --prod` deployment on `digital-marketing-member-pages-rn2l5lajp.vercel.app`, READY, production.

## Next step
None expected unless user wants the same 0-value convention applied elsewhere (e.g. R3).
