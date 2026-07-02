# Evidence — Dilaksi GA4 SEO Report: PostgreSQL Discovery (STOPPED)

**Title:** Dilaksi GA4 SEO Organic Search report — PostgreSQL source discovery
**Purpose:** Verify whether PostgreSQL can supply all 8 requested fields before building the HTML report.
**Requirement source:** Google Sheet (Digital Marketing requirements), tab gid=2139905564 — "Core GA4 Data for SEO — Sample / Last 30 Days / Organic Search only"
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which organic search landing pages/queries generated sessions, users, engagement, pages/session, and purchase revenue in the last 30 days?
**Date:** 2026-07-02 · **Owner/reviewer:** Kuberan (GPT = validation layer)
**Mode:** Read-only inspection only. No data changed.

## Existing asset search (duplicate-risk check)

- `prompts/dilaksi/`, `evidence/dilaksi/`, `validation/dilaksi/`, `handover/dilaksi/`, `reports/dilaksi/`, `vercel/dilaksi/` — **none existed** (no dilaksi folders at all).
- Wider search `*dilaksi*`, `*ga4*`, `*organic*`: only Shopify-based organic-sales docs (2026-06-25, 2026-06-30) — different source (Shopify, not GA4), not a duplicate.
- **Duplicate-risk: GREEN.**

## PostgreSQL objects inspected (read-only)

Schemas scanned: 22 user schemas. Relevant: `google_search_console`, `analytics`.

| Object | Relevance | Finding |
|---|---|---|
| google_search_console.ga4_organic_landing_page_revenue | PRIMARY GA4 source | Columns: landing_page, session_default_channel_group, sessions, active_users, ecommerce_purchases, purchase_revenue, date_start, date_end, run_date. **Only 'Organic Search' channel present (verified)** — channel filter OK. |
| google_search_console.ga4_traffic_source_revenue | secondary | Same metric set by source/medium — no engagement fields either |
| google_search_console.ga4_ai_referral_revenue | not relevant | AI referrals |
| google_search_console.gsc_web_query_page | Query source | Daily query+page clicks/impressions/ctr/position. Date range 2026-03-20 → **2026-06-20** (12 days stale) |
| analytics.* (7 tables) | not relevant | product segment / stock tables, not GA4 |
| information_schema.columns scan | engagement fields | `column_name ~* 'engage|pages_per|screen_page|views_per'` → **0 rows in entire database** |

## STOP CONDITIONS TRIGGERED

1. **Required fields do not exist in PostgreSQL:** Engagement Rate, Avg. Engagement Time, and Pages/Session are not stored in any table (full-database column scan returned zero matches). 3 of 8 requested fields cannot be produced without inventing data.
2. **"Last 30 days" filter cannot be verified for GA4 data:** `ga4_organic_landing_page_revenue` stores rolling ~90-day aggregate snapshots (e.g. latest run 2026-06-27 covers 2026-03-30 → 2026-06-27, 6,089 rows). There are no daily GA4 rows, so a true last-30-days GA4 slice cannot be computed from this table.
3. Secondary freshness issues: latest GA4 snapshot run is 2026-06-27 (5 days old); GSC query data ends 2026-06-20 (12 days old).

## What IS available today (no invention needed)

- Landing Page, Sessions, Users (active_users), Purchases, Purchase Revenue — Organic Search only, ~90-day window ending 2026-06-27.
- Query — joinable from GSC `gsc_web_query_page` (top query per page, GSC last-30-days-of-available-data), with the caveat that GSC clicks ≠ GA4 sessions.

## Options for GPT/requester decision

- **Option A (recommended):** Approve a reduced report — 5 available fields + Query from GSC, window labelled honestly as "90 days ending 2026-06-27", engagement columns shown as "N/A — not collected". No invented data.
- **Option B:** Extend the GA4 export pipeline to add engagementRate, averageSessionDuration/userEngagementDuration, screenPageViewsPerSession and a daily or 30-day window, then build the report as specified.
- **Option C:** Pull the missing metrics live from the GA4 API instead of PostgreSQL (outside current approved scope).

**Files created/modified:** this evidence file only (HTML intentionally NOT built — stop conditions).
**Validation result:** N/A — build not started.
**Status:** STOPPED — awaiting GPT/requester decision.

## UPDATE 2026-07-02 — Option A approved by user; report BUILT

- User instruction: "i need the HTML code with available data, mark not available data as not available in the database".
- Final query: top 50 landing pages from `ga4_organic_landing_page_revenue` (run_date 2026-06-27, Organic Search only) LEFT JOIN top GSC query per page (`gsc_web_query_page`, sc-domain:ledsone.co.uk, date >= 2026-05-21, ranked by clicks; domain+querystring stripped for path match).
- Row count: 50 rows displayed; totals row computed over all 6,089 rows: sessions 24,685, users 20,965, purchases 759, revenue £27,206.41.
- Engagement Rate / Avg Engagement Time / Pages/Session rendered as "N/A — not available in the database" (summary card states it explicitly). No invented data.
- Output: `reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` — validated PASS (see validation file).
**Known limits:** Google Sheet itself not opened (no Sheets access from this session); requirement taken from the prompt text. GA4 property inspected: 408110563.
**Next step:** GPT/requester chooses Option A/B/C.
**PASS/FAIL rule applied:** Building HTML now would FAIL ("data hardcoded/invented without approval"); stopping with documented evidence = correct per stop conditions.

## UPDATE 2026-07-02 — Deep re-verification of missing metrics (user requested confirmation)

- Full information_schema scan (all schemas) for engag|duration|bounce|dwell|time_on|pageview|screen|views|per_session|events: only unrelated hits (Amazon ASIN traffic, ETL logs, task plans). No GA4 engagement columns exist.
- All 9 GA4 tables checked: metrics limited to sessions, active_users, ecommerce_purchases, purchase_revenue (+item_views). CONFIRMED: Engagement Rate, Avg Engagement Time, Pages/Session are NOT in PostgreSQL.
- New finding: raw_data.ga4_landing_page_daily is a daily landing-page table that could support a true last-30-days window, but it holds 0 rows (pipeline never loaded). Filling it + adding engagement metrics to the export = full Dilaksi spec.
