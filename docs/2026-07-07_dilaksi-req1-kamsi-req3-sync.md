# 2026-07-07 — Dilaksi Req1 & Kamsi Req3 Synced to Same-Date Data

**Task:** Kuberan noticed Dilaksi Req1 and Kamsi Req3 (the same "Core GA4 Data for SEO" report type) showed different numbers because they were generated on different dates. Refresh both to the same date.

**Purpose:** Make the two reports directly comparable since both use live rolling windows "ending today."

**Evidence:** `evidence/dilaksi-req1-kamsi-req3-same-date-sync.md`
**Validation:** `validation/dilaksi-req1-kamsi-req3-same-date-sync-validation.md` — PASS
**Closure:** `closure/dilaksi-req1-kamsi-req3-same-date-sync-closure.md` — PASS

**Bugs found and fixed along the way:**
1. Dilaksi Req1's GSC query column was silently losing data on every rebuild — the builder scraped literal `<td>` HTML tags that don't exist (page renders client-side via JS); fixed to parse the embedded JSON directly (43 entries recovered vs. 1).
2. The same builder's template never included the tab-nav/back-button markup added in an earlier task — this was the real root cause of a styling regression seen previously. Now baked permanently into the template.

**Result:** Both reports refetched together, confirmed matching data (e.g. 15,890 sessions at the 60-day window on both), dates updated to 2026-07-07, deployed to Staff-requirements (`c5588ce`) and live on Vercel.
