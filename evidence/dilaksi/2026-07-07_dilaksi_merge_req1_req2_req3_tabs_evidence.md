# Evidence — Dilaksi Requirements 1, 2, 3 Merged into One Page (In-Page Tabs)

**Title:** dilaksi.html rebuilt as a single page with 3 in-page tabs (Hetheesha-style showTab()), replacing the 3 separate cross-linked pages
**Purpose:** User request to merge all Dilaksi requirement pages into one HTML with tab navigation, matching the Hetheesha page pattern
**Requirement Source:** User instruction, 2026-07-07
**Team Member:** Dilaksi (SEO team) · **Reviewer:** Kuberan
**No data was recalculated, re-pulled, or altered** — every number, row, and label from the original 3 pages was relocated as-is into tab panels.

## What was done
1. Read the full original `dilaksi.html` (Req 1, GA4 SEO report, 38 KB) and extracted its CSS/HTML/JS.
2. Programmatically extracted `dilaksi-req2-all-products.html` (Req 2, Product Priority Guidance, 5,179 rows, 3.7 MB) and `dilaksi-req3-pages-for-removal.html` (Req 3, Pages for Removal, 454 KB) — too large to fully load via the normal read path, so used Python to slice out each page's `<style>`, body content, and `<script>` blocks precisely.
3. Rebuilt `dilaksi.html` as one file with:
   - Single shared header/back-link + one `<nav class="tab-nav">` using `showTab(1)/showTab(2)/showTab(3)` buttons (identical pattern to `hetheesha.html`)
   - `tab-panel-1`, `tab-panel-2`, `tab-panel-3` divs, only one visible at a time via `.tab-panel{display:none} .tab-panel.active{display:block}`
   - Each requirement's original `<script>` wrapped in its own IIFE `(function(){ ... })();` to prevent variable collisions (both Req 1 and Req 2 independently declared identically-named globals like `render`, `esc`, `q`, `container`, `badge` — confirmed via grep before merging)

## Bugs found and fixed during the merge (before going live)
1. **Unbalanced `</div>` nesting** — first merge attempt left an extra stray `</div>` from Req 1's original wrap-closing tag, which would have broken the DOM. Caught via div-count validation (70 open / 70 close required), fixed by properly trimming each source page's own wrap-closer before insertion.
2. **Inline event handlers silently broken by IIFE-wrapping** — Req 1's `onchange="applyFilters()"` (Page Type / Collection dropdowns) and Req 3's `onchange="flt()"` / `oninput="flt()"` / `onclick="rst()"` (search/reset) rely on the function being in **global** scope; wrapping in an IIFE hides them. Fixed by explicitly exposing each with `window.applyFilters = applyFilters;` / `window.flt = flt; window.rst = rst;` at the end of their respective IIFEs.
3. **`id="q"` collision** — Req 2's search box and Req 3's search box both used `id="q"`; `getElementById('q')` would have silently grabbed the wrong element for whichever tab loaded second. Fixed by renaming Req 3's search input to `id="q3"` (HTML attribute + its 2 `getElementById` references in Req 3's script).
4. **Wrong page title** — first draft used a generic placeholder title; corrected to "Dilaksi — SEO & Digital Marketing Reports".

## Verification performed
- Div balance: 3,407 open / 3,407 close (perfectly matched)
- `node --check` syntax validation on the full merged 3.67 MB script: **passed, exit 0**
- Row-count spot check: Req 2 dataset still exactly 5,179 rows (`const ROWS=[...]`); Req 1's 5-window `DATA` const (60/45/30/15/7-day) intact; Req 3's `id="cnt"` counter element present
- Live deployment fetch confirmed all of the above match on the production URL

## Files created/modified
- `reports/digital-marketing-member-pages/pages/dilaksi.html` — rebuilt (now serves all 3 requirements via tabs)
- `reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` — archival copy updated to match
- `reports/dilaksi/data/2026-07-07_dilaksi_merge_req1_req2.py`, `2026-07-07_dilaksi_merge_req3.py` — merge scripts (kept for auditability/repeatability)
- `reports/dilaksi/data/2026-07-07_dilaksi_req1_original_backup.html`, `2026-07-07_dilaksi_req1req2_merged_backup.html` — safety backups taken before each destructive step

## What was explicitly NOT touched (per user instruction: "keep req1... do not touch and change any dilaksi data")
- `dilaksi-req2-all-products.html` and `dilaksi-req3-pages-for-removal.html` — left on disk exactly as they were, untouched, still independently reachable at their old URLs
- No PostgreSQL data touched (this was a pure front-end file reorganization)
- No other staff member's pages touched
- `index.html`'s Dilaksi link (`pages/dilaksi.html`) required no change — same URL now serves the merged page automatically

## Deployment
Deployed to Vercel production and verified live: HTTP 200, all 3 tab panels present, all 3 datasets intact (Req 2: 5,179 rows; Req 1: 5 date-range windows; Req 3: structure intact).

**Duplicate risk:** GREEN (this is a reorganization of existing, already-reviewed content, not new data)
**Owner:** Dilaksi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** Merged file is now ~4.1 MB (vs. 3 separate files totaling roughly the same combined size) — single-page load is heavier than before, but functionally equivalent; all 3 datasets load on page open regardless of which tab is active (same trade-off as the existing Hetheesha page).
**Next Steps:** none required; old standalone Req 2/Req 3 URLs remain live as a redundant fallback per instruction
**PASS / FAIL:** PASS
