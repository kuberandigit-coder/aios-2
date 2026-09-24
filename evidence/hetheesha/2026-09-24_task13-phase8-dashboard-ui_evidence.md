# Evidence — Task 13 Phase 8: Dashboard UI (French Keyword Research & Page Mapping)

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase7-gap-cannibalisation_evidence]],
[[2026-09-24_task13-phase8-dashboard-ui_validation]],
[[2026-09-24_task13-phase8-dashboard-ui_handover]]

## Scope

Frontend only. A read-only dashboard over the Phase 2-7 backend. No backend
logic was changed, nothing was deployed, nothing is committed in dm-dashboard
(changes left in the working tree for review), no Shopify writes, no access
grant was written.

## Files (dm-dashboard, uncommitted)

New:
- `frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.jsx` — the page
  (7 tabs, detail modals, filters, sorting, pagination).
- `frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.css` — only what
  the shared `jreq-*` system lacks (provenance badges, notices, CSS bar
  charts, table helpers); colours come from the existing `--j-*` tokens.

Edited (additive only, +5 / +5 / +1 lines, nothing removed):
- `frontend/src/dev/DevLayout.jsx` — import, sidebar child, `LazyPanel`.
- `frontend/src/admin/AdminLayout.jsx` — same three additions.
- `frontend/src/taskRegistry.js` — one `TOOLS` entry.

Naming rule applied: task-only names (no user names) in files, component,
panel key and task key.

## Where it lives / registration

- Sidebar: Development Tasks → "French Keyword Research & Page Mapping"
  (panel key `dev-task-french-keyword-research`), in both the Dev and Admin
  layouts, lazy-loaded with the existing `LazyPanel`.
- Registry: `tools.DevFrenchKeywordResearch` in `TOOLS`
  (`kind: 'tool'`), the same shape as the other Development Task entries.
- Not built: a new router, a second API client, a new permission system, a
  chart library (none exists in the app; bars are plain CSS).

## UAM — how access actually works here

Access is database-backed, not code-only:
- Table `access_grants (task_key, granted_to_staff_key, granted_by)` in the
  app database; module `backend/app/access_grants.py`.
- The User Access Management matrix lists every entry of `TASKS` and `TOOLS`
  automatically, so the new task appears there with no extra code.
- A staff layout calls `useGrantedTasks('<staff_key>')`
  (`GET /api/access-grants/mine?staff=<key>`) and renders each granted key
  as a sidebar item ("Granted by admin").
- Dev and Admin layouts show Development Tasks directly.

To give Hetheesha access, an admin ticks the task for Hetheesha in User
Access Management; that calls
`POST /api/access-grants/toggle?task_key=tools.DevFrenchKeywordResearch&granted_to=hetheesha&granted=true&granted_by=<admin>`.
**No grant row was written by this phase.** Until an admin does that, the page
is visible in the Dev/Admin layouts only. Nothing hard-codes a user name.

## UI behaviour implemented (by design; not yet exercised end to end)

- KPI cards read the stored counts of the latest analysis run (keywords,
  mapped URLs, gaps, cannibalisation cases) and the gap/case lists (high
  priority). Total Search Volume shows "Unavailable" while Keyword Planner is
  not configured; volume, "Google Ads Competition" and CPC are never shown as
  0 and never replaced with Search Console figures. No "KD"/"SEO difficulty".
- Overview: KPIs, distributions (intent, mapping status, gap priority,
  cannibalisation severity, cluster status), latest analysis run, data
  sources, recent research runs.
- Keyword Research: 13 columns per the spec, filters (search, intent, source,
  status, classification, GSC yes/no, URL), sorting (clicks, impressions,
  position), pagination, detail modal (loads keyword-planner metrics, GSC
  rows, candidate URLs, cluster/mapping/gap/cannibalisation links).
- Clusters: "Candidate Primary Keyword" wording, suggested URL marked not
  approved, review status, detail modal with related keywords.
- URL Mapping: real statuses only, full reason via tooltip and modal,
  candidate URLs and GSC evidence in the modal.
- Gaps: priority exactly as returned (including UNDETERMINED with its
  basis), verification flags (e.g. QUESTIONABLE_KEYWORD_ORIGIN), backend
  evidence caveats shown in a banner.
- Cannibalisation: "Potential cannibalisation based on multiple URLs
  receiving visibility for the same query"; cases and mapping conflicts as two
  sub-views, evidence modals.
- Approved Map: shows APPROVED mappings only (currently none) with an honest
  empty state; no approve actions; states that approval arrives in Phase 9.
- Manual "Refresh Data" only (no polling). Read requests retry once on a
  network error or HTTP 5xx.

## Backend endpoints consumed (all pre-existing, none added)

`/gap-analysis/runs`, `/runs`, `/keyword-planner/status`,
`/seed-dataset/keywords` (+`/{id}`), `/clusters` (+`/{id}`), `/url-mappings`
(+`/{id}`), `/gap-analysis/gaps`, `/gap-analysis/cannibalisation`,
`/gap-analysis/mapping-conflicts`, all under `/api/hetheesha/task13`.
No summary endpoint was needed: KPI counts come from the analysis run's
stored `params.counts`. The backend route prefix still contains a user name;
renaming it belongs to the separate backend restructure.

## What was actually done to check it

- Read the real handler responses (keys, samples) to build against the true
  data contracts.
- One production build: `npx vite build` compiled successfully.
- An earlier lint pass showed only one warning in the new file (state set on
  mount, the same pattern the existing pages have).
- Confirmed the three registry edits are additive by reading the diff.
- Scanned the new frontend files for secrets: none (only words such as
  `shopify_collection`).

## Not done (deliberately deferred by the user)

Feature, UAM and browser testing. A headless-browser run had started and was
stopped by the user; its partial output was incomplete and is not relied on.
Payload note: the keyword list is ~560 KB and took ~11 s to load in a direct
call, so the first load of the Keyword Research tab can feel slow.
