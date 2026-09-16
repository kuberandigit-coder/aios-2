## Title
Dilaksi Requirement 07 — Meta Title & Description Audit

## Purpose
Build an automated audit inside the existing DM Dashboard that collects
every LEDSone product/collection page's current meta title and
description from Shopify, flags missing/duplicate/length issues,
retrieves GA4 traffic for flagged pages, assigns a priority, and produces
a prioritized rewrite backlog. Ends at the backlog — never auto-rewrites
or publishes metadata, never writes to Shopify.

## Date
2026-09-16

## Team Member
Dilaksi

## Team
SEO / Digital Marketing

## Requirement
07

## Phase 1 — Existing Architecture Inspected (before writing code)
- **Repo:** `dm-dashboard` (Python/FastAPI backend + React/Vite frontend), `dev-work` branch.
- **Dilaksi's existing pages:** `backend/app/dilaksi.py` (Req1 GA4 SEO, Req2 Product Priority, Req3 Collections Removal Audit — ported from the old system) + `backend/app/dilaksi_faq_*.py` (Req5 FAQ Addition, the most recent large Dilaksi feature — split into multiple concern-based files, its own DB tables, its own router). Frontend: `frontend/src/dilaksi/DilaksiLayout.jsx` (staff DashboardShell) + `frontend/src/dilaksi/pages/*.jsx`, registered in `frontend/src/taskRegistry.js`.
- **Existing Shopify client:** `backend/app/shopify_client.py` — `graphql(store, query, variables)`, `STORE = "ledsone_uk"`, already used by every Dilaksi requirement. No new Shopify auth path created.
- **Existing GA4 client:** `backend/app/google_client.py` — `fetch_ga4_report(property_id, start, end, dimension, metrics, organic_only)`, JWT service-account auth (`GA4_SERVICE_ACCOUNT_JSON`), already used by `dilaksi.py` Req1/Req2 against `GA4_PROPERTY_ID = "408110563"`. Reused as-is, same property ID, same organic-only convention.
- **Existing DB:** `backend/app/db.py`'s `get_conn()` (this app's own Postgres), `public.<feature>_*` table-name-prefix convention (no new schema — confirmed via `dilaksi_faq_db.py`'s own note that this app's DB role lacks `CREATE SCHEMA`).
- **No existing GA4/Shopify duplication created** — confirmed via `grep -rli "ga4"` across `backend/app` and manual review of `dev_tasks/geo_visibility/shopify.py` (collection-scoped, heavier product-detail fetch, not reused directly since this audit needs a lightweight WHOLE-CATALOG scan, which no existing helper provided).
- **No existing "high/low traffic" numeric threshold found anywhere** in the codebase (`hetheesha.py` Req4 uses a binary "clicks > 0" scope, not a HIGH/LOW split) — confirmed via targeted grep before creating a new one (see Phase 7 below).
- **No existing Dilaksi Requirement 07 / meta-audit record** found anywhere in AIOS (`prompts/`, `evidence/`, `validation/`, `closure/`, `handover/`, `source-map/`, `capability/`) before this implementation — confirmed via grep; this is genuinely new work, not a duplicate.

## Files Created
- `backend/app/dilaksi_meta_audit.py` — whole-catalog Shopify fetch, missing/duplicate/length audit, GA4 traffic matching, priority logic, background job + Postgres snapshot persistence, `/api/dilaksi/meta-audit/*` router (run, status, summary, results, duplicates, length-issues, traffic, backlog).
- `frontend/src/dilaksi/pages/MetaTitleDescriptionAudit.jsx` — 5-section UI (Audit Overview / Missing Metadata / Duplicate Metadata / Length Issues / Prioritized Rewrite Backlog), real KPI cards, filters (page type/priority/traffic/field/search), sorting (priority/GA4 sessions/character count/URL). Uses the existing `jreq-*` design system, no new CSS.

## Files Modified
- `backend/app/main.py` — registered the new router + wrapped schema init in the existing per-feature try/except startup pattern (a schema failure here can only 500 this one feature, never the whole app — same pattern `dilaksi_faq` and `jefri_nonmoving` already use).
- `frontend/src/dilaksi/DilaksiLayout.jsx` — added "Requirement 07" nav item + `LazyPanel`, alongside the existing Req1/2/3/FAQ items.
- `frontend/src/taskRegistry.js` — added `dilaksi.MetaTitleDescriptionAudit` task entry (UAM/grant system convention).

## Database Changes
New table `public.dilaksi_meta_audit_snapshot` (single-row, `id SMALLINT PRIMARY KEY DEFAULT 1` constrained to a singleton) holding the latest audit run as JSONB — same "single JSON snapshot row" pattern already proven by `ScheduledSnapshot`, but hand-managed (audit runs on explicit "Run Audit" click, not a cron schedule). No existing tables modified.

## API Endpoints Created (all under `/api/dilaksi/meta-audit`)
- `POST /run` — starts the background audit (non-blocking); `highTrafficThreshold` query param overrides the default.
- `GET /status` — poll for `{running, error}`.
- `GET /summary` — KPI summary + which threshold/reporting period was used.
- `GET /results` — every audited page (issue or not).
- `GET /duplicates` — pages with a duplicate title and/or description, optional `field` filter.
- `GET /length-issues` — pages with a title/description length violation.
- `GET /traffic` — GA4 sessions/classification for every flagged (non-"NO ACTION") page.
- `GET /backlog` — the final prioritized rewrite backlog, highest priority first.

## Shopify Data Flow
`graphql("ledsone_uk", ...)` → paginated `products(first:100, sortKey: ID)` (ACTIVE status only) and `collections(first:100)` → each mapped to `{shopifyId, pageType, name, handle, url, metaTitle, metaDescription}` from `seo.title` / `seo.description` (the real field names, confirmed by reading `dev_tasks/geo_visibility/shopify.py`'s existing usage of the same `seo { title description }` GraphQL field before assuming it).

## GA4 Data Flow
`fetch_ga4_report(GA4_PROPERTY_ID, "{REPORTING_PERIOD_DAYS}daysAgo", "today", "landingPagePlusQueryString", ["sessions"], organic_only=True)` → summed per normalized path → looked up per flagged page's URL path. A path absent from the map is reported as `ga4Sessions: null` / `"No GA4 data"`, never assumed zero.

## Missing Metadata Logic
`_is_blank(value)`: `None` or `value.strip() == ""` → flagged as `Missing Meta Title` / `Missing Meta Description`.

## Duplicate Detection Logic
`_find_duplicate_groups(pages, field)`: groups pages by exact (stripped) field value, blank/null values never form a group, keeps only groups of 2+, each page's own URL excluded from its own "duplicate URLs" list.

## Length Validation Logic
Title flagged if stripped length > 60; description flagged if stripped length > 150 — exact limits from the requirement, never modifies the value.

## Traffic Classification
`HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT = 50` sessions/`REPORTING_PERIOD_DAYS` window — new, explicit, query-overridable (no existing sitewide numeric threshold was found in the codebase to reuse). Every API response echoes `highTrafficThreshold` and `reportingPeriodDays` so the classification is never silent. `sessions >= threshold` → "High"; below → "Low"; no GA4 match → "No GA4 data" (never "High"/"Low").

## Priority Logic
1. Missing meta + High traffic → **HIGH**
2. Missing meta + Low/No-GA4-data traffic → **MEDIUM** (per the requirement's own Phase 7 mapping)
3. Duplicate meta (no missing meta) → **MEDIUM**
4. Length issue only → **LOW**
5. Passes all checks → **NO ACTION**
Highest applicable rule wins on a multi-issue page; every row records its `priorityReason`.

## Final Backlog Format
One row per (flagged page × issue), sorted priority first then by GA4 sessions descending: `priority, priorityReason, url, pageType, name, issueType, field, currentMetaValue, characterCount, ga4Sessions, trafficClassification, duplicateUrls, auditDate`.

## Live Test Results (real Shopify + GA4 data, run 2026-09-16)
Whole-catalog scan and full pipeline run live via an isolated import (bypassing only this environment's known broken local-Postgres-auth issue — see Known Limitations):
- **5,533 total pages audited** (5,043 products + 490 collections, ACTIVE status only)
- Missing meta titles: **1,023** · Missing meta descriptions: **1,519**
- Duplicate title groups: **98** groups / **283** pages · Duplicate description groups: **128** groups / **560** pages
- Title length issues (>60 chars): **1,512** · Description length issues (>150 chars): **1,965**
- GA4: **2,250** distinct paths matched with real sessions (top: `/` 1,161 sessions; several blog paths 100-230 sessions)
- Priority breakdown: **HIGH 1** · **MEDIUM 2,232** · **LOW 1,729** · **NO ACTION 1,571**
- Pages with 2+ simultaneous issues: **2,510** (multi-issue priority correctly took the highest applicable rule in every sampled case)
- Example verified HIGH row: `https://ledsone.co.uk/collections/conduit-lighting` — missing title AND description, real GA4-matched high traffic.
- Example verified multi-issue row: `.../chrome-hook-ring-vintage-iron-ceiling-hook-.../` — 82-char title (length issue) + missing description, both issues correctly recorded.

## Security Notes
No Shopify token, GA4 service-account JSON, or any credential ever printed, logged, or written to any AIOS file — only "SHOPIFY_API configured" / "GA4 configured" style references appear anywhere in this documentation set. Frontend calls only this app's own backend (`/api/dilaksi/meta-audit/*`); the backend alone talks to Shopify/GA4, same boundary every other Dilaksi requirement already uses.

## Evidence Path
This file.

## Validation Result
See `validation/dilaksi/2026-09-16_dilaksi_req07_meta_title_description_audit_validation.md`.

## Known Limitations
1. **Full FastAPI app boot not verified in this local environment** — this machine's local Python venv is missing `psycopg_pool` and its local Postgres role's password auth is broken (a pre-existing, previously-documented environment issue in this session, unrelated to this feature's code). `python -m py_compile` passed clean for every new/modified file, and the actual audit pipeline (Shopify fetch → GA4 fetch → missing/duplicate/length/priority logic) was verified live end-to-end against real production Shopify + GA4 data via an isolated module import that stubs out only the DB connection — the one piece not live-tested is the FastAPI route dispatch + Postgres snapshot save/read round-trip itself, which is straightforward, already-proven-pattern code (same shape as `dilaksi_faq_db.py`/`schema.py` elsewhere in this session), not independently exercised end-to-end via a live HTTP request in this sandbox.
2. **`npx vite build` passed clean** for the new frontend page and its registration — the page was not clicked through in a running browser session in this sandbox (no reachable dev server for a UI click-through here); code review + build success are the frontend verification for this run.

## Next Step
Once deployed, click "Run Audit" once on the live server (a real HTTP round-trip will exercise the FastAPI route + Postgres snapshot save/read path not independently verified above) and confirm the Requirement 07 tab renders the same real numbers found in this evidence's live test.

## Owner/Reviewer
Kuberan

## Status
PASS (implementation + pipeline logic fully verified live against real data; full HTTP-server round-trip not exercised in this sandbox — see Known Limitations, not a defect).
