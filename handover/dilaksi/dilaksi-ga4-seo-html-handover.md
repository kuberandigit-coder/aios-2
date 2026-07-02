# Handover — Dilaksi GA4 SEO Organic HTML Report

**Title:** Dilaksi GA4 SEO report — handover for GPT/Kuberan/Mani
**Purpose:** Allow anyone to understand and continue this work tomorrow without verbal explanation.
**Requirement source:** Google Sheet (Digital Marketing requirements) gid=2139905564
**Team member:** Dilaksi · **Team:** SEO · **Date:** 2026-07-02

## What was delivered
`reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` — standalone HTML (open by double-click). Top 50 organic landing pages with top GSC query, sessions, users, purchase revenue; summary cards; TOTAL row over all 6,089 pages (24,685 sessions / 20,965 users / £27,206.41).

## The two things you must know
1. **Engagement Rate, Avg Engagement Time, Pages/Session are NOT in PostgreSQL** (whole-DB column scan = 0 hits). They are shown as "N/A — not available in the database". Nothing was invented. To meet Dilaksi's full spec, the GA4 → PostgreSQL export must be extended (engagementRate, userEngagementDuration, screenPageViewsPerSession).
2. **"Last 30 days" is impossible from current data** — the GA4 table stores ~90-day aggregate snapshots (latest: 2026-03-30 → 2026-06-27). Report is honestly labelled "90 days ending 2026-06-27". User approved this (Option A) after stop-conditions were reported.

## Sources used (read-only)
- `google_search_console.ga4_organic_landing_page_revenue` — run_date 2026-06-27, only 'Organic Search' channel (verified), 6,089 rows.
- `google_search_console.gsc_web_query_page` — site sc-domain:ledsone.co.uk, 2026-05-21→2026-06-20, top query per page by clicks.

## File map
| File | Purpose |
|---|---|
| reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html | The deliverable |
| evidence/dilaksi/dilaksi-ga4-seo-postgresql-evidence.md | Full discovery + stop conditions + approval trail |
| validation/dilaksi/dilaksi-ga4-seo-html-validation.md | PASS checklist |
| prompts/dilaksi/dilaksi-ga4-seo-html-report-prompt.md | How to regenerate |
| vercel/dilaksi/dilaksi-ga4-seo-vercel-notes.md | Deploy notes (NOT deployed) |

**Owner/reviewer:** Kuberan · **Status:** DELIVERED, awaiting Dilaksi review · **Validation result:** PASS with limits
**Known limits:** as above + GSC/GA4 measure differently (query is indicative).
**Next step:** (1) Dilaksi reviews; (2) decide Vercel deploy (explicit approval required); (3) raise pipeline extension for the 3 missing metrics and a 30-day window.
**PASS/FAIL rule:** This handover is complete if a new person can regenerate the report and explain every N/A without asking anyone.

## UPDATE 2026-07-02 — Published to Staff-requirements repo

Report pushed to github.com/digitalmarketing69140951-sys/Staff-requirements- at `dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` (commit 0c336de, first commit of that repo). Note: repo name has a trailing hyphen.
