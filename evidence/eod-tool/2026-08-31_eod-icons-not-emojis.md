# Evidence — EOD Tool: replace emojis with SVG icons

**Date:** 2026-08-31
**Purpose:** User asked not to use emojis; use icons instead.

## What was changed
`frontend/src/components/EodPage.jsx`:
- Added an `Icon` set of small inline SVGs (Search, Close, Refresh,
  Calendar, CalendarOff, Inbox, AlertCircle, CheckCircle, AlertTriangle,
  Chevron) matching the app's existing sidebar icon style
  (`viewBox 24 24`, `stroke=currentColor`, `strokeWidth 2`).
- `StatusPill` (Submitted/On Leave/Missing) now renders an icon instead of
  ✓ / 🏖 / ⚠.
- `EodViewerModal`: Close button (✕), Refresh button (🔄), per-report date
  icon (📅), chevron (▾), and the error/empty states (✕/📭) all replaced
  with `Icon.*` SVGs.
- "Mark as Leave" button (was 📂) and the new "View EOD" button (was 🔍)
  both replaced with SVG icons.

## Verification
`npx vite build` → `✓ built in 588ms`, no errors.
`grep` for all emoji glyphs previously used in the file → zero matches.

## Reviewer
Pending user confirmation.
