## Purpose
Validate the per-person Export CSV feature.

## Checks performed
1. `node -e "new Function(...)"` syntax check on all script blocks.
2. Confirmed all 7 export buttons (6 dual-year members + Thasitha) are wired to `exportPerfCsv(idSuffix)` with correct idSuffix values.
3. Confirmed CSV escaping (`csvEscape`) handles embedded commas/quotes.
4. Confirmed the "no data loaded yet" guard fires correctly when a tab hasn't finished loading.
5. Live grep on deployed page: `exportBtn`/`exportPerfCsv` present.

## Result
PASS.

## Reviewer
Kuberan
