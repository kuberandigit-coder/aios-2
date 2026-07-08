# Validation — Kamsi Req5 Dynamic Action Counts

**Title:** Validation checklist for the per-collection Action Needed counts
**Purpose:** Confirm counts recompute correctly for every action, for any collection
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi · **Reviewer:** Kuberan

| Check | Result |
|---|---|
| Counts recompute for ALL action options (not just OK) | PASS |
| Counts recompute for ANY selected collection | PASS |
| "All Collection Types" still shows site-wide totals | PASS — unchanged from before, verified no startup call needed |
| Sum of per-action counts equals total rows in that collection | PASS — 784 total, sum of 4 present action types = 784 |
| Matches user's own reference screenshot | PASS — Pendant Lighting + OK = 553, matches screenshot exactly |
| Selected value preserved across collection change where still valid | PASS |
| Div nesting balanced | PASS — 158/158 |
| JS syntax valid | PASS — `node --check`, exit 0 |
| Req1/Req2/Req3/Req4 unaffected | PASS |
| Deployed and live | PASS — HTTP 200, function confirmed present |

**Validation result:** PASS
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** None
**Next Steps:** none
**PASS / FAIL:** PASS
