# Evidence — Kamsi Requirement 6: Dynamic Cross-Filter Counts (All 3 Dropdowns)

**Title:** Duplicate?, Price Mismatch?, and Product Status dropdown counts now recompute based on the other active filters, instead of always showing site-wide totals
**Purpose:** User request — same behavior already built for Req5's Action Needed dropdown, now needed for all 3 filters in Req6
**Requirement Source:** User instruction, 2026-07-08 (reference screenshot: Duplicate=Yes + Price Mismatch=Yes showing "ACTIVE (13794)" — a stale site-wide count, while the actual result set was 1,365 rows)
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## What was explained first (per user request)
**What "Unlisted" means**, confirmed directly from Shopify's own `ProductStatus` GraphQL schema: the product is fully active and sellable, but deliberately hidden from search, collections, and recommendations — reachable only via a direct link (handle/ID/metafield reference). Distinct from Draft (not sellable) and Archived (discontinued); Unlisted products are live, just not discoverable by browsing.

## What was built
- `updateFilterCounts6()`: recomputes each of the 3 dropdowns' option counts based on the **other two** active filters plus the search text (not itself) — e.g. selecting Duplicate=Yes + Price Mismatch=Yes recalculates the Product Status counts from just that subset, instead of the fixed site-wide 13,794/533/46.
- Wired into every filter change (search input, Duplicate?, Price Mismatch?, Product Status) via a new `applyFilter6WithCounts()` wrapper, so counts refresh before the table itself re-filters.
- Status list kept stable (ACTIVE/DRAFT/UNLISTED always shown, even at 0), so the dropdown structure doesn't change shape as filters are combined — only the counts change.

## Verification performed
- Div balance: 189 open / 189 close (unchanged, pure addition)
- `node --check` syntax validation: passed, exit 0
- **Functional simulation reproduced the exact screenshot scenario**: setting Duplicate=Yes + Price Mismatch=Yes recomputed Product Status to **ACTIVE (1,365)**, **DRAFT (49)**, **UNLISTED (16)** — 1,365 matches the "1,365 SKU rows" shown in the user's own screenshot exactly, and 1,365+49+16 = 1,430 matches the Price Mismatch KPI total exactly
- Confirmed Duplicate? dropdown itself correctly reflects the other two filters (Mismatch=Yes, Status=all) without being affected by its own current selection: Yes (1,430), No (0)
- Live deployment fetch confirmed the function is present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_before_req6_dynamic_counts_backup.html` — safety backup

## Deployment
Deployed to Vercel production and verified live: HTTP 200, function confirmed present.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** None
**Next Steps:** none
**PASS / FAIL:** PASS
