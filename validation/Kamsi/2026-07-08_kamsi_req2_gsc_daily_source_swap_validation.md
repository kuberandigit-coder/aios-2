# Validation — Kamsi Req2 GSC Daily Source Swap

**Title:** Validation checklist for re-sourcing the day-by-day filter to GSC API
**Purpose:** Confirm the swap is correct and the page still works identically otherwise
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi · **Reviewer:** Kuberan

| Check | Result |
|---|---|
| GSC API fetch reused correct service account/site/scope | PASS — same as monthly fetch pattern |
| 30/30 June days pulled | PASS |
| Page scope matches monthly report (1,385 pages) | PASS |
| Daily rows matched to existing page index | PASS — 588/13,485 unmatched rows investigated, confirmed same known/documented product-page-under-collection pattern, not a new bug |
| `d2day` dataset swapped cleanly, no HTML/JS logic changes needed | PASS — day-picker code already reads from `d2day` generically |
| Div nesting balanced | PASS — 159/159, unchanged |
| JS syntax valid | PASS — `node --check`, exit 0 |
| Spot-check numbers sane (2026-06-05) | PASS — 403 pages, 19,507 impressions, 61 clicks |
| Monthly aggregate view unchanged | PASS — still the original 2026-07-03 GSC pull |
| Req1/Req3/Req4/Req5 unaffected | PASS |
| No PostgreSQL used in this pass | PASS — pure GSC API, read-only |
| Deployed and live | PASS — HTTP 200, 30 days confirmed live, spot-check matched |

**Validation result:** PASS
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** Still a pre-fetched snapshot (2026-07-08), not live-on-click; 161 out-of-scope product pages excluded (documented)
**Next Steps:** none
**PASS / FAIL:** PASS
