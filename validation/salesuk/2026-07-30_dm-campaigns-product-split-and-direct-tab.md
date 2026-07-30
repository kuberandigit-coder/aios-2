# Validation — DM Campaigns Product-ID Split (Sajeepan/Sonya) + Direct Tab Split

**Date:** 2026-07-30

## Checks Performed
1. `node --check` on `api/salesuk.js` and `api/assign-order.js` after every edit — all passed.
2. Embedded `<script>` block in `pages/salesuk.html` parsed via `new Function()` — passed.
3. Live curl verification of `dm-ad`, `sonya`, `sajeepan` groups for all 7 months (2026-01 to 2026-07): cross-referenced `orderLegacyId` sets pairwise, confirmed 0 overlap in every pairing, every month.
4. Live curl verification of `organic`/`direct` groups for all 7 months: confirmed 0 overlap every month.
5. Confirmed the "moved from DM Campaigns" count is non-zero and consistent with expectations (Sonya: 253–316/month, Sajeepan: 130–179/month) after the snapshot-regeneration fix — initial deploy showed 0 moved, root-caused to stale static snapshots, fixed and re-verified.
6. Post-move verification: re-fetched `dm-ad` after the split to confirm its order count dropped correspondingly (e.g. July 2026 dm-ad went from 470 → 245 after both Sajeepan and Sonya exclusions applied).
7. Confirmed final page routing: `salesuk.html` returns 200 and serves the Direct tab; the old standalone `salesuk-direct.html` returns 404 (correctly removed).

## Result
PASS on all checks. No duplication, no missed orders (beyond the same cancelled/test exclusions already in place before this change), correct final routing.
