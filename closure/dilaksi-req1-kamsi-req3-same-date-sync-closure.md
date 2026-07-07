# Closure — Dilaksi Req1 & Kamsi Req3 Same-Date Sync

**Date:** 2026-07-07
**Status:** PASS — deployed and live
**Reviewer:** Kuberan (noticed date mismatch) / Claude Code (fix + implementation)

## Summary

Kuberan noticed Dilaksi Req1 and Kamsi Req3 are the same report type but showed different data because they'd been generated on different dates. Refetched both on the same run so they're directly comparable, and along the way found and fixed two latent bugs in Dilaksi Req1's page-builder script: a GSC query-column data-loss bug (regex scraping non-existent static HTML instead of the embedded JSON) and a tab-nav/back-button regression bug (template never included that markup, so every rebuild silently wiped it).

## Outcome

- Both reports now show matching data as of 2026-07-07 (verified identical session/page/revenue totals at every date-range window).
- Dilaksi Req1's Query column restored (43 real GSC query mappings vs. 1 before the fix).
- Tab-nav/back-button now permanently part of the builder template — future reruns won't regress it again.
- Deployed to Staff-requirements (`c5588ce`) and live on Vercel.

## Next step

None required. Both builder scripts can be safely rerun going forward whenever fresh data is needed for either report.

See [[evidence/dilaksi-req1-kamsi-req3-same-date-sync.md]] and [[validation/dilaksi-req1-kamsi-req3-same-date-sync-validation.md]].
