# Evidence — Dilaksi Task 08 Implementation (Broken Link / 404 Monitor)

Date: 2026-09-17
Repo: C:\Users\PC\Desktop\dm-dashboard, branch `dev-work`, commit `61bef03`

## Backend files created

- `backend/app/dev_tasks/broken_link_monitor/__init__.py`
- `backend/app/dev_tasks/broken_link_monitor/screaming_frog.py` — Screaming Frog CLI wrapper
- `backend/app/dev_tasks/broken_link_monitor/schema.py` — DB schema + persistence
- `backend/app/dev_tasks/broken_link_monitor/enrich.py` — GA4/GSC/Shopify enrichment + priority + redirect logic
- `backend/app/dev_tasks/broken_link_monitor/router.py` — FastAPI router + background crawl job

## Backend files modified

- `backend/app/dev_tasks/__init__.py` — registered `broken_link_monitor_router` and its `ensure_schema` alongside the other five dev tasks

## Frontend files created

- `frontend/src/admin/pages/dev-tasks/BrokenLinkMonitor.jsx`

## Frontend files modified (triple registration, mirroring Meta Title & Description Audit exactly)

- `frontend/src/admin/AdminLayout.jsx` — import, sidebar entry after `dev-task-meta-audit`, `<LazyPanel>`
- `frontend/src/dev/DevLayout.jsx` — same
- `frontend/src/taskRegistry.js` — `tools.DevBrokenLinkMonitor` entry, `kind: 'tool'`, no `ownerStaffKey` (grant-gated, same as Alt Text Keyword Finder / Meta Title & Description Audit)

## Live verification performed (real production systems, not assumed)

1. **`python -m py_compile`** on all 5 new/changed backend files — passed.
2. **`npx vite build`** on frontend — succeeded (`✓ built in 1.86s`); only pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` warnings identical in shape to every other dev-task page (static+dynamic import of the same file), not errors.
3. **`screaming_frog.run_list_crawl()`** — live-tested against `https://ledsone.co.uk/` (real, known-good) and a deliberately non-existent product URL. Real result: 404 correctly detected in 18.87s for a 2-URL crawl.
4. **`schema.ensure_schema()`** — ran against production Postgres (`158.220.99.127`), created `broken_link_monitor_crawls` and `broken_link_monitor_issues` with no error.
5. **`schema.upsert_issue()`** — tested both the `(source_url, broken_url)` conflict path and the NULL-source partial-unique-index conflict path (`(broken_url) WHERE source_url IS NULL`); confirmed re-running the NULL-source case updates the existing row (refreshed `ga4Sessions`/`priority`/`lastSeen`, preserved `firstSeen`) rather than creating a duplicate.
6. **`schema.update_review_status()` / `update_dev_status()`** — confirmed valid-status update returns `True`, invalid status raises `ValueError`, unknown issue ID returns `False`.
7. **`enrich.fetch_ga4_sessions_by_path()`** — live call, returned 4,945 real paths with real session counts (e.g. `/` → 819 sessions).
8. **`enrich.fetch_gsc_by_path()`** — live call, returned 12,076 real pages with real clicks/impressions (e.g. `/` → 487 clicks / 19,330 impressions). This call exercises the exact line that had the `_path`/`path_from_url` rename bug — confirmed fixed and working.
9. **`enrich.shopify_resource_context()`** — live call against the deliberately non-existent product URL, correctly returned `{"type": "Product", "status": "removed", "title": None}`.
10. **`enrich.suggest_redirect()` / `compute_priority()`** — pure-logic unit checks, confirmed correct outputs for both the "no match" and "has traffic → High" / "external → Low" cases.
11. **Full end-to-end pipeline** — called `router._run_crawl_job()` directly (bypassing only the HTTP layer, not the logic) with the same 2 URLs; confirmed a real crawl → CSV parse → GA4/GSC/Shopify enrichment → priority computation → DB persistence chain completed successfully and was queryable back out via `schema.get_summary()` / `get_issues()` / `get_crawl_history()`.
12. **Full FastAPI app import** — `import app.main` succeeded with all 401 total routes present, including the 9 new `/api/dev/broken-link-monitor/*` routes, confirming no import-time collision with any existing router.
13. **`ensure_dev_task_schemas()`** (the real startup-hook function, all 6 dev tasks together) — ran clean with no errors.
14. **Test data cleanup** — all verification rows (`test-uid-blm-verify` crawl, `does-not-exist`/`does-not-exist-2`/the 404-test URL issues, and the live end-to-end crawl's row) were deleted from production Postgres after verification; the tables were left empty, not polluted with test data.

## Not verified (see validation record for honest PARTIAL callouts)

- No real browser click-through test of the new UI (Run Crawl button, filters, review/dev status dropdowns) was performed — only the underlying API/DB calls were exercised directly in Python. This is a genuine gap, not claimed as PASS.
- No live grant/revoke test was performed against a real Dilaksi user session (would require a running frontend + backend + an actual login) — the grant-gating mechanism was verified by code inspection (identical `taskKey`-based pattern in `GrantedTaskView.jsx`/`useGrantedTasks.js` used by every other `tools.Dev*` entry) rather than an end-to-end UAM click test.
