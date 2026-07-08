# Validation — Kamsi Req2 Date Range Filter

**Title:** Validation checklist for the custom Start date / End date range filter
**Purpose:** Confirm range aggregation is mathematically correct and doesn't regress the single-day view
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi · **Reviewer:** Kuberan

| Check | Result |
|---|---|
| Same start/end date shows single-day view (unchanged from before) | PASS — byte-identical output vs. original single-day picker |
| Different start/end shows aggregated range totals | PASS |
| Aggregation math correct (sum impressions/clicks, avg position, recomputed CTR/flag) | PASS — cross-checked 06-01..06-05 top-page impressions (3,462) against manual sum of raw data, exact match |
| `pickRange2` exposed to `window` (inline onchange requires global scope) | PASS — bug found via functional simulation before deploy, fixed |
| Swapped start/end (end before start) handled | PASS — swap logic in `pickRange2` |
| Only one of start/end filled | PASS — treated as single day |
| Clear button resets all 3 date controls | PASS |
| Label reflects state correctly (Full Month / single day / range) | PASS |
| Div nesting balanced | PASS — 158/158 |
| JS syntax valid | PASS — `node --check`, exit 0 |
| Scope confirmed with user (June only) before building | PASS |
| Req1/Req3/Req4/Req5 unaffected | PASS |
| Deployed and live | PASS — HTTP 200, range inputs + exposure fix confirmed live |

**Validation result:** PASS — this feature's core bug (missing `window.pickRange2` exposure) was caught by functional simulation before shipping, not after, consistent with the lesson learned from the earlier single-day-picker incident.
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** June 2026 only
**Next Steps:** none
**PASS / FAIL:** PASS
