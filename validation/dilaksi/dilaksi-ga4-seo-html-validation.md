# Validation — Dilaksi GA4 SEO Organic HTML Report

**Title:** Validation of reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html
**Purpose:** Verify the HTML report meets requirements before handover/deploy.
**Requirement source:** Google Sheet gid=2139905564 · **Team member:** Dilaksi · **Team:** SEO
**Business question:** Organic search landing page/query performance with sessions, users, engagement, revenue.
**Date:** 2026-07-02 · **Owner/reviewer:** Kuberan (GPT validation layer)

| Check | Result |
|---|---|
| File opens locally as standalone HTML (no external/paid dependencies) | PASS — pure inline CSS, no JS, no CDN |
| All 8 requested columns present in table | PASS — 3 unavailable metrics shown as "N/A", not invented |
| Data from PostgreSQL, not hardcoded screenshots | PASS — query outputs embedded verbatim from `ga4_organic_landing_page_revenue` run_date 2026-06-27 (50 rows) + GSC top-query join |
| Channel filter = Organic Search only | PASS — verified: table contains only 'Organic Search' channel rows |
| Date range display | PASS with limit — labelled "90 days ending 2026-06-27" because a true last-30-days GA4 window does not exist in the DB (documented stop condition, user approved Option A) |
| Total/Avg row | PASS — TOTAL row covers all 6,089 pages: 24,685 sessions / 20,965 users / £27,206.41 |
| Currency formatting (£, thousands separators) | PASS |
| Summary cards (sessions, users, revenue, engagement) | PASS — engagement card explicitly "Not available in database" |
| Generated date, data source note, known limits note | PASS — footnotes section |
| Row-count evidence | 50 rows displayed of 6,089 total; totals from full aggregate query |

**PostgreSQL source checked:** google_search_console.ga4_organic_landing_page_revenue (run 2026-06-27), gsc_web_query_page (2026-05-21→2026-06-20)
**Files created/modified:** the HTML report + 5 AIOS files
**Evidence path:** evidence/dilaksi/dilaksi-ga4-seo-postgresql-evidence.md
**Validation result:** **PASS (with documented limits)**
**Status:** VALIDATED — ready for Dilaksi review; NOT deployed to Vercel
**Known limits:** no engagement metrics in DB; 90-day window not 30; GSC query is indicative (different measurement system); data freshness 2026-06-27/2026-06-20.
**Next step:** Dilaksi review → optional Vercel deploy (needs explicit approval) → pipeline extension for missing metrics.
**PASS/FAIL rule:** PASS only if all columns present, no invented data, totals correct, limits disclosed — all met.
