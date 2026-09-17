# Capability — GSC 404 URL Monitor (via Search Console URL Inspection API)

**Date:** 2026-09-17
**Owner:** Kuberan (SEO team: Dilaksi)
**Staff/Requirement:** Dilaksi — GSC 404 URL Monitoring, built as a Development Task (internal dev tooling, same convention as Meta Title & Description Audit / Alt Text Keyword Finder)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** PARTIAL — code complete, compiles/builds clean, not yet live-tested (see validation record)

## UPDATE (2026-09-17, later same day) — design changed significantly, now live-tested

Several rounds of explicit instruction changed this task materially
from the original design described below. Original text is kept for
history (never delete previous evidence); this update reflects the
CURRENT live state.

**Data gathering — automatic scan REMOVED, manual upload only:**
The original design (a `ScheduledSnapshot`-driven automatic URL
Inspection scan, `gsc_scanner.py`, registered with Sync Monitor) was
removed entirely per explicit instruction. It now works exclusively
from a **manually uploaded GSC export** (Search Console → Pages → Not
found (404) → Export, a .zip or .csv) — every row is a URL Google
itself already confirmed, not a guessed-and-checked candidate.
`gsc_scanner.py` and the Sync Monitor registration are deleted;
`csv_import.py` parses the real export shape (Table.csv + Metadata.csv
inside the zip).

**Shopify matching — now AI-based, local LLM first:**
Replaced the original handle-suffix + token-overlap-only matcher with
an AI call using a specific user-supplied prompt template, given a
real live-fetched candidate list of Shopify products/collections in
the same category (the AI can only pick a URL actually in that list —
never a fabricated one). **Uses the self-hosted local LLM (Qwen3-Next,
same `LOCAL_LLM_*` credential already proven in
`alt_text_keywords/ai_alt_text.py`) first, Gemini only as a fallback**
if the local endpoint is unreachable — switched away from
Gemini-primary after live testing showed repeated Gemini calls
exhausting its quota and slowing every upload down. Matching is capped
at a hard timeout per row (started at 20-30s, found live that a single
row could otherwise stall an entire import for minutes) and runs
**5 rows in parallel** (verified live that the local LLM server
handles concurrent requests fine) instead of strictly one at a time —
real per-row latency measured live at ~8.6s for the actual matching
prompt (candidate list + full instructions) on the 80B local model.
A URL's match is also cached (`schema.get_existing_matches`) so a
re-upload of an already-seen URL skips re-matching entirely.

**Status workflow simplified:** the original `review_status` +
`development_status` two-column design was collapsed to a single
`status` column (`Pending`/`Done`). Selecting `Done` triggers a real
live HTTP check of the URL right then (`router.py`'s
`verify_live_redirect`) and is only accepted if the page no longer
errors — never trusted blindly. A fresh upload auto-marks a
previously-uploaded URL missing from the new file as `Done` (Google no
longer lists it), moving it out of the main "All URLs" table into a
separate "Past Data" tab; a "Done" tab shows only manually-confirmed
ones, with who confirmed it and when.

**New "Non-Indexed" tab added** — a second, separate dataset+upload
for GSC's Page Indexing "Crawled - currently not indexed" export
(different report, same no-public-API limitation). Locale-prefixed
URLs (`/pl/`, `/nl/`, `/es/`, etc. right after the domain) are
automatically excluded on upload and never stored — only true UK
(no-locale) URLs are kept, since a locale variant was never meant to
be indexed on this property. Deliberately simpler than the 404 table:
no Shopify/AI matching, no traffic enrichment, no live-redirect
verification (there's no API to verify indexing status) — `Done` here
is purely a manual "reviewed/actioned" marker.

**Confirmed real, hard limitation — no way to deep-link a specific URL
into GSC's URL Inspection tool.** A "quick link" feature was built,
live-tested by the user (real screenshots), and found broken: GSC's
inspect page's `id=` parameter expects an **opaque internal token**
(e.g. `EtZx62rhZB3-6i-CWS5MEQ`) that Google only generates once a URL
is actually searched inside its own UI — passing the real URL there
404s. There is no public, constructable link format for this; it was
**removed from the code entirely** per explicit instruction rather
than left as a broken feature. This is a genuine Google-side
limitation, not a bug — record it so a future attempt at the same idea
doesn't re-discover this the hard way.

**Live-verified working (2026-09-17):** a real 1000+ URL GSC export
was uploaded to production and processed successfully (988+ rows
persisted, live per-row, correct priority/KPI distribution observed:
e.g. 1,001 total, 220 Shopify replacements found, 5 High/90
Medium/199 Low priority in one real run) — this task has now actually
been exercised against real data, upgrading the "not yet live-tested"
status below for the core import+match+persist flow specifically
(status/History/Past Data/Non-Indexed workflows were exercised live
too via the same session).

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

## Files / Components (current, 2026-09-17 later update)

- `backend/app/dev_tasks/gsc_404_monitor/{__init__.py, schema.py,
  non_indexed_schema.py, enrich.py, csv_import.py, router.py}` --
  `gsc_scanner.py` deleted (automatic scan removed)
- `backend/app/google_client.py` (`inspect_url` also removed --
  unused once the automatic scan was dropped)
- `backend/app/ai_shared.py` (`call_gemini`, fallback only)
- `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx` -- 4 tabs:
  All URLs, Done, Past Data, Non-Indexed

## Data Sources / Tools (current)

Manually uploaded GSC exports (404 report + Page Indexing "Crawled -
currently not indexed" report, both .zip/.csv), GSC Search Analytics
API (site `sc-domain:ledsone.co.uk`, traffic context only), GA4 Data
API (property `408110563`), self-hosted local LLM (Qwen3-Next,
`LOCAL_LLM_*`) with Gemini fallback for Shopify matching, Shopify Admin
GraphQL API (`ledsone_uk`, read-only), this app's own Postgres (2
tables: `gsc_404_monitor_issues`, `gsc_non_indexed_urls`). No Sync
Monitor involvement (removed with the automatic scan).

## Validation

`validation/dilaksi/2026-09-17_gsc-404-url-monitor_validation.md` --
code-review-level PASS on every checked item at original write time.
Since then, live-tested directly in production by the user across
many real upload/match/status/delete cycles (see UPDATE section above)
-- the core flow is confirmed working, not just code-reviewed.

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
