# Evidence — "View EOD" button moved under Mark Leave

**Date:** 2026-08-31
**Purpose:** User asked to relocate "View EOD" from the page header into
the "Mark Leave" card, placed under "Mark as Leave", in a neat, well-fit
button style (previous header placement wasn't liked).

## What was changed
`frontend/src/components/EodPage.jsx`:
- Removed the "View EOD" button from the `jreq-header` (top-right of the
  page) and reverted that header back to its plain single-column layout.
- Added it inside the "Mark Leave" card, below the "Mark as Leave"
  button/message area, separated by a thin top border so it reads as a
  distinct secondary action within the same card rather than crowding the
  leave form.
- Same visual weight/style as before (outlined, blue text, search icon)
  but now full-width to match the card's other button, for a tidier fit.

## Verification
`npx vite build` -> `✓ built in 607ms`, no errors.

## Reviewer
Pending user confirmation in the live UI.
