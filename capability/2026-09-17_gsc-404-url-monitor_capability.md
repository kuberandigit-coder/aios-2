# Capability — GSC 404 URL Monitor (via Search Console URL Inspection API)

**Date:** 2026-09-17
**Owner:** Kuberan (SEO team: Dilaksi)
**Staff/Requirement:** Dilaksi — GSC 404 URL Monitoring, built as a Development Task (internal dev tooling, same convention as Meta Title & Description Audit / Alt Text Keyword Finder)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** PARTIAL — code complete, compiles/builds clean, not yet live-tested (see validation record)

## Relationship to the removed Screaming Frog capability

This supersedes `2026-09-17_broken-link-404-monitor_capability.md`
(now updated to point here). Same problem domain (broken/404 URL
detection + traffic-prioritized remediation backlog), genuinely
different data source and design: no external CLI, no local crawl --
purely Google's own Search Console API, plus a real Shopify
replacement-matching engine (the earlier version only suggested a
redirect on an exact handle-suffix match; this version adds a second,
token-overlap similarity signal).

## Capability

Given the existing GSC service-account credential, check a bounded
list of real, GSC-known URLs against Google's URL Inspection API to
find genuinely broken (404/soft-404/error) pages, cross-reference each
with real GA4/GSC traffic and a live Shopify catalogue search for a
possible replacement, assign a transparent priority, and track the
finding through a review/development workflow -- all without ever
auto-creating a redirect or modifying Shopify data. Results persist to
Postgres immediately per URL as a scan runs (not batched), and the
whole task runs on the same Sync Monitor schedule/UI as every other
scheduled dev-task page in this app.

## Technical knowledge (reusable for future "check GSC for X" tasks)

- **Google Search Console has no bulk "list all broken/error URLs"
  API.** `searchAnalytics.query` (clicks/impressions/position) and
  `urlInspection.index:inspect` (real per-URL crawl verdict) are
  different endpoints with no overlap -- the former can't tell you if
  a page is broken, the latter can't be queried in bulk. Any future
  task needing GSC's crawl/indexing status for many URLs will hit this
  same one-call-per-URL constraint; budget accordingly (Google's own
  per-property quota, not a code limitation).
- **`ScheduledSnapshot` supports arbitrarily slow `compute_fn`s.** It
  was designed around ~15s-scale computations, but nothing about the
  class assumes a short duration -- registering a 20-30-minute scan as
  a `compute_fn` worked cleanly and the existing Sync Monitor UI
  (running/last-success/next-scheduled) needed zero changes to display
  it correctly.
- **Live, per-record persistence pattern**: instead of collecting all
  results into memory and writing once at the end, pass an
  `on_result` callback into the slow-scan function and upsert to
  Postgres inside it, immediately, per item. This is directly reusable
  for any future task that needs its results visible in the UI while a
  long-running background job is still in progress, rather than an
  all-or-nothing wait.
- **Jaccard token-overlap similarity** (shared words / all words
  across two title+handle token sets) is a real, checkable, non-
  fabricated way to score "how similar is this broken URL's handle to
  a live product/collection" without inventing a fake ML-style
  confidence number -- the percentage IS the literal overlap ratio.

## Files / Components

- `backend/app/dev_tasks/gsc_404_monitor/{__init__.py, schema.py,
  enrich.py, gsc_scanner.py, router.py}`
- `backend/app/google_client.py` (added `inspect_url`)
- `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx`

## Data Sources / Tools

Google Search Console URL Inspection API + Search Analytics API (site
`sc-domain:ledsone.co.uk`), GA4 Data API (property `408110563`),
Shopify Admin GraphQL API (`ledsone_uk`, read-only), this app's own
Postgres (1 new table) + existing Sync Monitor infrastructure
(`sales_cache`).

## Validation

`validation/dilaksi/2026-09-17_gsc-404-url-monitor_validation.md` --
code-review-level PASS on every checked item; live-system PARTIAL
(explicitly not run in this session, per instruction).

## Reuse

The "known-URL-list from Search Analytics -> per-URL Inspection check
-> live per-result Postgres upsert -> ScheduledSnapshot/Sync Monitor
registration" shape here is directly reusable for any future GSC-
crawl-status-based monitoring task (e.g. checking canonical-tag issues
or mobile-usability status per URL, both of which are also only
available via per-URL Inspection-style calls, not bulk reports).

## Evidence

`evidence/dilaksi/2026-09-17_gsc-404-url-monitor_evidence.md`

## Limitations

- Bounded to 500 URLs per scan (Google's URL Inspection quota) -- not
  a full-site sweep.
- Shopify matching is handle-suffix + token-overlap similarity, not a
  structured wattage/colour/material attribute parser (no existing
  reliable source for those as literal fields in this codebase).
- Not yet live-tested against real production data as of this record.
