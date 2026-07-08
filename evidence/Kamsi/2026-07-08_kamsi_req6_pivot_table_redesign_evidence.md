# Evidence — Kamsi Requirement 6: Table Redesign (One Row Per SKU, Expandable Extra Listings)

**Title:** Rebuilt Req6's table from one-row-per-listing to one-row-per-SKU with side-by-side listing columns, per user's reference spreadsheet, then removed Product Title columns and added an expandable detail row for SKUs with more than 3 listings
**Purpose:** Match the user's exact expected table shape and make all duplicate listings inspectable, not just the first 3
**Requirement Source:** User instruction, 2026-07-08 (reference screenshot of a spreadsheet with Listing URL 1/2, Current/Compare Price 1/2 columns)
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## Design decisions confirmed with the user before building
1. Column width for multiple listings: **capped at 3 side-by-side slots** (not all up to 12, not a second tab) — SKUs with more than 3 listings show a "+N more" affordance instead of endless columns.
2. This pivoted view **replaces** the original one-row-per-listing table entirely (not an additional view).
3. The reference spreadsheet showed a non-duplicate SKU with Price Mismatch=Yes — confirmed as a **mistake in the sample sheet**; the original rule stands (Price Mismatch can only be Yes when Duplicate=Yes).

## What was built (in 3 passes, same session)
**Pass 1 — pivot to one row per SKU:**
- Grouped the existing 17,542 variant/listing rows by SKU into **14,373 rows** (14,264 unique SKUs + 109 blank-SKU rows, unchanged from the prior KPIs)
- Table columns: SKU, (Listing URL / Product Title / Current Price / Compare Price) × 3 slots, Duplicate?, Duplicate Count, Price Mismatch?, Last Checked
- Discovered and disclosed: **2,385 of 2,402 duplicate SKUs belong to genuinely different products** (not the same product listed twice) — this is why Product Title was shown per-slot rather than once per row in the first draft

**Pass 2 — remove Product Title columns** (user request): dropped all 3 "Product Title N" columns and their data, updated the search index (now searches SKU + Listing URL only, not title text) and the legend text accordingly.

**Pass 3 — expandable extra listings** (user request, reference screenshot showing a 4-listing SKU with "+1 more"): for any SKU with more than 3 listings, the 3rd Listing URL cell now shows a clickable "+N more ▾" button. Clicking it inserts a detail row directly below showing every remaining listing (URL, Current Price, Compare Price); clicking again collapses it. Regenerated the underlying dataset to carry the full (uncapped) listing list per SKU for this — previously only the first 3 were kept in the embedded data.

## Verification performed
- Div balance: 191 open / 191 close after all 3 passes
- `node --check` syntax validation: passed, exit 0
- **Functional simulation with a mock DOM** confirmed:
  - Full row count: 14,373 (unchanged)
  - Search, Duplicate?, Price Mismatch?, Product Status filters all return exactly the same counts as the KPI cards (2,402 / 1,430 / etc.)
  - Sort by SKU and by a listing's Current Price both work correctly
  - **Expand/collapse**: clicking a "+N more" button on the sample SKU `12IP20100` (4 total listings) correctly reveals a detail row listing all 4 URLs with prices, labeled "All 4 listings for SKU 12IP20100"; clicking again correctly collapses it
- Live deployment fetch confirmed all of the above present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_req6_pivot_by_sku.py`, `2026-07-08_kamsi_req6_pivot_rows.json` — first pivot pass (capped, with titles)
- `reports/Kamsi/data/2026-07-08_kamsi_req6_pivot_rows_full.json` — uncapped pivot data used for the expand feature
- `reports/Kamsi/data/2026-07-08_kamsi_req6_replace_with_pivot.py`, `2026-07-08_kamsi_req6_add_expand_row.py` — build/patch scripts
- 3 safety backups taken before each pass (`2026-07-08_kamsi_before_req6_pivot_table_backup.html`, `..._remove_title_backup.html`, `..._expand_backup.html`)

## Deployment
Deployed to Vercel production and verified live: HTTP 200, Product Title columns absent, expand button present, all 6 tabs intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** The expand/collapse state (`openRows6`) resets whenever the search/filter/sort changes trigger a re-render, since it's tracked in-memory rather than persisted — this is standard behavior for this kind of client-side table and matches how filters already reset pagination.
**Next Steps:** none
**PASS / FAIL:** PASS
