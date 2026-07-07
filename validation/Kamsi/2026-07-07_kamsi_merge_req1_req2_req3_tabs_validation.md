# Validation — Kamsi 5-Requirement Tab Merge

**Title:** Validation checklist for the merged kamsi-req1-slow-moving-products.html (all 5 requirements in one page)
**Purpose:** Confirm the merge preserved all data and functionality exactly, across both merge passes
**Requirement Source:** User instruction, 2026-07-07
**Team Member:** Kamsi · **Reviewer:** Kuberan

| Check | Result |
|---|---|
| Req1 data (13,866 rows, JSON data-holder script) intact | PASS — row count identical before/after |
| Req2 data (1,385 rows, JSON data-holder script) intact | PASS — row count identical before/after |
| Req3 data (5 GA4 date-range windows) intact | PASS — `const DATA = {...}` present, unchanged |
| Req4 data (5,179 rows) intact | PASS — row count identical before/after |
| Req5 data (5,179 rows) intact | PASS — row count identical before/after |
| Div nesting balanced | PASS — 163 open / 163 close |
| JS syntax valid | PASS — `node --check` on full ~8 MB combined script, exit 0 |
| No id collisions across all 5 panels | PASS — found and fixed real collisions: `id="d"` (Req1/Req2), `id="q"`/`id="tb"`/`id="cnt"`/`id="pinfo"`/`id="psize"` (Req1/Req2/Req3), `id="q"`/`id="rowsContainer"`/`id="pageInfo"`/`id="prevPage"`/`id="nextPage"`/`id="collsel"` (Req4/Req5) |
| Inline event handlers correctly re-scoped | PASS — Req1/Req2/Req3's inline `onchange`/`oninput`/`onclick` handlers (`flt`, `rst`, `srt`, `applyFilters`) renamed to per-panel suffixed globals (`flt1/rst1/srt1`, `flt2/rst2/srt2`, `applyFilters3`) and explicitly exposed via `window.*` — confirmed NOT using a shared unsuffixed name, which would have let the last-loaded panel silently override earlier ones |
| Req4/Req5 confirmed handler-free (no inline onXXX) | PASS — verified via grep, no `window.*` exposure needed for these two |
| Tab switching (5-button showTab pattern) | PASS — `showTab(1..5)`, `.tab-panel.active` toggle, all 5 buttons wired |
| Old standalone Req2/Req3/Req4/Req5 pages untouched | PASS — confirmed unchanged on disk, still independently reachable |
| No other staff pages touched | PASS |
| No PostgreSQL/data recalculation | PASS — pure HTML/CSS/JS reorganization |
| index.html requires no change | PASS — same URL (`pages/kamsi-req1-slow-moving-products.html`) now serves the merged page |
| Deployed and live | PASS — HTTP 200, all 5 panels and datasets verified live |

## Data-integrity spot check (before vs. after merge)
```
Req1: 13,866 rows — identical count before and after
Req2: 1,385 rows — identical count before and after
Req3: 5 GA4 date-range windows (60/45/30/15/7 days) — present, unchanged
Req4: 5,179 rows — identical count before and after
Req5: 5,179 rows — identical count before and after
```

**Validation result:** PASS — all data preserved exactly across both merge passes; multiple real id/scope collisions were found and fixed before deployment, none shipped.
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** ~10.6 MB single-page load (all 5 tabs' data loads upfront regardless of active tab)
**Next Steps:** none
**PASS / FAIL:** PASS
