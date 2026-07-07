# Closure — Kamsi Req 3: GA4 Bug Root-Cause & Fix

**Date:** 2026-07-06/07
**Status:** PASS — deployed and live
**Reviewer:** Kuberan (requested "exact page like Dilaksi") / Claude Code (root-cause + implementation)

## Summary

Kamsi Requirement 3's GA4 Engagement Rate showed a suspicious flat 100% across all 242 pages. Initial hypothesis was a GA4 property/GTM misconfiguration; deeper investigation (comparing against Dilaksi Req1's working query) found the real cause: combining the Organic Search channel filter with a landing-page CONTAINS filter in the same GA4 API `and_group` breaks the engagement metric. Rebuilt the report to match Dilaksi Req1 exactly per Kuberan's instruction — same live 5-window date-range switcher, same design, all organic landing pages (not just collections) — using the corrected single-filter query pattern.

## Outcome

- Engagement rate now shows genuine variance (93.9-95.1%) instead of a flat 100%.
- Live at `https://digital-marketing-member-pages.vercel.app/pages/kamsi-req3-core-ga4-seo.html`.
- Also fixed in passing: Hetheesha's placeholder tabs trimmed (after Piranav's real Req3 was merged in), and a corrupted/regressed `dilaksi.html` + `dilaksi-req3` back-button style restored from the shared repo.
- Deployed to Staff-requirements (`ec07b4c`) and synced to private repo.

## Next step

None required unless Kuberan wants further design changes. The old Kamsi req3 data files (`2026-07-06_kamsi_req3_ga4_gsc_fetch.py`, `..._ga4_organic_collections_30d.csv`, `..._gsc_fetch.py`, `..._gsc_top_query_30d.csv`) are kept for history but superseded by the new multiwindow/allpages fetch scripts.

See [[evidence/kamsi-requirement-3-ga4-bug-rootcause-fix.md]] and [[validation/kamsi-requirement-3-ga4-bug-rootcause-fix-validation.md]].
