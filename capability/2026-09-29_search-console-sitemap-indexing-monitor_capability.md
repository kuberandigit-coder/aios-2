# Capability — Search Console Sitemap & Indexing Monitor Pattern

**Date:** 2026-09-29
**Owner:** Kuberan (Hetheesha's Task 16, Phase 1)
**Project:** dm-dashboard, ledsone.fr
**Status:** Implemented, backend/frontend validated locally; not run against live Search Console
from any session to date, not deployed

## Capability

Read-only sitemap + indexing-issue detection for a Shopify store, using Google Search Console's
real Sitemaps API and URL Inspection API (not an assumption or crawl-only heuristic), with
priority classification driven by a real traffic/value signal and a day-over-day trend table.

## What problem it solves

Gives a staff member a single page answering "which of our sitemap URLs aren't indexed, and which
of those actually matter" — without any manual GSC UI digging, and without guessing at Search
Console's internal classifications.

## Originating task

`evidence/hetheesha/2026-09-29_task16-search-console-indexing-monitor_evidence.md` (commit
`36c2fb7`, `dev-work`).

## Technical implementation

- New backend package `backend/app/dev_tasks/search_console_indexing/`: `authorization.py`,
  `schema.py`, `sitemaps_api.py` (genuinely new — the first code in this project to call GSC's
  `sitemaps.list` endpoint), `value_signal.py`, `detection.py`, `pipeline.py`, `trends.py`,
  `router.py`, `scheduler.py`.
- New table `public.search_console_indexing_daily_snapshot` — one row per calendar day, powering
  the `/trends` current-vs-previous-period comparison. Correctly reports
  `"available": false, "reason": "Historical comparison unavailable"` on day one rather than
  fabricating a trend.
- Priority rules (NO_ACTION/HIGH/MEDIUM/LOW) driven by Search Console's own literal
  `coverageState` string (never reworded) crossed with a **high-value URL** signal.
- **High-value URL fallback convention** (reusable beyond this task): a URL counts as high-value
  if it already has 10+ GSC impressions in existing stored data; if no impression data exists yet
  for the store, falls back to the dashboard's existing SEO priority convention
  (Homepage/Collection/Product = high-value, Blog/Page = not) — a labelled existing convention,
  not an invented signal.

## Reuse (confirmed in the originating evidence, not duplicated)

- GSC authentication: `google_client.get_gsc_ledsone_fr_access_token` — no new credential.
- Per-URL indexing verdicts: the SAME `structured_data_validation_gsc_inspections` table and
  `choose_sample`/`run_inspections` helpers Task 15 (Structured Data Validation) already built —
  one shared Search Console URL Inspection quota across both tasks, not a second one.
- Sitemap URL list + template classification: `structured_data_validation.discovery.discover_urls()`
  reused as-is.
- Existing GSC impressions signal: Task 13's `french_keyword_research_seed_keywords.gsc_metrics`,
  not a new external data pull.
- Access control: same `auth.verify_token` + `access_grants` model as
  `structured_data_validation.authorization`.
- UI: the shared `jreq-*` CSS classes used by every Development Task page; only page-specific
  pieces (priority boxes, action-flow steps) got new CSS.
- Sync Monitor: registered as a `ScheduledSnapshot`, same shape as Task 15 (weekly, Run Now,
  `resume_if_interrupted=True`).
- **Genuinely new, not a duplicate:** the Sitemaps API call itself — no existing code in this
  project read that endpoint before this task.

## Data sources / APIs

Google Search Console: Sitemaps API (`sitemaps.list`, new), URL Inspection API (shared with Task
15, existing quota). Internal: `french_keyword_research_seed_keywords.gsc_metrics` (Task 13).

## Validation

`python -m py_compile` + `ast.parse` on all 10 new backend files: PASS. `npx vite build`: PASS. A
full `import app.dev_tasks` could not be completed locally (no live Postgres connection on that
dev machine; a pre-existing unrelated task opens a DB connection at import time before this one is
reached — a known limitation of testing this backend outside the server, not introduced by this
task). No live run against the real ledsone.fr Search Console property has been performed from any
session to date.

## Known limitations

No bulk index-coverage export exists in the public Search Console API — reasons come only from the
URL Inspection API, one URL at a time, bounded by the same shared ~2,000/day quota Task 15 uses.
Sitemaps API counts are Google's own per-sitemap aggregate, not a per-URL list. The high-value
fallback is template-type-based only (no GA4/revenue data wired into a page-URL-keyed dataset for
ledsone.fr yet). Trend needs 7+ days of runs before showing anything.

## Evidence

`evidence/hetheesha/2026-09-29_task16-search-console-indexing-monitor_evidence.md`

## Related

`capability/2026-09-17_gsc-404-url-monitor_capability.md` (a different mechanism — manual CSV
upload of GSC's 404 export, UK store — confirmed not a duplicate of this one, left untouched);
Task 13 (seed keywords/GSC metrics), Task 15 (Structured Data Validation, shares the inspection
table/quota).

## Limitations of this capability record

Written as a direct capability-ization of the originating evidence file (2026-10-08, AIOS full
capability backfill) — no new verification was performed beyond what the evidence file already
documents.
