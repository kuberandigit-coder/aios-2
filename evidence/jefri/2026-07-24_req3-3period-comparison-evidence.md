# Evidence — Jefri Requirement 3 (T-03), 3-Period Product Comparison

**Date:** 2026-07-24

## Purpose
Implement T-03: compare product Conv. Value/ROAS across three fixed calendar-quarter windows, classify Improved/Same/Drop status and High/Mid Performance Tier.

## Discovery (before coding)
Searched the AIOS for existing Requirement 3 / T-03 / comparison-table work for Jefri: none found (`grep -rli "T-03|jefri.*requirement 3"` across all `.md` files returned only today's own daily-work-log and unrelated Req2 docs). `jefri.html` had only two tabs (Req1, Req2) before this change — confirmed no duplicate implementation to avoid.

## PostgreSQL inspection (read-only, no schema/data changes)
- `google_ads.product_performance` schema confirmed via `information_schema.columns`: `date, campaign_id, ad_group_id, product_item_id, parent_id, variation_id, impressions, clicks, conversions, conversion_value, cost, ctr, avg_cpc`.
- Data range for Jefri's 5 campaigns (`campaign_id IN (23141810147,23411228109,22539594891,23473840779,23340277562)`): 2025-05-12 to 2026-07-24, 453,016 rows.
- Row counts per requested period, checked before writing any code:
  - Oct-Dec 2025 (Previous 3M): 43,696 rows.
  - Jan-Mar 2026 (Last 3M): 156,939 rows.
  - Apr-Jun 2025 (Prior-Year 3M): 19,413 rows, **0 rows before 2025-05-12** — a real, disclosed gap (campaigns weren't tracked yet), not fabricated.
  - Distinct products across all three periods (UNION): 4,791.

## Changes

### `reports/digital-marketing-member-pages/api/requirement.js`
- Added `JEFRI_R3_QUERY` inside `jefriProductStatusHandlerModule`: three period CTEs (`prev`, `last3`, `py`) aggregating `SUM(conversion_value)`/`SUM(cost)` per `product_item_id`, a `UNION` of all three periods' product IDs (`all_ids`) so products active in *any* period are included (not just the intersection), a `ranked` CTE computing `ROW_NUMBER() OVER (ORDER BY last3.conv_value DESC)` + `COUNT(*) OVER()` for the revenue-percentile tier rule, and the same `resolved_ids`/`child_fallback`/`resolved_listing` SKU-resolution CTEs already used by Requirement 1 (verbatim reuse, not reinvented).
- Added `jefriR3Roas()`, `jefriR3PctChange()`, `jefriR3Status()`, `jefriR3Tier()` — pure functions implementing the Tier/Status rules exactly as specified (see summary report for the precedence note on Status when Conv. Value and ROAS disagree).
- Added `jefriReq3Handler` with the same cache/snapshot-fallback pattern as Req1/Req2 (60s in-memory `JEFRI_R3_CACHE`, static snapshot fallback at `data/jefri-req3-snapshot.json` if present, `?refresh=1` bypass).
- Dispatcher: `if (fn === 'jefri-req3') return jefriProductStatusHandlerModule.jefriReq3Handler(req, res);`

### `reports/digital-marketing-member-pages/pages/jefri.html`
- Added "Requirement 3" tab button, `showReqTab()` extended for `'req3'`, lazy-loaded on first switch (same IndexedDB-restore-then-load pattern already established for Req1/Req2 earlier today).
- New `req3Tab` markup: header/chips, 6 summary cards (Total/High/Mid/Improved/Same/Drop), a table with grouped 2-row `<thead>` (Tier/Product ID/SKU spanning both rows, then Previous-3M/Last-3M/Prior-Year-3M column groups), sticky header, per-column sort, search box, Tier/Status filter selects, pagination, Export CSV, and Export Excel (lightweight HTML-table-as-`.xls`, no new library dependency).
- New script block: `R3_ALL`/`r3Flatten()`/`applyReq3Data()`/`r3Load()`/`r3FilteredRows()`/`r3Render()`/`r3ExportCsv()`/`r3ExportExcel()`, following the exact naming/structure conventions of the existing Req1/Req2 scripts (distinct `r3`-prefixed identifiers, zero collisions).

## Verification (live, post-deploy)
- `GET /api/requirement?fn=jefri-req3&refresh=1` → HTTP 200, `success:true`, `summary:{"totalProducts":4791,"high":166,"mid":0,"improved":48,"same":2,"drop":74}`.
- Spot-checked the top row (`product_item_id 5481828778151`, SKU `LHSHE27BA-IDE`) against a manual re-run of the same SQL: `prev.conv_value=1001.96, last.conv_value=2865.51` — API response matches exactly.
- `mid:0` initially looked suspicious — re-verified with an independent query filtering directly for `rn/total_n BETWEEN 0.30 AND 0.50 AND roas BETWEEN 200 AND 399`: genuinely 0 matching rows in the real data, confirming this is correct output, not a bug.
- Deployed page confirmed live: `grep` for `id="req3Tab"`, `id="tabBtnReq3"`, `fn=jefri-req3` all present in the production HTML.
- Both `api/requirement.js` (`node -c`) and all 4 `<script>` blocks in `jefri.html` (`new Function()` per block) passed syntax validation before and after deploy.

## Raw diff
See `git diff` on the two files above (or the corresponding commit once made).
