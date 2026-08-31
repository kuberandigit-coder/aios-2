# Evidence — "View EOD" popup blank rows fixed by reusing ReportHistory

**Date:** 2026-08-31
**Purpose:** User reported the staff "View EOD" popup ("My EOD Reports")
still rendering every report row blank (109 reports found, but no
date/badge/text visible), while pointing out the admin's History sub-tab
renders the exact same kind of data correctly and asking for the staff
popup to work "like that."

## Root cause
`EodViewerModal` (used only by the staff-facing "View EOD" popup) had its
own hand-rolled per-report row markup, separate from the `ReportHistory`
component already used successfully by both "My Past Reports" (before it
was replaced by this popup) and the admin History sub-tab. That duplicate
implementation was the one rendering blank; the shared `ReportHistory`
component was never broken.

## Fix
`frontend/src/components/EodPage.jsx`: `EodViewerModal` now renders
`<ReportHistory reports={reports} loading={loading} />` for its list body
instead of its own per-row JSX -- same proven component the admin's
History tab already uses correctly. Kept the popup-specific chrome
(overlay, header, close button, refresh-with-inline-spinner) around it.
Removed the now-redundant custom loading/empty-state blocks since
`ReportHistory` already handles both.

Scoping to only the signed-in staff member's own reports was already
correct (backend `GET /api/eod/mine?staffKey=` only ever returns that
member's reports, confirmed earlier this session) -- the bug was purely
the blank rendering, not any cross-member leakage.

## Verification
`npx vite build` -> `✓ built in 735ms`, no errors.

## Reviewer
Pending user confirmation -- please re-open "View EOD" and confirm
Jefri's reports now display with dates/badges/expandable text, matching
the admin History tab's look.
