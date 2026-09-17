# Handover — GSC 404 URL Monitor (Dilaksi)

**Date:** 2026-09-17

## What was done

Built a new Development Task, "GSC 404 URL Monitor," inside
`dm-dashboard`. It checks a bounded list of URLs (everything Google
Search Console has traffic data for, last 90 days, up to 500) against
Google's URL Inspection API to find real 404/broken pages, matches
each against the live Shopify catalogue for a possible replacement,
scores a priority, and tracks it through a review/development
workflow. Code-complete, not yet deployed or live-tested.

## Where it's implemented

- Backend: `backend/app/dev_tasks/gsc_404_monitor/` (new package —
  `__init__.py`, `schema.py`, `enrich.py`, `gsc_scanner.py`,
  `router.py`), plus a new `inspect_url()` function in the shared
  `backend/app/google_client.py`.
- Frontend: `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx`,
  registered under Development Tasks in `taskRegistry.js`,
  `AdminLayout.jsx`, `DevLayout.jsx`; also registered as a new Sync
  Monitor scope (`gsc-404-monitor`) in `SalesSyncMonitor.jsx` and
  `DevLayout.jsx`'s Sync Monitor sidebar list.

## How it works

1. `ScheduledSnapshot` (existing Sync Monitor infrastructure) runs
   `_run_scan_and_persist` daily at 4am Sri Lanka time, or on-demand
   via the Sync Monitor's "Run Now" button for scope
   `gsc-404-monitor`.
2. That function fetches the known-URL list from GSC's own Search
   Analytics data (real URLs Google already has traffic data for —
   URL Inspection can't discover new URLs on its own).
3. For each URL, in turn: call GSC's URL Inspection API, and the
   INSTANT that one URL's result comes back, upsert it to Postgres
   (`public.gsc_404_monitor_issues`) with GA4/GSC traffic context and
   a Shopify replacement suggestion already attached. This is why
   results appear live in the table as a scan runs, not all at once
   at the end — this was an explicit, repeated requirement from the
   user this session.
4. The frontend page polls every 5 seconds and shows whatever rows
   exist so far, plus a live "checked X of Y" counter while a scan is
   running.

## Data sources

- Google Search Console URL Inspection API (`urlInspection.index:inspect`)
  — the actual 404/broken-status signal. One URL per call; there is no
  bulk equivalent (confirmed via API audit, see evidence doc).
- Google Search Console Search Analytics API (`searchAnalytics.query`)
  — supplies the candidate URL list AND traffic context (clicks/
  impressions/ctr/position). Never used as an indexing-status source.
- GA4 Data API — organic sessions per path, traffic context only.
- Shopify Admin GraphQL API (`ledsone_uk` store) — read-only, used to
  verify/search for a replacement product or collection.

## Important matching logic

`enrich.find_shopify_replacement`:
1. Strip a trailing `-<digits>` ID/SKU suffix from the broken URL's
   handle; if that shorter handle matches a live, active
   product/collection exactly, that's a 95%-confidence match (the
   strongest, most literal signal available).
2. Otherwise, search the live Shopify catalogue using the broken URL's
   own significant words (stopwords/locale-prefix words stripped), and
   score every candidate by Jaccard token overlap between the broken
   URL's handle words and each candidate's title+handle words. The
   best-scoring candidate above 40% overlap is suggested; confidence is
   that literal overlap percentage, never invented. Below 40%, or with
   no candidates at all, `suggestedUrl` is `None` and the reason field
   says so explicitly.

## Current status

Code-complete, compiles (`py_compile`) and builds (`npx vite build`)
cleanly. **Not deployed. Not live-tested.** No real scan has been run
against production GSC/Shopify data — per explicit instruction not to
execute anything inside the Claude session. Pushed to `dev-work` only
(see git log around this date for the commit).

## Known limitations

- URL Inspection's per-property quota bounds every scan to (currently)
  500 URLs — not a full-site sweep. This is a hard Google-side limit,
  not a shortcut.
- The Shopify matcher uses handle-suffix + token-overlap similarity,
  not a full structured-attribute parser (wattage/colour/material as
  literal fields) — no existing code in this repo parses those
  attributes reliably from Shopify tags, so inventing that here would
  have been exactly the kind of fabrication the original prompt warned
  against.
- Never auto-creates a redirect or modifies Shopify data — by design,
  matches the original prompt's explicit requirement.

## Remaining work

1. Merge `dev-work` → `main`, deploy to the production server.
2. Trigger a Sync Monitor "Run Now" for scope `gsc-404-monitor` and
   confirm real rows populate the table with plausible data.
3. Click through the UI live (filters, review/dev status updates, UAM
   as a non-admin role) to upgrade the validation record from PARTIAL
   to PASS.
4. If Dilaksi wants full attribute-based matching (wattage/colour/
   material as literal fields) later, that would need a decision on
   where those attributes actually live in the Shopify data (tags?
   metafields? title parsing?) before being implemented reliably.

## Owner / Reviewer

**Owner:** Claude (this session), on Kuberan's instruction
**Reviewer:** Kuberan / Dilaksi, after deployment and a live test run
