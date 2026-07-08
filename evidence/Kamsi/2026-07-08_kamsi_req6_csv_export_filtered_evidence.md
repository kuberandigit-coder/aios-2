# Evidence — Kamsi Requirement 6: CSV Export (Filtered Data Only)

**Title:** Re-added an "Export CSV" button to Req6, exporting only the currently filtered/searched set, not the full dataset
**Purpose:** User request — export must reflect whatever filters (search, Duplicate?, Price Mismatch?, Product Status) are currently applied
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## What was added
- "Export CSV" button in the toolbar, calling `exp6()`
- `exp6()` iterates `filtered6` — the same array the table itself renders from after search/Duplicate?/Price Mismatch?/Product Status filters are applied — **not** the raw `ROWS6` (14,373 rows)
- Exported columns: SKU, Listing URL, Current Price (£), Compare Price (£), Duplicate, Duplicate Count, Price Mismatch

## Verification performed
- Div balance: 189 open / 189 close (unchanged, pure addition)
- `node --check` syntax validation: passed, exit 0
- **Functional simulation confirmed the core requirement directly**: with no filter applied, `ROWS6.length` = 14,373; after searching for a specific SKU (`12IP20100`), `filtered6.length` = 1; calling `exp6()` and inspecting the actual Blob content produced exactly **2 lines** (header + the 1 matching row) — proving the export genuinely reflects the filtered set, not the full 14,373-row dataset
- Live deployment fetch confirmed the button is present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_before_req6_add_csv_export_backup.html` — safety backup

## Deployment
Deployed to Vercel production and verified live: HTTP 200, Export CSV button present, all 6 tabs intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** None
**Next Steps:** none
**PASS / FAIL:** PASS
