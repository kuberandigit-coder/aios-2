# Validation — Kamsi Requirement 2: Low CTR Page Identification

**Title:** Kamsi Req 2 validation · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan
**Purpose:** Confirm every requirement checkpoint. **Requirement Source:** Google Sheet/screenshot via Kuberan.
**Business Question:** collection/blog pages with high visibility but low CTR.

| Check | Result |
|---|---|
| Existing assets checked (Kamsi folders, member pages, grep for prior CTR reports) | PASS |
| Duplicate risk documented (none; EXTEND hub + CREATE NEW report page — no duplicate truth) | PASS |
| GSC source connected (service account, sc-domain:ledsone.co.uk) | PASS |
| Monthly date range confirmed (2026-06-01→2026-06-30, last complete month, no partial data) | PASS |
| Only collection and blog pages included (scope re-checked in code after API filter) | PASS (1,148 collections + 237 blogs) |
| Product pages excluded | PASS |
| Page + query data collected (both dimension sets, paginated) | PASS |
| Main target keyword = highest-impressions query per page | PASS (789 pages; rest "—", GSC-anonymised) |
| CTR converted correctly to percentage (0.0185 → 1.85; 2 decimals) | PASS |
| Flag condition verbatim (CTR<2 → Low CTR else OK) | PASS (1,324 low / 61 OK) |
| Cross-check vs PostgreSQL GSC mirror (70 clicks / 26,370 imps exact match) | PASS |
| HTML search works (URL + keyword fields) | PASS |
| Filters work (Flag / Page Type / CTR Range + reset + live counter) | PASS |
| Sorting works (all 7 columns, numeric-aware) | PASS |
| CSV export works (filtered rows; JS validated with node) | PASS |
| Last updated timestamp added | PASS |
| Mobile responsive styles present | PASS |
| AIOS files saved (all 6 Kamsi folders) | PASS |
| No deployment performed | PASS |

**Files Created / Evidence Location:** see evidence file. **PostgreSQL / External Sources:** GSC API (truth) + PG mirror (verification).
**Known Limitations:** zero-impression pages absent (GSC behaviour); monthly snapshot.
**Next Steps:** approval → deploy → live verify. **Status:** Complete (undeployed) · **PASS/FAIL: PASS**
