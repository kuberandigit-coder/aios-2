# Handover — Task 16: Search Console, Sitemap & Indexing Monitor (ledsone.fr), Phase 1

**Owner:** Hetheesha  **Reviewer:** Kuberan
**Date:** 2026-09-29
**Status:** Implementation Complete — Manual Verification Pending. Not
recorded as COMPLETED: not deployed, not run against live Search Console
from this session, and not exercised in a browser. No closure record was
created for that reason.

## What this is

A new Development Task that reads Google Search Console data for ledsone.fr
and turns it into a plain-language, prioritised list of indexing problems:
what's wrong, why, which URLs, and what to check next. **Phase 1 is
read-only** — it cannot request indexing, change Shopify, change the
sitemap, or change any Search Console setting. There is no Fix button and no
PASSED/FAILED workflow yet; those are later phases.

## Where it is

- Page: Development Tasks -> **Search Console, Sitemap & Indexing Monitor**
  (task key `tools.DevSearchConsoleIndexingMonitor`), 4 tabs: Overview,
  Sitemaps, Issues, Trends.
- Files: `frontend/src/admin/pages/dev-tasks/SearchConsoleIndexingMonitor.jsx`
  (+ `.css`).
- Backend: `backend/app/dev_tasks/search_console_indexing/`. API prefix
  `/api/dev/search-console-indexing` (6 routes: overview, run/status, run,
  sitemaps, issues, url-detail, trends).
- Database (app DB): one new table,
  `public.search_console_indexing_daily_snapshot` (one row per day, for the
  trend comparison). Everything else is read from tables Task 13 and Task
  15 already maintain — nothing else is duplicated.
- Server job: Sync Monitor entry "Dev — Search Console, Sitemap & Indexing
  Monitor" (weekly, Run Now available, resumes automatically if a deploy
  interrupts it mid-run — same mechanism as Task 15).

## How it works (data sources, actual)

| Source | Use |
|---|---|
| Google Search Console — Sitemaps API (`sitemaps.list`), real, new to this project | Submitted sitemap, submitted/indexed counts per sitemap, warnings, errors, last downloaded |
| Google Search Console — URL Inspection API, via Task 15's SHARED cache table | Per-URL `coverageState` (the literal Google reason), indexing verdict |
| ledsone.fr's own sitemap (crawled), via Task 15's existing sitemap discovery | The URL list + template (Homepage/Collection/Product/Blog-Article/Page) to check |
| Task 13's stored Search Console impressions per URL | The "high-value page" signal (falls back to template type only if Task 13 has no data yet for a URL) |
| PostgreSQL (app DB) | The one new daily snapshot table, for the trend |

**Google Ads, GA4, and Shopify order data were NOT wired in** — this store's
project does not currently have a page-URL-keyed revenue/traffic dataset for
ledsone.fr, so the high-value signal is Search Console impressions plus the
documented template fallback, per the prompt's own instruction not to invent
a new external source.

## Important logic

- A "Google Reason" shown anywhere on this page is always the literal
  Search Console `coverageState` string — never reworded, never invented.
- A URL not yet checked by Search Console is never guessed at — it is
  excluded from the counts, and the Overview banner tells you how many of
  the sitemap's URLs are still unchecked.
- **Quota is shared with Task 15**, not doubled: both tasks write into the
  same `structured_data_validation_gsc_inspections` cache table, so a URL
  checked by one task is available to the other without a second API call.
- HIGH priority = a high-value page not indexed, or a soft 404 / server
  error on a high-value page, or (once 7+ days of history exist) a >10%
  week-on-week drop in indexed pages.
- The Trends tab honestly says "Historical comparison unavailable" until
  the monitor has run on at least two days at least a week apart.

## Current status

Never run yet (no deploy, no server access from this session). No real
counts exist. First real numbers will appear after the first Run Now on the
server.

## Known issues / limitations

1. **No bulk "Excluded" reason export exists in the public Search Console
   API** — only per-URL Inspection results, one URL at a time, quota-bound.
   The Issues tab will only ever cover the URLs that have actually been
   inspected (shared with Task 15), not every sitemap URL at once.
2. **High-value signal** depends on Task 13 having Search Console
   impressions stored for ledsone.fr's pages; until then it falls back to
   template type (Homepage/Collection/Product = high-value).
3. **Trend needs 7+ days of runs** before it shows anything.
4. Not deployed; not tested against live Search Console; not opened in a
   browser.

## Manual checks remaining (for you)

1. Deploy `dev-work` (commit `36c2fb7`) when the Sync Monitor is Idle.
2. Open the page as an admin/dev user; confirm the 4 tabs load and the
   header shows "Site: ledsone.fr".
3. Click Refresh Data (or Run Now on the Sync Monitor). Confirm the Sitemaps
   tab shows real ledsone.fr sitemap data, and the Overview/Issues tabs
   populate after the run finishes.
4. Grant `tools.DevSearchConsoleIndexingMonitor` to Hetheesha in User Access
   Management; confirm the page appears for her and confirm it does NOT
   appear for a staff member without the grant.
5. Open a few issues in the detail drawer; confirm the Google Reason, Why
   This Matters, and Next Action steps read correctly, and that nothing in
   the drawer is clickable as an action (Phase 1 has none).
6. Try the filters (priority, template, indexed/not-indexed, search).
7. Come back after 7+ days and confirm the Trends tab starts comparing
   periods instead of showing "unavailable".
8. Confirm the other Development Tasks and staff pages still open normally.

## Not done

Any later-phase feature: Request Indexing, GSC writes, automatic fixes,
Shopify changes, revalidation, a PASSED/FAILED workflow, automatic task
assignment. Production deployment.
