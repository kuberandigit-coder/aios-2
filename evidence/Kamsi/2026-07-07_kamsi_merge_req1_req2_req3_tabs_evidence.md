# Evidence — Kamsi Requirements 1–5 Merged into One Page (In-Page Tabs)

**Title:** kamsi-req1-slow-moving-products.html rebuilt as a single page with all 5 requirement tabs (Hetheesha/Dilaksi-style showTab pattern)
**Purpose:** User request to merge all Kamsi requirement pages into one HTML with tab navigation, matching the Dilaksi merge done earlier the same day
**Requirement Source:** User instruction, 2026-07-07 ("kamsi-req1-slow-moving-products.html keep this, in here add the kamsi req[2] and 3 for now and later we add others" — followed shortly after by "add req 4 and 5 of kamsi into req1 file... just now do these and update aios for all")
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan
**No data was recalculated, re-pulled, or altered** — every row/number from all 5 original pages was relocated as-is into tab panels.

## What was done (two passes, same session)
**Pass 1 — Req 1 + Req 2 + Req 3:**
1. Kept `kamsi-req1-slow-moving-products.html` as the base file (per instruction) and backed it up before touching it.
2. Extracted `kamsi-req2-low-ctr-pages.html` (1,385 rows) and `kamsi-req3-core-ga4-seo.html` (GA4 5-window report, same design as Dilaksi Req 1).
3. Discovered a new data pattern not seen in the Dilaksi merge: Kamsi Req1/Req2 embed their dataset in a separate `<script id="d" type="application/json">...</script>` tag (read via `JSON.parse(document.getElementById('d').textContent)`), rather than an inline `const ROWS=[...]`. Extraction logic was adapted to keep this JSON data-holder tag as literal panel HTML (not JS to execute) and only wrap the real executable `<script>` in an IIFE.

**Pass 2 — Req 4 + Req 5 (added into the same file immediately after):**
4. Extracted `kamsi-req4-product-priority-guidance.html` (5,179 rows — same underlying dataset as Dilaksi Req 2) and `kamsi-req5-missing-meta-detection.html` (5,179 rows, different report/columns).
5. Both use the plain `const ROWS=[...]` pattern (Dilaksi-style), no inline event handlers (all wiring via `addEventListener`), which simplified this pass — no `window.*` exposure fixes needed, unlike Req1–3.

## Collisions found and fixed (before shipping)
1. **`id="d"` collision** (Pass 1) — Req1 and Req2 both use this id for their JSON data-holder script tag. Renamed Req2's to `id="d2"`.
2. **`id="q"`, `id="tb"`, `id="cnt"`, `id="pinfo"`, `id="psize"` collisions** (Pass 1) — Req1 and Req2 share the exact same template. Renamed all of Req2's to `q2/tb2/cnt2/pinfo2/psize2`; Req1 kept its originals unchanged as the base. `id="tb"` also collided with Req3 — renamed Req3's to `tb3`.
3. **Inline event handlers broken by IIFE-wrapping** (Pass 1) — Req1 and Req2 call `flt()`, `rst()`, `srt(n)` via inline `onchange`/`oninput`/`onclick`. Fixed by renaming inline calls to unique per-panel names (`flt1/rst1/srt1`, `flt2/rst2/srt2`, `applyFilters3`) and exposing each via `window.flt1 = flt;` etc. — critically using suffixed names, not a shared `window.flt`, since two panels reusing the same global name would let the later-loaded one silently overwrite the earlier one's handler.
4. **`id="q"`, `id="rowsContainer"`, `id="pageInfo"`, `id="prevPage"`, `id="nextPage"`, `id="collsel"` collisions between Req4 and Req5** (Pass 2) — both use an identical card-list/pagination template. Renamed Req4's to `*4` and Req5's to `*5` suffixes. (Note: the JS variable name `container` itself needed no renaming — it's just a local `const` bound via `getElementById('rowsContainer')`, IIFE-scoped, not a real DOM id.)
5. Req4/Req5 have **no inline HTML event handlers** (confirmed via grep) — all wiring is via `addEventListener`, so no `window.*` exposure was needed for this pass, unlike Req1–3.

## Verification performed
- Div balance: 163 open / 163 close (perfectly matched) after both passes
- `node --check` syntax validation on the full combined 8 MB script: **passed, exit 0**
- Row-count spot check against originals:
  - Req1 JSON data: 13,866 rows (identical)
  - Req2 JSON data: 1,385 rows (identical)
  - Req3: GA4 `DATA` const (5 date-range windows) present, unchanged
  - Req4: `ROWS` const — 5,179 rows (identical)
  - Req5: `ROWS` const — 5,179 rows (identical)
- Live deployment fetch confirmed all of the above match on the production URL

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` — rebuilt (now serves all 5 requirements via tabs)
- `reports/kamsi/data/2026-07-07_kamsi_merge_req1_req2_req3.py`, `2026-07-07_kamsi_merge_req4_req5.py` — merge scripts (kept for auditability/repeatability)
- `reports/kamsi/data/2026-07-07_kamsi_req1_original_backup.html`, `2026-07-07_kamsi_req1req2req3_merged_backup.html` — safety backups taken before each destructive step

## What was explicitly NOT touched
- `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html`, `kamsi-req4-product-priority-guidance.html`, `kamsi-req5-missing-meta-detection.html` — all left on disk exactly as they were, untouched, still independently reachable at their old URLs
- No PostgreSQL data touched (pure front-end file reorganization)
- No other staff member's pages touched
- `index.html`'s Kamsi link (`pages/kamsi-req1-slow-moving-products.html`) required no change — same URL now serves the merged 5-tab page automatically
- `kamsi.html` (a separate, unrelated 1.4 KB stub) was not touched

## Deployment
Deployed to Vercel production and verified live: HTTP 200, all 5 tab panels present, all 5 datasets intact.

**Duplicate risk:** GREEN (reorganization of existing, already-reviewed content, not new data)
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** File is now ~10.6 MB (all 5 requirements' datasets combined) — noticeably heavier than any other member page in this system; all 5 tabs' data loads on page open regardless of which tab is active (same trade-off already accepted for Hetheesha/Dilaksi).
**Next Steps:** none — all 5 Kamsi requirements are now merged as requested
**PASS / FAIL:** PASS
