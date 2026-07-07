# Evidence — Kamsi Requirement 5: Layout Fix (No Horizontal Scroll + Detailed View)

**Title:** Redesigned Req 5 table layout to remove horizontal scrolling and add a detailed view
**Purpose:** Fix user-reported layout issue — the 10-column table required horizontal scrolling to see right-side content
**Requirement Source:** Follow-up to Kamsi Requirement 5 (Missing Meta Title & Meta Description Detection), user request 2026-07-07
**Business Question:** Can Kamsi (and reviewers) see all key product-meta info at a glance without scrolling sideways, while still being able to inspect full details on demand?
**PostgreSQL Sources Checked:** Not applicable — display-only change, no data re-collected
**External Sources Checked:** Not applicable — no connector calls made for this fix

## What changed
Replaced the wide `<table>` (10 columns, required horizontal scroll on the right-hand columns) with a **Dilaksi-style card list**:
- **Compact summary row** (always visible, no horizontal scroll): Product Title, Collection Type, Title/Description character counts (`T:`/`D:`), and the colour-coded Action Needed badge — all on one line that wraps naturally on narrow screens.
- **Detailed view** (click any row to expand): full Page URL (clickable link), full Product Description, full Meta Title, full Meta Description, Last Updated date.
- **Sorting**: moved from clickable column headers (no longer applicable without a table) to a dropdown (Product Title / Collection Type / Title Length / Description Length / Last Updated / Action Needed) + an Asc/Desc toggle button.
- Search, Collection Type filter, Action Needed filter, Missing Meta Title/Description Yes-No-All toggles, CSV export, KPI cards, and the evidence note are all unchanged — same data, same filtering logic, same 5,179-row dataset.

## Verification
- Row count unchanged: 5,179 (confirmed via the embedded JSON dataset, both locally and on the live deploy).
- No `table.rt` or `tablewrap` markup remains in the generated HTML (grep-verified).
- New markup confirmed present: `id="rowsContainer"` (card container), `id="sortsel"` (sort dropdown).
- Live deploy verified: HTTP 200, dataset intact, new elements present.

## Files modified
- `reports/Kamsi/data/2026-07-07_kamsi_req5_html_builder.py` (CSS/JS/markup rewritten: table → card list + sort dropdown)
- `reports/digital-marketing-member-pages/pages/kamsi-req5-missing-meta-detection.html` (regenerated, live-site)
- `reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html` (regenerated, archival copy)

**No other files touched.** No Dilaksi, Hetheesha, or other Kamsi requirement pages affected.

**Evidence path:** this file · **Validation:** `validation/Kamsi/2026-07-07_kamsi_req5_layout_fix_validation.md`
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed — deployed and verified live
**Known Limitations:** None new; carries forward the same known limitations documented in the original Req 5 evidence file (tie-break rule for Action Needed, tag-fallback lightly exercised)
**Next Steps:** None — closed
**PASS / FAIL:** PASS
