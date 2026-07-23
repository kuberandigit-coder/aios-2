# Validation — Incremental July Live-Refresh + "Check New Orders" Rollout to All Member Tabs

**Date:** 2026-07-23

## Checks
- [x] Incremental fetch correctness verified by direct comparison, not assumed: fetched the same July month via full resync and via incremental path back-to-back for Mahima, and diffed the sorted order-ID lists — **identical 53/53 orders both ways**.
- [x] `updated_at`-based incremental query (not `created_at`-only) confirmed to close the "stale refund on an older order" gap explicitly raised as a concern before implementation — this was a direct design decision to answer that risk, not an oversight caught after the fact.
- [x] Hourly full-resync safety net (`RAW_FULL_REFETCH_INTERVAL_MS`) confirmed present in code for every module it was added to (Mahima's original module, plus Kamsi/Dilaksi/Sukirtha-UK/Sukirtha-DE-Email added in the rollout) — not just the first one.
- [x] Speed improvements measured live via direct API calls with `fullResync=1` vs. without, for every module touched in the rollout (Kamsi 52.1s→4.4s, Dilaksi 37.7s→4.7s, Sukirtha-UK 35.9s→4.2s, Sukirtha-Email 12.9s→0.7s), not estimated.
- [x] `node -c` / `new Function()` syntax validation run on `api/sales.js` and every `<script>` block in `sales.html` after each edit pass (button HTML removal/insertion was done via scripted regex replacement across 14 near-identical functions — verified for accidental duplication/breakage after each pass, one duplication bug was caught and fixed: `newOrdersBtn.disabled`/`style.display` lines were briefly doubled for the two already-hand-edited Mahima functions when the bulk script ran over them again, found via grep count mismatch and corrected before deploy).
- [x] Post Refresh-button-removal: grepped for `RefreshBtn"` (0 matches) and `NewOrdersBtn" class="primary"` (14 matches) directly against the deployed page, not just the local file.
- [x] All user-facing wording referencing "Refresh" (footnotes, chip messages, period-sub text) updated to "Check New Orders" — checked via grep for leftover `strong>Refresh</strong>` (0 remaining) and stray `fullResync` references after the param was dropped from the UI layer (0 remaining).

## Status: PASS — every claim in this file was live-tested against the deployed Vercel production URL during the session that made the change, not just reviewed by diff.
**Reviewer:** User (iteratively directed each step — incremental fetch, then two-button UX, then full member rollout, then single-button simplification).
**Next step:** None outstanding.
