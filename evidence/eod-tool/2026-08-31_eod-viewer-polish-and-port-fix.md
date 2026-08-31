# Evidence — EOD Tool: "View EOD" popup polish + wrong-port root cause

**Date:** 2026-08-31
**Purpose:** User reported (1) blank/empty rows in the "My EOD Reports"
popup, (2) the popup re-showing a full "Fetching your reports…" spinner
(wiping the list) every time Refresh was clicked, feeling slow and
inconsistent, (3) wanted the "View EOD" button relocated to a more
professional spot.

## Root cause found for (1)/(2): wrong port
`localhost:5173` is NOT the dm-dashboard frontend — it's owned by an
unrelated project ("For Shiyamini React"), confirmed via
`Get-NetTCPConnection -State Listen`. dm-dashboard's own frontend process
had silently fallen back to port 5174 (its 5173 default was already taken),
which nobody was pointed at, while the correct instance was only ever on
**5199**. If the screenshots were taken against `:5173`, that fully
explains the broken/garbled UI — it's a different application's bundle. --
**dm-dashboard's frontend is only ever at http://localhost:5199.**

Fix: killed the stray/orphaned dm-dashboard vite processes (the dead 5174
fallback), and restarted the real one with `--strictPort` on 5199 so it
can never again silently drift onto a different port instead of failing
loudly.

## UX fixes made regardless (`frontend/src/components/EodPage.jsx`)
1. **Refresh no longer blanks the list.** `loadMine(force)` now
   distinguishes a background refresh (reports already on screen) from the
   first load: the Refresh button shows a small spinning icon + "Refreshing…"
   inline next to the report count, the existing list stays visible the
   whole time, and only swaps once the new data lands. The full-screen
   spinner now only ever shows on the very first open with nothing loaded
   yet — one consistent, smooth loading experience instead of two
   different-looking states.
2. **"View EOD" button relocated** from a floating row at the very bottom
   of the page to the top-right of the page header, next to the "EOD
   Report" title — a standard, professional placement (same pattern as
   header action buttons elsewhere in the app).

## Verification
`npx vite build` -> `✓ built in 506ms`, no errors.
dm-dashboard frontend restarted cleanly and confirmed listening on 5199
only (`--strictPort`, so a port conflict now fails loudly instead of
silently drifting).

## Reviewer
Pending user confirmation -- **please use http://localhost:5199**, not
5173, when checking the dashboard.
