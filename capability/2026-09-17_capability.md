# Capabilities — 2026-09-17

2 capabilities documented from this day's work.

---

# Capability — Broken Link / 404 Monitor via Screaming Frog CLI

**Date:** 2026-09-17
**Owner:** Kuberan (SEO team: Dilaksi)
**Staff/Requirement:** Dilaksi Task 08, built as a Development Task (internal dev tooling, same convention as Meta Title & Description Audit / Alt Text Keyword Finder)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** PARTIAL — backend fully live-verified, UI/UAM not browser-tested (see validation/closure records)

## UPDATE (2026-09-17, later same day) — Screaming Frog approach REMOVED, superseded

This entire Screaming Frog CLI-based implementation was **removed from
the codebase** later the same day, per explicit instruction ("remove
all code about the screaming frog... change it to use GSC"). It was
briefly replaced by a pure-GSC-API version (`gsc_404_report`,
`broken_link_monitor` rebuilt on GSC's URL Inspection API instead of a
local crawl), which was then **also removed** per a further explicit
instruction ("remove the both pages, no need them for now").

The capability that now actually exists in the codebase is a **third,
final implementation**: see
`2026-09-17_gsc-404-url-monitor_capability.md` (new record, this same
folder) for the current, live "GSC 404 URL Monitor" (Dilaksi) task —
GSC URL Inspection API + Shopify replacement matching + review
workflow, registered with the existing Sync Monitor. This record is
kept for history (the Screaming Frog technical knowledge below is
still accurate about that CLI, it's just no longer used by this app)
rather than deleted, per "never delete previous evidence."

## Capability

Given a licensed, already-installed Screaming Frog SEO Spider CLI on
the host machine, run a controlled, bounded crawl of a live site,
detect broken internal/external links (4xx/5xx), cross-reference each
with real GA4 traffic, GSC performance, and Shopify resource context,
and produce a prioritized, reviewable remediation backlog — without
ever auto-publishing a redirect or modifying Shopify data.

## Relationship to the existing "Automated SEO Metadata Audit" capability

This is a **new, distinct capability**, not a duplicate of
`2026-09-16_seo-metadata-audit-traffic-prioritization_capability.md`.
That capability audits existing page metadata (titles/descriptions)
against the live Shopify catalog; this one detects and prioritizes
actually-broken links found by an external crawler tool (Screaming
Frog), a different data source and a different problem domain. The two
capabilities do, however, **share and reuse**:
- The GA4/GSC traffic-lookup pattern (`google_client.py`'s
  `fetch_ga4_report`/`query_gsc`).
- The `HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT = 50` traffic-tier
  convention documented in the metadata-audit capability — reused here
  rather than inventing a second, competing threshold.
- The module-level lock+state+background-thread job pattern
  (`_AUDIT_LOCK`/`_AUDIT_STATE` in meta_audit → `_CRAWL_LOCK`/
  `_CRAWL_STATE` here).

## What Was Implemented

1. A Screaming Frog CLI wrapper (`screaming_frog.py`) that runs only
   bounded, explicit list-mode crawls (`--crawl-list`) — never an
   unrestricted full-site crawl, since this CLI version has no
   `--max-urls`-style flag to bound a link-following crawl any other
   way.
2. CSV export parsing for both the direct "Response Codes" tab export
   (authoritative per-URL status) and the "…Inlinks" bulk-export
   (Source→Destination pairs) — verified via live `--help` output, not
   guessed, and verified to legitimately return empty Inlinks data in
   list-mode crawls (no link-following happens, so no inlink can be
   discovered), handled honestly with `source_url = NULL` rather than a
   fabricated source.
3. GA4/GSC/Shopify enrichment reused as-is from existing integrations,
   read-only throughout.
4. A conservative (v1) redirect-suggestion engine: only suggests a
   target when a live Shopify handle closely matches the broken URL's
   own handle (trailing numeric-suffix difference); anything else
   returns "No redirect suggestion" rather than guessing.
5. A documented priority ladder identical in shape to the metadata
   audit's (High/Medium/Low), using GSC clicks/impressions + GA4
   sessions as the actual traffic-evidence signal in place of
   "backlinks" (no Majestic/Ahrefs integration exists in this codebase —
   documented substitution, not a silent one).
6. Postgres persistence with a genuinely tricky NULL-dedup pattern: a
   standard `UNIQUE (source_url, broken_url)` constraint does not
   dedupe rows where `source_url IS NULL` (Postgres treats `NULL <>
   NULL`), solved with a separate partial unique index
   `ON (broken_url) WHERE source_url IS NULL` and a dynamic
   `ON CONFLICT` target chosen per-row.

## Technical Knowledge

- Screaming Frog's **list mode** (`--crawl-list`) is the correct,
  deliberate way to bound a crawl's size in this CLI version — it
  visits only the given URLs and discovers nothing via link-following,
  which is a feature (bounded, predictable) but means Source→Destination
  "Inlinks" data will legitimately be empty for any URL not directly in
  the seed list unless a broader, explicitly-authorized crawl mode is
  used instead.
- A standard SQL `UNIQUE` constraint across a nullable column will NOT
  prevent duplicate rows when that column is NULL for multiple rows — a
  partial unique index (`WHERE col IS NULL`) plus a dynamic
  `ON CONFLICT` target is the correct Postgres pattern for "dedupe by X,
  or by Y alone when X is absent."

## Files / Components

- `backend/app/dev_tasks/broken_link_monitor/{__init__.py,
  screaming_frog.py, schema.py, enrich.py, router.py}`
- `frontend/src/admin/pages/dev-tasks/BrokenLinkMonitor.jsx`

## Data Sources / Tools

Screaming Frog SEO Spider CLI v22.2 (local, licensed, no new
credentials), GA4 Data API (property `408110563`), Google Search
Console API (`sc-domain:ledsone.co.uk`), Shopify Admin GraphQL API
(`ledsone_uk`, read-only), this app's own Postgres (2 new tables).

## Validation

`validation/dilaksi/2026-09-17_dilaksi_task08_implementation_validation.md`
— backend/DB/integrations live-verified against production systems;
UI/UAM click-through explicitly not yet tested (PARTIAL, honestly
stated).

## Reuse

The list-mode-crawl + CSV-export-parsing + traffic/Shopify-enrichment +
priority-ladder shape here is directly reusable for any future
"run an external SEO crawler tool, prioritize its findings by real
traffic" request (e.g. a duplicate-content or canonical-tag audit fed
by the same Screaming Frog exports) — reuse the CLI wrapper and the
enrichment functions rather than re-deriving them per feature.

## Evidence

`evidence/dilaksi/2026-09-17_dilaksi_task08_implementation_evidence.md`

## Limitations

- No automated crawl scheduling exists yet — manual trigger only.
- No full-site crawl mode exists — bounded list-mode only, by explicit
  design, pending separate sign-off.
- The redirect-suggestion engine is deliberately conservative (v1,
  single signal) — do not assume it catches every real redirect
  opportunity; it is designed to under-suggest rather than guess.

---

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

