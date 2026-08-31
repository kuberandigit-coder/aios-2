# Evidence — Requirement Usage converted from spreadsheet into a real dm-dashboard feature

**Date:** 2026-08-31
**Purpose:** User asked to convert the earlier one-off "Requirement Usage
Tracker" spreadsheet into an actual feature inside the new dashboard,
Admin-filled, one page per staff member (same look/pattern as the rest of
the app -- confirmed via "same ui for new dashboard").

## What was built

`backend/app/requirement_usage.py` (new):
- `ROSTER` dict -- same per-staff requirement list used to build the
  earlier spreadsheet, now the seed data instead of a file someone opens.
- `public.requirement_usage` Postgres table (auto-created): one row per
  staff+requirement, `usage_frequency` nullable text column.
- `GET /api/requirement-usage/roster` -- staff list for building nav.
- `GET /api/requirement-usage/{staff_key}` -- auto-seeds that member's
  roster rows on first read (idempotent `ON CONFLICT DO NOTHING`), then
  returns current data.
- `POST /api/requirement-usage/{staff_key}/{requirement_key}` -- upserts
  one cell's `usage_frequency`.
- Registered in `backend/app/main.py`.

`frontend/src/admin/pages/RequirementUsage.jsx` (new):
- `RequirementUsageStaff({ staffKey })` -- one staff member's table
  (Requirement / Description / Current pill / editable Usage Frequency
  select), styled with the same `jreq-header`/card/pill conventions
  already used everywhere else in the app (EOD Admin, Jefri pages, etc.)
  per "same ui for new dashboard". Saves per-cell on change, straight to
  Postgres, no separate Save button/step.

`frontend/src/admin/AdminLayout.jsx` and `frontend/src/dev/DevLayout.jsx`:
- New main nav item "Requirement Usage" with an 11-item `children` array
  (one sub-tab per staff member) -- same main-tab/sub-tab pattern as
  "Sales 2026" and "EOD Admin", per the earlier explicit instruction
  against one long scrollable page.
- One panel per staff key rendering `<RequirementUsageStaff staffKey=.../>`.

## Verification
- `npx vite build` -> `✓ built in 803ms`, no errors.
- Backend restarted; live curl tests:
  - `GET /api/requirement-usage/jefri` -> auto-seeded 8 rows correctly.
  - `POST /api/requirement-usage/jefri/req1 {"usageFrequency":"Daily"}` ->
    success, and a follow-up GET confirms it persisted (`"usageFrequency":
    "Daily"`).
  - `GET /api/requirement-usage/roster` -> all 11 staff listed correctly.
  - `GET /api/requirement-usage/hetheesha` -> auto-seeded 5 rows
    (confirms per-staff seeding works for more than just the first-tested
    member).

## Reviewer
Pending user confirmation in the live UI -- Admin/Dev -> "Requirement
Usage" -> pick a staff sub-tab -> set a Usage Frequency and confirm it
sticks after switching tabs/reloading.
