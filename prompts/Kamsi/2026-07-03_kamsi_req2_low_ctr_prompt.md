# Prompt Copy — Kamsi Requirement 2: Low CTR Page Identification

**Title:** Kamsi Req 2 prompt (condensed) · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan
**Purpose:** Preserve the requirement for reruns. **Requirement Source:** Google Sheet/screenshot sample via Kuberan, 2026-07-03.
**Business Question:** Which collection and blog pages have high search visibility but low click-through rate and need SEO improvement?
**Status:** Delivered (deploy pending approval)

## Operative rules (verbatim where it matters)
- Scope: URLs containing /collections/, /blogs/, /blog/ only. NO product pages without Kuberan approval.
- Columns: Page URL, Target Keyword, Impressions, Clicks, CTR (%), Avg Position, Flag.
- Flag: **CTR (%) < 2 → Low CTR, else OK.**
- Target Keyword = highest-impressions query for the page.
- Date range: most recent complete month only (no partial month without approval).
- CTR as percentage (0.0185 → 1.85%).
- Read-only everywhere; Dilaksi design; no deploy without approval; no invented logic; extend existing Kamsi dashboard (no duplicate truth).

## Rerun prompt
```
Rerun Kamsi Requirement 2 (Low CTR pages) for month <YYYY-MM>:
1. Edit START/END in reports/Kamsi/data/2026-07-03_kamsi_req2_gsc_fetch.py to the new complete month and run it (GSC API, sc-domain:ledsone.co.uk, service account key C:\Users\PC\.keys\ga4-service-account.json).
2. Update MONTH/GEN in 2026-07-03_kamsi_req2_page_builder.py and run it — regenerates both page copies.
3. Verify KPIs vs CSV, update kamsi.html/index if counts changed, save AIOS files, commit, push origin. Deploy only with Kuberan approval.
```

**Files Created / Evidence / Validation:** see `evidence/Kamsi/` + `validation/Kamsi/` (2026-07-03 req2 files).
**PostgreSQL Sources Checked:** google_search_console.gsc_web_page (mirror; cross-check only). **External Sources Checked:** GSC API.
**Known Limitations:** GSC omits zero-impression pages; some pages have no query rows (anonymised) → keyword "—".
**Next Steps:** deploy on approval. **PASS/FAIL:** PASS
