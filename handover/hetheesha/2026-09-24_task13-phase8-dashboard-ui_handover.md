# Handover — Task 13 Phase 8: Dashboard UI

**Owner / reviewer:** Hetheesha (owner) — human review pending
**Date:** 2026-09-24
**Status / closure:** Phase 8 Dashboard UI Completed — Human Review &
Approved Keyword Map Pending (Task 13 is NOT complete; Phases 9-10 not
started). Testing deferred, so validation is PARTIAL.

## What was implemented

A read-only dashboard, "French Keyword Research & Page Mapping" (ledsone.fr),
with tabs Overview, Keyword Research, Clusters, URL Mapping, Gaps,
Cannibalisation and Approved Map. It only fetches and displays what the
backend decided; no clustering, mapping, priority or cannibalisation logic
lives in React.

## Where

- `frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.jsx` and `.css`
- Registered in `frontend/src/dev/DevLayout.jsx`,
  `frontend/src/admin/AdminLayout.jsx` (panel key
  `dev-task-french-keyword-research`) and `frontend/src/taskRegistry.js`
  (`tools.DevFrenchKeywordResearch`).
- **Uncommitted** in dm-dashboard: review, then commit to `dev-work`.
  Nothing deployed.

## Route / navigation

No URL route: the app switches panels by sidebar key. Path in the UI:
Development Tasks → French Keyword Research & Page Mapping (Dev and Admin
layouts).

## UAM

Database-backed grants (`access_grants` table, `backend/app/access_grants.py`).
The task is listed automatically in the User Access Management matrix from
`TOOLS`. To give Hetheesha access an admin ticks it for her there
(`POST /api/access-grants/toggle?task_key=tools.DevFrenchKeywordResearch&granted_to=hetheesha&granted=true`).
**No grant was written.** She sees it under "Granted by admin" once granted.

## Data sources / APIs

Read-only calls to the existing `/api/hetheesha/task13/*` endpoints (keywords,
clusters, url-mappings, gap-analysis gaps / cannibalisation /
mapping-conflicts / runs, runs, keyword-planner/status). KPI counts come from
the latest analysis run's stored counts; no new endpoint was added. Google
Keyword Planner is not configured, so volume / Google Ads Competition / CPC
show as "Unavailable" everywhere. Provenance badges: GKP, GSC, SHOPIFY, LLM
(derived), HUMAN, MANUAL.

## Behaviour to know

Candidate primary keywords and mapped URLs are shown as suggestions; only a
backend status of APPROVED counts as approved (currently none). Gap priority
"Undetermined" is shown with its basis. Cannibalisation is worded as
"potential". Manual Refresh only; reads retry once.

## Known limitations

- Not tested (see the validation record): browser behaviour, UAM visibility,
  filters, modals, error/empty states, KPI match, responsive layout.
- Keyword list payload ~560 KB (~11 s measured once).
- The backend route prefix still contains a user name; the frontend uses it
  as-is until the backend restructure.
- The 12 gaps flagged `QUESTIONABLE_KEYWORD_ORIGIN` and the singular/plural
  cluster conflicts from earlier phases are displayed, not fixed.

## Remaining (Phase 9)

Approval workflow and Approved Keyword Map: approve/edit/reject actions wired
to the existing review endpoints, with re-validation. Next step: run the
deferred test pass, grant access to Hetheesha, review and commit.
