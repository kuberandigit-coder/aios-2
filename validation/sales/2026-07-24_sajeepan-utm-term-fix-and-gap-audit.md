# Validation — Sajeepan utm_term Fix + Gap Audit

**Date:** 2026-07-24

## Checks
- [x] utm_term match layered on top of (not replacing) the existing campaign-name rule — an order counts if either matches, per commit message.
- [x] `matchedOn` field added for row-level transparency between the two match types.
- [x] All 7 months (Jan-Jul) snapshots regenerated with the corrected rule, including June after 8 prior failed attempts.
- [x] Paid-search unclaimed-gap audit added to `uk-total-debug`, and its finding (the DM campaign) was acted on later the same day.
- [ ] Not independently re-verified in this AIOS sync pass — reconstructed from commit messages/diffs.

## Status: PASS (reconstructed from git history — not independently re-tested)
**Reviewer:** Not recorded.
**Next step:** None outstanding.
