# Closure — EOD Admin Attendance popup (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Done, pushed to `dev-work`

## Request
Admin's Attendance view expanded a submitted report inline inside the
grid card, pushing the whole layout around. Needed a centered popup with
edit access instead.

## What was delivered
Clicking a member's card now opens a centered modal (same chrome as the
existing "My EOD Reports" viewer). Admin gets an Edit button on
submitted reports → textarea → Save, writing through the existing
`/api/eod/admin/submit` endpoint (same one "Act on Behalf" already
uses). Handles submitted / on-leave / missing states.

## Files
- `frontend/src/components/EodPage.jsx`
