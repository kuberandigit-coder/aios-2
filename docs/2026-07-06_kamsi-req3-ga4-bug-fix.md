# 2026-07-06/07 — Kamsi Req 3: GA4 Engagement Rate Bug Root-Caused & Fixed

**Task:** Fix a suspicious flat 100% Engagement Rate in Kamsi's Requirement 3 report, and rebuild it to exactly match Dilaksi Requirement 1's proven design/pattern per Kuberan's instruction.

**Purpose:** Give Kamsi an accurate, trustworthy Core GA4 Data for SEO report instead of one with a silently-wrong metric.

**Evidence:** `evidence/kamsi-requirement-3-ga4-bug-rootcause-fix.md`
**Validation:** `validation/kamsi-requirement-3-ga4-bug-rootcause-fix-validation.md` — PASS
**Closure:** `closure/kamsi-requirement-3-ga4-bug-rootcause-fix-closure.md` — PASS

**Root cause:** Combining GA4's Organic Search channel filter with a landing-page CONTAINS filter in the same `and_group` breaks the `engagementRate` metric (collapses to exactly 1/100% for every row) — a GA4 Data API quirk, not a property/GTM misconfiguration as first suspected. Dilaksi Req1's script never combines those two filters, so it never hit the bug.

**Fix:** Refetched using Dilaksi's single-filter pattern (all organic landing pages, live 5-window rolling date-range switcher), rebuilt the page to match Dilaksi Req1's design exactly, added Page Type/Collection filters as a bonus. Verified: engagement rate now varies 93.9-95.1% (was flat 100%).

**Also fixed:** Hetheesha's placeholder Req4/5 tabs trimmed (Piranav's real Req3 merged in first, not overwritten); a corrupted `dilaksi.html` (duplicate closing tags) and a back-button style regression on 2 Dilaksi pages were found and restored from the clean shared-repo copy.

**Status:** PASS / Reviewer: Kuberan + Claude Code / Deployed to Staff-requirements (`ec07b4c`), live on Vercel.
