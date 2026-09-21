# Evidence — Collection Page Thin-Content Detector, Level 1

Date: 2026-09-21
Repo: dm-dashboard (branch: dev-work)

## Pre-build audit (done before writing any code)

- Searched this codebase and the AIOS repo for an existing minimum-word-count threshold for collection
  descriptions, and for an existing "high traffic"/"low traffic" definition. **Neither exists anywhere.**
  The only threshold-like precedent found (`dilaksi_faq_db.py`'s `session_threshold = 500`) is for a
  completely different purpose (product FAQ qualification traffic gate) and was used only as a pattern
  reference for HOW to store a configurable value, never as a real number.
- Confirmed via `dev_tasks/internal_linking/content_fetch.py`'s own prior finding, independently
  re-confirmed live against Shopify: Collections have no Admin API "status"/publish-state field.
- Confirmed reusable logic: `dev_tasks/content_gap/page_analysis.py`'s `analyze_page()` (BeautifulSoup
  strip + get_text word count, FAQ regex) — adapted (not imported directly) into this package's own
  `content_analysis.py` because this task needs FAQ CONTENT and FAQ SCHEMA reported as two separate
  booleans, which `analyze_page()` collapses into one.
- Confirmed reusable GSC pattern: `google_client.query_gsc()` + the `GSC_SITE_URL =
  "sc-domain:ledsone.co.uk"` / 30-day-window convention already used by `dilaksi.py` and
  `gsc_404_monitor/enrich.py` — copied as this package's own one-line constants, matching the established
  per-file convention (not centralized elsewhere in this codebase).
- Confirmed reusable backlog status vocabulary: `internal_linking_suggestions.review_status` ('New' |
  'Review Required' | 'Approved' | 'Rejected') — reused verbatim, no new status vocabulary invented.

## Files created

- `backend/app/dev_tasks/collection_thin_content/__init__.py` — audit-trail docstring.
- `backend/app/dev_tasks/collection_thin_content/content_analysis.py` — word count + separate FAQ
  content/schema detection.
- `backend/app/dev_tasks/collection_thin_content/content_fetch.py` — Shopify collections GraphQL fetch
  (paginated, read-only Query only).
- `backend/app/dev_tasks/collection_thin_content/gsc_metrics.py` — GSC clicks/impressions/CTR/position
  retrieval + URL matching.
- `backend/app/dev_tasks/collection_thin_content/schema.py` — `collection_thin_content_config` (two
  NULL-by-default thresholds) + `collection_thin_content_audit` (one table doubling as audit result store
  AND content backlog).
- `backend/app/dev_tasks/collection_thin_content/priority_rules.py` — deterministic HIGH/MEDIUM/LOW/NO
  ACTION/NOT CONFIGURED engine, no AI-generated explanations.
- `backend/app/dev_tasks/collection_thin_content/router.py` — non-blocking BackgroundJob-based audit
  refresh + config + backlog status endpoints.
- `frontend/src/admin/pages/dev-tasks/CollectionThinContentDetector.jsx` — full dashboard UI per spec
  Section 11.

## Files modified (wiring only)

- `backend/app/dev_tasks/__init__.py` — import + `include_router` + `ensure_dev_task_schemas()` call.
- `frontend/src/taskRegistry.js`, `frontend/src/admin/AdminLayout.jsx`, `frontend/src/dev/DevLayout.jsx` —
  triple-registration, same pattern as every other dev task (no new UAM/permission system).

## Verification performed

- `py_compile` on all new backend files — clean.
- `python -c "from app.main import app"` — backend imports cleanly with the new package wired in; all 6
  new routes confirmed present under `/api/dev/collection-thin-content/*`.
- `npx vite build` — frontend builds cleanly; only the same pre-existing `INEFFECTIVE_DYNAMIC_IMPORT`
  warning class every sibling dev-task page already produces.
- **Live test against real LEDSone UK Shopify data**: `content_fetch.fetch_collections()` returned 490 real
  collections with real titles/handles/descriptions (e.g. `recommended-products-seguno`), confirming
  no mock/hardcoded data.
- **Live test against real GSC data**: `gsc_metrics.fetch_collection_gsc_metrics()` returned 1,114 real
  `/collections/...` rows with real clicks/impressions/CTR/position (e.g. `/collections/plugin-lighting`:
  115 clicks, 10,855 impressions).
- **Full pipeline live run**: `router._run_audit()` executed end-to-end against live Shopify + GSC data,
  writing 490 real rows to `collection_thin_content_audit`. Confirmed correct behavior with BOTH
  thresholds unconfigured: every row's `priority` = `'NOT CONFIGURED'` with reason "Minimum word count
  threshold is not configured -- cannot determine thin content." — never silently defaulted to a fake
  classification. `traffic_level` = `'Unknown'` where GSC data or threshold is absent, never fabricated.

## Known state at end of Level 1 build

- Both thresholds are unconfigured (by design — no existing project value was found). Priority/backlog
  results are currently all "NOT CONFIGURED" until a user sets both values via the Config tab or `PUT
  /api/dev/collection-thin-content/config/{key}`. This is documented, not a bug.

## No secrets

No Shopify Admin API token, GSC OAuth secret, or DB credential is exposed anywhere in these files — the
frontend only talks to this backend's own API, exactly like every other dev task.

## Status

Implemented, live-verified against real data. **Not yet committed to git** — pending final report to user;
will follow the standing "commit locally, push only on explicit instruction" rule.
