# Evidence — Kamsi Requirements: UI Simplification (Remove Sort/Export Controls)

**Title:** Removed Sort/Export CSV controls from Kamsi Req 5, Export CSV from Req 1 & Req 2; updated index.html report count
**Purpose:** Simplify the UI per user request — remove controls not wanted, keep report count accurate
**Requirement Source:** Direct user instruction, 2026-07-07 (follow-up to Kamsi Req 5 layout fix)
**Business Question:** Does Kamsi's dashboard reflect the exact UI the user wants, with an accurate live report count?
**PostgreSQL Sources Checked:** Not applicable — UI-only change, no data re-collected
**External Sources Checked:** Not applicable — no connector calls made

## What changed
1. **Kamsi Req 5** (`kamsi-req5-missing-meta-detection.html`): removed the "Sort by" dropdown + Asc/Desc toggle button, and removed the "Export CSV" button, from both the toolbar markup and the JS (event handlers, `csvEscape`/export function deleted). Search, Collection Type filter, Action Needed filter, Missing Meta Title/Description Yes/No/All toggles, pagination, and the no-scroll card/detailed-view layout are all unchanged.
2. **Kamsi Req 1** (`kamsi-req1-slow-moving-products.html`) and **Req 2** (`kamsi-req2-low-ctr-pages.html`): removed the "Export CSV" button (`<button class="primary" onclick="exp()">Export CSV</button>`). "Reset filters" button and all other functionality untouched.
3. **`reports/digital-marketing-member-pages/index.html`**: updated Kamsi's card status from "4 Reports Live" to **"5 Reports Live"** (Req 5 is now live).

## Data-safety note (important)
Before committing, `git status` unexpectedly showed 4 unrelated files as deleted (`pages/kamsi.html`, `pages/ripson.html`, `pages/thanishtika.html`, `pages/thishoban.html`) that were **never touched in this session**. These were missing from disk (confirmed via directory listing) but present in git history. Rather than commit their deletion, they were restored via `git checkout HEAD -- <paths>` before proceeding — confirmed back on disk and byte-identical to the last commit. This was likely a local sync artifact (e.g. OneDrive), not an intentional change; flagged here for visibility.

## Files modified
- `reports/Kamsi/data/2026-07-07_kamsi_req5_html_builder.py`
- `reports/digital-marketing-member-pages/pages/kamsi-req5-missing-meta-detection.html`
- `reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html`
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-pages.html`
- `reports/digital-marketing-member-pages/index.html`

**No Dilaksi or Hetheesha files touched.**

**Evidence path:** this file · **Validation:** `validation/Kamsi/2026-07-07_kamsi_ui_simplification_validation.md`
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed — deploying now per user instruction
**Known Limitations:** None new
**Next Steps:** Deploy, verify live, sync to Staff-requirements
**PASS / FAIL:** PASS
