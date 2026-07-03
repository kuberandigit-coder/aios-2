# 11 — Weekend Deals Section — Fully Automatic Schedule + Timer Fix

**Date:** 2026-06-19
**File:** `sections/weekend-deals.liquid`

## What changed

### Auto show / hide schedule
- Section was always visible before — no schedule logic existed
- Added Berlin timezone schedule: **Friday 13:00 → Sunday 23:59** (auto, every week)
- CSS hides the Shopify wrapper by default for real visitors (`{%- unless request.design_mode -%}`)
- JS `check()` runs every 30 seconds to show/hide based on current Berlin day/time
- Theme editor (`request.design_mode`) always shows the section for editing

### Schedule logic (`isSaleActive`)
- Friday >= 13:00 Berlin → show
- Saturday (all day) → show
- Sunday < 23:59 Berlin → show
- Everything else → hidden
- Loops automatically every week forever — no configuration needed

### Auto-calculate end time (`getWeekendEndMs`)
- Previous version required merchant to manually update an end date each week
- New function calculates "this week's Sunday 23:59 Berlin → UTC ms" automatically on every page load
- Uses `Intl.DateTimeFormat` with `timeZone: 'Europe/Berlin'` to get current Berlin calendar date
- Adds days-until-Sunday offset, builds the date string, converts to UTC via `berlinToUTCMs`
- Countdown timer always counts to the correct Sunday without any input

### Timer timezone fix
- Old code: `new Date(year, month, day, h, m)` — used visitor's local timezone (wrong for non-German visitors)
- New code: `berlinToUTCMs()` — converts Berlin local time to UTC ms using `Intl.DateTimeFormat` offset trick
- Handles both CET (UTC+1 winter) and CEST (UTC+2 summer) automatically

### Removed end_date schema setting
- `end_date` text field removed from schema — no date to manage
- `data-end-date` attribute removed from the timer HTML element
- Countdown and schedule are now 100% automatic

### Tested
- Changed Friday show time to 07:30 (450 min) for live test → section appeared correctly
- Confirmed working, changed back to 13:00 (780 min)

## Outcome
Section requires zero weekly maintenance. Appears every Friday 13:00, disappears every Sunday 23:59, timer counts down automatically. Loops forever.
