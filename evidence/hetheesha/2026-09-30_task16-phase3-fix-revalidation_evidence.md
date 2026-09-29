# Evidence — Task 16 Phase 3: Fix Automation & Re-validation

**Date:** 2026-09-30
**Related:** [[2026-09-29_task16-search-console-indexing-monitor_evidence]],
[[2026-09-29_task16-gsc-api-capability-check_evidence]]
**Repo:** dm-dashboard, `dev-work`, commit `761c89b`.

## Inspection performed first

- Read Phase 1 + Phase 2 (this task's own `detection.py`, `state.py`,
  `router.py`) — the existing status enum, issue_key scheme, and decision
  model, all reused as-is (no second status system, no second permission
  check).
- Read Task 15's Fix & Re-validation workflow
  (`structured_data_validation/state.py`, `.schema.py`) for the Before →
  Fix → After pattern shape, and its `gsc.py` for the existing URL
  Inspection call this phase reuses for re-validation.
- Confirmed `shopify_client.graphql()` is this project's only Shopify write
  path, and searched every existing mutation used anywhere in this codebase
  for a canonical-URL, noindex-meta, or robots.txt field. None exists.

## Capability check (required before any "Apply Fix" code was written)

Checked every issue type this task's `detection.py` can currently produce
(`high_value_not_indexed`, `soft_404_or_5xx`, `low_value_crawled_not_indexed`,
`indexed_drop`, `generic`) against what this project's existing, already-
connected APIs can safely and deterministically change:

| Issue type | Root cause is controlled by | Safely automatable today? |
|---|---|---|
| High-value page not indexed | Google's own crawl/quality decision | No |
| Soft 404 / 5xx | Needs human judgement (content vs server vs app) | No |
| Low-value crawled, not indexed | Google's own quality decision | No |
| Indexed pages dropped >10% | Unknown until investigated | No |
| Excluded by noindex / robots.txt / canonical (seen in coverageState) | Shopify THEME (robots meta, robots.txt, canonical tags) -- not any Admin API field this project calls | No |

Result: **zero issue types qualify for automation today.** Every issue
routes to **Create Fix Task**, never a fake **Apply Fix**. This is recorded
in `fixes.py`'s module docstring, not just in this evidence file, so the
reasoning stays next to the code it governs.

## What was built

- `search_console_indexing_fix_events` table: one immutable row per fix
  attempt (`before_snapshot` never overwritten), `fix_kind`
  (`manual_fix_task` | `automated_fix` — only the former is ever used
  today), status (`REQUESTED` → `PASSED`/`RECHECK_FAILED`/`FAILED`),
  `after_snapshot`, `result`, `error`.
- `fixes.py`: `propose_fix()` (always manual, with a specific per-type
  reason), `create_fix_task()` (records Before, moves the issue to
  ACTION_REQUIRED), `apply_fix()` (raises `NotImplementedError` — exists
  only so a future issue type with a real API path can be wired in without
  a schema change), `revalidate()` (one on-demand URL Inspection call,
  reusing Task 15's `gsc.inspect_url` and writing into the SAME shared
  `structured_data_validation_gsc_inspections` cache table — no second GSC
  integration), `get_history()`, `list_queue()`.
- Routes: `POST /issues/fix-task`, `POST /issues/revalidate`, `GET /fixes`
  (all under the existing `require_task_access` permission,
  `tools.DevSearchConsoleIndexingMonitor` — no new permission created).
  `GET /url-detail` now also returns `fix_proposal` and `fix_history`.
- `STATUSES` gained `FAILED` (re-validation concluded the fix did not work
  — distinct from `IGNORED`, which is a human choice not to act).
- Frontend: a **Fix Queue** tab (filter by status), and a **Fix &
  Re-validation** panel in the existing issue detail drawer — Create Fix
  Task / Re-validate buttons, a Before → Fix → After history list, and the
  honest "no automated fix is available" notice per issue.

## Files changed

- `backend/app/dev_tasks/search_console_indexing/schema.py` (new table,
  `FAILED` status)
- `backend/app/dev_tasks/search_console_indexing/fixes.py` (new)
- `backend/app/dev_tasks/search_console_indexing/detection.py` (kept
  `item_type` on the issue row instead of popping it, so the router/fixes
  layer can use it)
- `backend/app/dev_tasks/search_console_indexing/router.py` (3 new routes,
  `url-detail` extended)
- `frontend/src/admin/pages/dev-tasks/SearchConsoleIndexingMonitor.jsx`
  (+`.css`) — `FixPanel`, `FixesTab`, Fix Queue tab

## Tests performed

- `python -m py_compile` on all backend files in the package: PASS.
- `npx vite build`: PASS (same pre-existing informational warning shared by
  every dev task, unrelated to this change).
- No live run: this session has no database or network access to the
  server (documented the same way in every prior evidence file this
  session). Not opened in a browser.

## Limitations / not implemented

1. **No automated fix exists for any current issue type** — by design,
   after the capability check above, not because it was skipped.
2. **Re-validation checks one URL on demand**, outside the batch sampler;
   it still shares the same Search Console per-URL cache and quota as
   everything else in this task and Task 15.
3. **Fix Queue filters** are narrower than the spec's full list (status +
   automation only, not yet priority/URL/issue filters) — a Phase 3.1 if
   the queue grows large enough to need them.
4. Not deployed, not manually tested in a browser.

## Manual checks remaining

1. Deploy `761c89b`.
2. Open an issue in the Issues tab, open the drawer, confirm the Fix &
   Re-validation panel shows the honest "no automated fix" notice.
3. Click Create Fix Task; confirm it appears in the Fix Queue tab with
   status REQUESTED.
4. Click Re-validate on a URL known to now be indexed; confirm it moves to
   PASSED / RESOLVED. Click it on one still not indexed; confirm FAILED,
   not silently ignored.
5. Confirm Phase 1/2 functionality (Overview, Sitemaps, Issues filters,
   status workflow) still works unchanged.
