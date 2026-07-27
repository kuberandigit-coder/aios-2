# Validation — Meta UK Tab + Order Overlap Discovery

**Date:** 2026-07-27

## Checks
- [x] Meta UK tab live-verified: `?staff=meta-uk-ads&month=2026-01` returns success with plausible order/net-sales figures.
- [x] Overlap claim independently checked by loading all 6 January tab JSON snapshots and comparing `orderName` fields — 1,037/2,156 (48%) appear in >1 tab, breakdown by combination recorded in evidence.
- [x] Meta UK tab excludes any order already matched by Sajeepan/Theekshy/Sonya/DM's rules (checked in code).
- [ ] Meta UK Jan-Jun static snapshots not yet generated — tab currently live-fetch only (slow cold load).

## Status: PASS (live-verified + overlap independently confirmed); snapshot backfill outstanding
**Reviewer:** Not recorded.
**Next step:** Generate Meta UK static snapshots Jan-Jun.
