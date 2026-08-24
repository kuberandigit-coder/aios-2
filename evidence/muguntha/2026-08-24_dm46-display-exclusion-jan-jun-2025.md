## Purpose
Remove DM 46 campaign-attributed Sales and its product-share Cost from Sonya's and Sajeepan's Performance tab, Jan-Jun 2025 only, display-only (other pages/dashboards using the same underlying attribution must stay unaffected).

## Business Question
Kuberan questioned why every row's Organic/Ads split showed one column real and the other exactly zero, ultimately deciding (after a multi-turn Tanglish/English clarification) that DM 46's contribution should be fully removed from display for Jan-Jun 2025 specifically — not just zeroed, not mentioned at all (confirmed in a follow-up: "remove the dm dont mention anywhere until june").

## Investigation and a real bug caught mid-build
First implementation added the strip logic to `api/muguntha.js`'s `handlePerfBatch` (a server-side batch endpoint). Live-tested and it worked correctly when curled directly — but the user reported the live page still showed DM cost in the popup. Investigation found `pages/muguntha.html`'s own `PERF_BATCH_MEMBERS` set was `new Set()` (empty) — the perf-batch route was never actually wired into the page's `loadAll()`; the page uses `fetchGroupSales()`/`fetchCost()` calling the raw endpoints directly. The first fix was correct code sitting on a dead code path.

## Fix
Re-implemented the exact same stripping logic (filtering `campaignSummary` rows tagged `"(product-owned, moved from DM Campaigns)"` — the existing marker `salesuk.js`/`sales25.js` already appends for DM-46-attributed orders) directly inside `fetchGroupSales()`/`fetchCost()`/`openCostPopup()` in `pages/muguntha.html`, scoped to `member in {sonya, sajeepan}` and `month in {2025-01..2025-06}`. Also updated the display so DM isn't mentioned at all for these months (not shown as "£0.00") per the follow-up instruction.

## Files Modified
- `api/muguntha.js` (first, now-unused server-side attempt kept as-is — harmless dead code, documented)
- `pages/muguntha.html` (the actual fix)

## Status
PASS — user confirmed via live curl checks against the raw endpoints (still showing the DM-tagged rows, as expected) and against the rendered page (DM no longer mentioned for Jan-Jun 2025).

## Reviewer
Kuberan
