# Closure — dm-dashboard: Blog Optimization GSC Data Source Migration + Applied-Fix Persistence

**Date:** 2026-10-06
**Developer:** Kuberan
**Scope:** Blog Optimization dev task (`backend/app/dev_tasks/blog_optimization/`,
`frontend/src/admin/pages/dev-tasks/BlogOptimization.jsx`)

## Trigger

Kuberan noticed the Blog Optimization page's site dropdown listed 8 sites and asked which ones
actually had a working Google Search Console API connection in `.env`, with an explicit
instruction not to assume from the business database's data but to find out directly. This grew
into the full instruction: disconnect from the external business database, call the live GSC
API directly, store the result in this app's own Postgres, show it in the frontend only for
sites with confirmed live access, add a weekly scheduler, and register it in Sync Monitor.

## What was found before building anything

The business database (`169.58.91.229`, `google_search_console.page`/`query_page`) is
populated by something entirely outside this codebase — confirmed by grep, no
`INSERT INTO google_search_console` anywhere in the repo — and has broader site access than
this app's own two GSC service account credentials. A live test script calling
`google_client.query_gsc()` for every site in the old 8-site list, plus a direct
`requests.post` test of the dedicated `GSC_LEDSONE_FR_SERVICE_ACCOUNT`, confirmed:

- **Working:** `ledsone.co.uk` and `ledsone.de` (shared `GSC_SERVICE_ACCOUNT_KEY`), `ledsone.fr`
  (its own dedicated service account)
- **HTTP 403, not accessible:** `ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`,
  `electricalsone.co.uk`, `besbet.co.uk`

This 3-of-8 result shaped the whole scope — the other 5 sites are not something a code change
can fix; they need that property's access granted to one of these two service accounts inside
Search Console itself.

## What was built

- **`gsc_sync.py`** — live, paginated `searchAnalytics.query` calls for the 3 confirmed sites,
  page-level data for the whole site then query-level data scoped to pages classified as Blog
  type only (keeps row counts and GSC quota use sane). Bulk `unnest()` upsert into two new own-DB
  tables, same pattern already proven in `collection_thin_content`'s `bulk_upsert_audit_rows`.
- **Two new tables** — `blog_optimization_gsc_page` and `blog_optimization_gsc_query`, same
  daily-row shape as the business DB tables they replace, so `gsc.py`'s existing SUM/GROUP BY
  read logic needed almost no change — just a different table and connection.
- **`scheduler.py`** — a weekly `ScheduledSnapshot` (the same helper every other scheduled dev
  task uses), registered in `dev_tasks/__init__.py`'s `start_dev_task_snapshots()`.
- **`gsc.py` rewritten** — `SITES`/`HOST_TO_SITE_URL` now derive directly from `gsc_sync.SYNC_SITES`
  (one source of truth instead of a second hardcoded list that could drift), reads go through
  `get_conn()` against the new tables instead of `get_business_conn()`.
- **`shopify.py` rewritten** — content lookup (Current Blog HTML, QA Check, Fix/Apply) was
  hardcoded to ledsone.co.uk only; added a small store-aware resolver (host → Shopify store key
  + domain) covering all 3 GSC-connected sites, using the already-configured `ledsone_de` and
  `ledsone_fr` Shopify Admin API credentials.

## Two real bugs found and fixed during this work

1. **Every site silently wrote 0 rows on the first scheduled run.** GSC's API mixes JSON ints
   and floats for `ctr`/`position` in the same response (a `0` ctr comes back as an int, others
   as floats); psycopg's `unnest()` array dump rejects a Python list with mixed types. The error
   was caught per-site inside `run_full_sync()`, so the run still reported "success" —
   confirmed by inspecting the snapshot's own stored payload directly, which showed
   `"errors": ["...: DataError: cannot dump lists of mixed types; got: float, int", ...]`
   for all 3 sites and `totalPageRows: 0`. Fixed by coercing every `ctr`/`position` value to
   `float()` explicitly before building the arrays.
2. **Sync Monitor's sidebar entry didn't appear after the first deploy.** Assumed the page's own
   `SCHEDULED_SNAPSHOT_TABS`/`SCHEDULED_SNAPSHOT_LABELS` maps in `SalesSyncMonitor.jsx`
   controlled sidebar visibility — they don't; they only control that page's own internal
   scope-filtering once you're on it. The actual sidebar menu and its rendered panel are a
   second, separate hardcoded array in `DevLayout.jsx`. Found when the entry genuinely wasn't
   showing after a confirmed-live deploy (verified via direct `curl` against the production CSS
   and JS bundles, ruling out a stale-cache explanation before looking for a code bug), fixed in
   a follow-up commit.

## ledsone.de content: known limitation, not fixed

Live-testing `shopify.fetch_blog_content()` against a real DE article returned
`ACCESS_DENIED` on the GraphQL `articles` field — the Shopify app behind `SHOPIFY_ADMIN_TOKEN`
(the `ledsone_de` store) lacks the `read_content` scope. `ledsone.fr` was tested the same way
against a real article and works end-to-end. This is a Shopify admin permissions change, not
something fixable in this codebase — flagged to Kuberan directly rather than worked around.

## Applied-fix persistence (same-day follow-up)

Kuberan separately asked for: fixes to show as permanently applied after a reload, a way to
locate exactly what a fix changed in the HTML, a way to mark QA items that were fixed manually
in Shopify, and a detailed view from the Completed tab. Added `blog_optimization_fix_log`
(new table, one row per `(site, page, label)`, upserted on every apply or manual-change), wired
into `GET /blogs/fix-log` (hydrates the page on load) and `POST /blogs/apply-draft` (now also
takes the fix's `label`/`beforeHtml`/`result` and persists them) and a new
`POST /blogs/mark-manual-change` endpoint. "Locate Changes" computes the differing span between
a fix's before/after HTML via common-prefix/common-suffix (sufficient since every fix only
inserts or replaces one region, confirmed by reading every fix's actual behavior — duplicate-link
removal, heading renumbering, FAQ schema append), then scrolls to and selects that exact range
in the Current Blog HTML code view. Verified the new table and its functions with a live
round-trip test (`save_fix_log` → `get_fix_log` → real rows back, matching the exact shape the
frontend expects) against the real database before pushing, not just a compile check.

## Evidence / Validation

- Live GSC API access: tested directly against the real API for every site, not inferred from
  `.env` — see commit `25fc4d1`'s message for the full per-site result.
- Zero-rows bug: confirmed via the scheduler's own stored snapshot payload showing the real
  `DataError` text before the fix, then a successful live sync after.
- Sidebar bug: confirmed via direct `curl` of the deployed production CSS/JS bundles (checked
  both the old class name was gone and the new one was present) before concluding it was a
  genuine code gap rather than a stale deploy.
- `shopify.py` DE/FR: both tested against real, existing blog articles — FR succeeded, DE's
  exact `ACCESS_DENIED` error captured.
- Fix-log table: live round-trip test (`save_fix_log`/`get_fix_log`) against the real database,
  test rows cleaned up afterward.

## Files changed

`backend/app/dev_tasks/blog_optimization/{gsc.py, gsc_sync.py (new), scheduler.py (new),
schema.py, shopify.py, router.py}`, `backend/app/dev_tasks/__init__.py`,
`frontend/src/admin/pages/SalesSyncMonitor.jsx`, `frontend/src/dev/DevLayout.jsx`,
`frontend/src/admin/pages/dev-tasks/BlogOptimization.jsx`, `frontend/src/styles/dashboard.css`.

Commits: `25fc4d1`, `748add9`, `abe12f7`, `87c86bc`, `4a331ff`, `5c1d15f`, `400360c`, `617e690`
— all pushed to `dev-work`, merged to `main` via the usual Dev Tools process through the day.

## Status

**Complete and live**, except: `ledsone.de`'s content features remain blocked on a Shopify admin
permissions grant (`read_content` scope) that is Kuberan's to make, not a code task; the other
5 non-GSC-connected sites (`ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`,
`electricalsone.co.uk`, `besbet.co.uk`) remain out of scope for Blog Optimization until their
property access is granted in Search Console.
