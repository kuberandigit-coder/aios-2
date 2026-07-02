# Prompt — Dilaksi GA4 SEO Organic HTML Report (Reusable)

**Title:** Regenerate Dilaksi's GA4 SEO Organic Search HTML report
**Purpose:** Reusable prompt to rebuild/refresh the report from PostgreSQL.
**Requirement source:** Google Sheet (Digital Marketing requirements), gid=2139905564
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which organic search landing pages/queries generated sessions, users, engagement, and purchase revenue?

## Reusable prompt

> Rebuild `reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` from PostgreSQL (read-only):
> 1. Latest snapshot: `SELECT max(run_date) FROM google_search_console.ga4_organic_landing_page_revenue`.
> 2. Top 50 landing pages by sessions for that run_date (columns: landing_page, sessions, active_users, ecommerce_purchases, purchase_revenue). Totals row = SUM over ALL rows of that run_date.
> 3. Top query per landing page: `google_search_console.gsc_web_query_page`, site_url='sc-domain:ledsone.co.uk', last 30 days of available GSC dates, strip domain + querystring from page, rank by clicks.
> 4. Engagement Rate / Avg Engagement Time / Pages per Session: mark "N/A — not available in the database" unless the export pipeline has been extended (recheck `information_schema.columns` for `engage|pages_per|views_per`).
> 5. Label the date range honestly from date_start/date_end (currently ~90-day windows, NOT last 30 days).
> 6. Save evidence/validation per AIOS rules; do not invent data.

**PostgreSQL source checked:** google_search_console.ga4_organic_landing_page_revenue, gsc_web_query_page
**Files created/modified:** this prompt; report HTML; evidence, validation, handover, vercel notes (see below)
**Evidence path:** evidence/dilaksi/dilaksi-ga4-seo-postgresql-evidence.md
**Validation result:** see validation/dilaksi/dilaksi-ga4-seo-html-validation.md (PASS with limits)
**Owner/reviewer:** Kuberan (GPT validation layer)
**Status:** ACTIVE
**Known limits:** GA4 export = 90-day snapshots, no engagement metrics; GSC lags ~12 days.
**Next step:** Extend GA4 export (Option B) for full spec.
**PASS/FAIL rule:** PASS if HTML regenerated from live PostgreSQL with honest labels and evidence saved; FAIL if any metric is invented or window mislabelled.
