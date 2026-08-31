# Evidence — EOD Admin split into its own tabbed page

**Date:** 2026-08-31
**Purpose:** Admin/Dev shouldn't see the staff self-service EOD input
fields (submit report / mark leave / view my history) at all — the
Admin/Dev EOD page should be admin-only, renamed "EOD Admin", and
restructured as a main tab with sub-tabs (matching the "Sales 2026"
pattern) instead of one long scrollable page.

## What was changed

`frontend/src/components/EodPage.jsx`:
- Replaced the single `EodAdminSection` (which rendered attendance grid +
  act-on-behalf + browse-history stacked in one scrollable block, appended
  under the staff form whenever `user.role` was admin/dev) with three
  standalone, individually exported components:
  - `EodAdminAttendance` — the date/filter attendance grid.
  - `EodAdminActOnBehalf` — submit/mark-leave for a member (now also has
    its own date field, previously implicitly reused the attendance grid's
    date).
  - `EodAdminHistory` — browse any member's history.
  Each has its own small `jreq-header` (eyebrow "EOD Admin"), matching the
  per-sub-tab header pattern already used by e.g. `Sales2026Region`.
- Added `useEodMembers()` — a small shared hook (module-level cached)
  replacing the old `ALL_MEMBERS_PLACEHOLDER` mutable-array hack, used by
  the Act-on-Behalf and History sub-tabs to populate their member
  dropdowns.
- Removed the `isAdmin` branch and `EodAdminSection` render entirely from
  the default-exported `EodPage` (staff-facing) — it no longer carries any
  admin-only code path at all.

`frontend/src/admin/AdminLayout.jsx` and `frontend/src/dev/DevLayout.jsx`:
- Renamed the `eod` nav item to `eod-admin`, label "EOD Admin" (was "EOD
  Tool"), and gave it a `children` array — `Attendance` / `Act on Behalf`
  / `History` — using the exact same parent-group + sub-tab sidebar
  pattern as "Sales 2026" (`sales2026-de/uk/fr`).
- Replaced the single `<EodPage user={user} />` panel with three panels,
  one per sub-tab, each wired to `tabPanelClass(active, 'eod-admin-<x>')`.
- Swapped the `EodPage` default import for the three named admin
  components.

The 11 staff layouts (Jefri, Kamsi, Mahima, ...) are unchanged — they
still use `key: 'eod'` -> `<EodPage user={user} />`, i.e. the staff
self-service submit/leave/View-EOD page, since that's what staff need.

## Verification
`npx vite build` -> `✓ built in 537ms`, no errors.
`grep` confirms no remaining references to the removed
`EodAdminSection`/`ALL_MEMBERS_PLACEHOLDER` anywhere in `frontend/src`.
Confirmed group-navigation-from-Overview already works generically for
any item with `children` (both `AdminLayout` and `DevLayout`'s
`selectFromOverview` land on `item.children[0].key`) — same mechanism
already used for "Sales 2026", no special-casing needed for "EOD Admin".

## Reviewer
Pending user confirmation in the live UI.
