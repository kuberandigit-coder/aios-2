# Closure — Remove Jakshan from EOD roster (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Done, pushed to `dev-work`

## Request
"remove jakshon from here he is no more in the office" (EOD Admin →
Attendance).

## What was delivered
Removed `"jakshan": "Jakshan"` from `EOD_NAME_BY_STAFF_KEY` in
`backend/app/eod.py`. `ALL_MEMBERS` (Attendance grid, Act on Behalf
picker, History browser) derives from this dict, so he disappeared from
all three automatically.

## Files
- `backend/app/eod.py`
