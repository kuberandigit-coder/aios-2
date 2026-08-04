# Handover — sales25.js/sales25.html: 2025 Full-Year Backfill (Jul–Dec)

**Title:** Extend 2025 Sales Data from Jan–Jun to Full Year (Jul–Dec)
**Requirement:** Follow-on to the 2026-07-29 Jan–Jun backfill — user asked to finish the rest of 2025.
**Files Modified:** `api/sales25.js`, `pages/sales25.html`
**Files Created:** 42 snapshot JSONs under `api/data/sales25-*-2025-{07..12}.json`
**Evidence Location:** `evidence/salesuk/2026-08-04_2025-full-year-backfill-jul-dec.md`
**Validation Result:** `validation/salesuk/2026-08-04_2025-full-year-backfill-jul-dec.md` — PASS
**Owner:** Muguntha (management)
**Status:** COMPLETE — deployed, verified live, committed and pushed (`213fb01`)
**Known Limitations:** None known. Full 2025 calendar year now has real Shopify order data for all 7 attribution groups.
**Next Step:** None outstanding. If the user later requests 2025 Kamsi/Dilaksi Organic-split tabs or other UI additions to `sales25.html` beyond the month range, that's separate scope.
**PASS/FAIL:** PASS

## What was done
1. This session was launched twice as a background job and interrupted by the user both times mid-run — first interruption happened after only July's 7 groups were generated; the second resumed and completed August–December.
2. After the second interruption, the user asked "what about now 2025 sales" — at that point all 42 snapshot files existed locally but the live deployment was still serving August onward via the (working but slow) live-Shopify fallback, because no redeploy had happened since the last files were generated.
3. Redeployed to bake all 42 snapshot files into the Vercel bundle. Verified August, October, November, and December all now return `cacheStatus: "static-snapshot"` with real, non-zero sales figures.
4. Committed and pushed everything (sales25.js, sales25.html, all 42 snapshots) in a single commit alongside the muguntha.html redesign work also completed the same session — commit `213fb01`.

## Where to find things
- Backend: `reports/digital-marketing-member-pages/api/sales25.js` — `SUPPORTED_MONTHS` constant near the top
- Frontend: `reports/digital-marketing-member-pages/pages/sales25.html`
- Snapshots: `reports/digital-marketing-member-pages/api/data/sales25-*-2025-*.json`
- Regeneration script: `reports/digital-marketing-member-pages/scripts/bulk-sales25-refresh.js`
