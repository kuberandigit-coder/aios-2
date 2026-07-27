# Validation — Standalone `salesuk.html` / `api/salesuk.js`

**Date:** 2026-07-27

## Checks
- [x] `node --check api/salesuk.js` passes.
- [x] All `<script>` blocks in `pages/salesuk.html` parse cleanly (`new Function(...)` smoke test).
- [x] DM-Ad group live-verified: 962 orders / £23,092.53 net (819 + 143 across the two campaigns).
- [x] Meta group live-verified: 342 orders / £6,198.41 net.
- [x] Confirmed zero possible overlap by code construction — `GROUPS` array checked in fixed order, first match wins, `assignGroup()` returns at most one group per order.
- [x] Static-snapshot fast path confirmed: cold load dropped from 90s+ timeout to ~2s after snapshot generation.
- [x] Nav link present on `home.html` only, confirmed absent from `index.html` per explicit instruction.
- [ ] Feb-Jul not built — only January is in scope so far.
- [ ] No automated test suite exists for this endpoint (manual curl verification only, consistent with the rest of this codebase).

## Status: PASS
**Reviewer:** Not recorded.
**Next step:** Extend to Feb-Jul if requested; continue building out remaining first-session groups as the user assigns them.
