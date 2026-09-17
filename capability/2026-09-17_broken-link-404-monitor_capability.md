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
