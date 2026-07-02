# Validation — Dilaksi Req 1: Date-Range Filter

**Date:** 2026-07-02 · **Reviewer:** Kuberan · **Status:** PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| 5 filter options present | 60/45/30/15/7 day buttons | All 5 `data-d` buttons in live HTML | PASS |
| Each window is real GA4 data | live fetch per window, not scaled | 5 separate GA4 Data API runReport calls (totals + top 200 pages each) | PASS |
| Windows internally consistent | sessions/pages shrink with window | 16,023→11,658→7,760→3,627→1,717 sessions; 4,564→902 pages | PASS |
| Cross-check vs Req 2 fetch | 30d organic pages ≈ 2,768 (earlier CSV) | 2,771 (independent fetch, same order of magnitude/day drift) | PASS |
| Engagement metrics now real | no more "N/A" | engagement rate/time, pages/session, purchases rendered from GA4 | PASS |
| Old page preserved | backup exists | `reports/dilaksi/data/2026-07-02_req1-dilaksi-page-backup.html` | PASS |
| Deployed & live | HTTP 200 + datasets | 200; all 5 datasets embedded | PASS |
| Req 2 page unaffected | HTTP 200 | 200 | PASS |

**PASS/FAIL: PASS**
