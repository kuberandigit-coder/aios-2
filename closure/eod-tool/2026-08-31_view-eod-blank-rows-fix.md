# Closure — "View EOD" popup blank rows fixed

**Date:** 2026-08-31

## Summary
The staff "View EOD" popup was rendering every report row blank due to a
separate, buggy hand-rolled row layout distinct from the working
`ReportHistory` component the admin's History tab already used
successfully. Replaced it with `ReportHistory` directly, keeping only the
popup's own chrome (header/close/refresh) around it. Build passes clean.

## Status
PASS. One working implementation shared by both places instead of two.

## Reviewer
Pending user confirmation.

## Evidence / Validation
See evidence/eod-tool/2026-08-31_view-eod-blank-rows-fix.md and
validation/eod-tool/2026-08-31_view-eod-blank-rows-fix.md
