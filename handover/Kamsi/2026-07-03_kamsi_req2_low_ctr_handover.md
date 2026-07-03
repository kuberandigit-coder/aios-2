# Handover — Kamsi Requirement 2: Low CTR Page Identification

**Title:** Kamsi Req 2 handover · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** Delivered, deploy pending approval
**Purpose:** Continue without re-discovery. **Requirement Source:** Google Sheet/screenshot via Kuberan.
**Business Question:** collection/blog pages with high search visibility but low CTR.

## What exists
- Report (both copies): `reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-pages.html` + `reports/Kamsi/kamsi-requirement-2-low-ctr-pages.html`
- Pipeline: `reports/Kamsi/data/2026-07-03_kamsi_req2_gsc_fetch.py` (GSC API → CSV) → `2026-07-03_kamsi_req2_page_builder.py` (CSV → page). Monthly rerun = change dates in both, run both.
- Hub/index updated: kamsi.html "2 reports"; index Kamsi card R2 button.

## Key numbers (June 2026)
1,385 pages (1,148 collections / 237 blogs) · 1,324 Low CTR · avg CTR 0.33% · 577,976 impressions · 1,894 clicks.

## Sources
GSC API sc-domain:ledsone.co.uk (source of truth; key C:\Users\PC\.keys\ga4-service-account.json). PG mirror google_search_console.gsc_web_page verified matching (cross-check only). No PG SEO-metadata tables exist for enrichment.

## Awaiting Kuberan
- **Deploy approval.** Deploy = CLI (`vercel deploy --prod --yes` in the dashboard folder) or authorized-author git push (digitalmarketing69140951@gmail.com — Vercel blocks unauthorized git authors; see docs 2026-07-03).
- Whether product pages should ever be added (excluded per requirement).

**Files Created / Evidence / Validation:** see evidence + validation files (2026-07-03 req2).
**Known Limitations:** monthly snapshot; GSC-anonymised queries → "—" keywords.
**Next Steps:** approval → deploy → live verify → append deployment record to vercel notes.
**PASS/FAIL:** PASS
