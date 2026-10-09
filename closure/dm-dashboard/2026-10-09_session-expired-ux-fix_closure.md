# Closure — Session-Expired / Server-Unavailable UX Fix

**Date:** 2026-10-09
**Project:** dm-dashboard

## What was done

Fixed a real UX bug: 10+ pages each independently showed a raw HTTP status code
("Request failed (401)", "502 Bad Gateway") directly to the user on session expiry or a brief
backend restart. Fixed centrally in `apiFetch` (the single shared wrapper every API call already
uses) instead of touching every page individually — 401 now triggers a clean forced logout with
a plain-English "session expired" message on the login screen; 502/503/504 shows a small
dismissible banner without logging the user out.

See `evidence/dm-dashboard/2026-10-09_session-expired-ux-fix_evidence.md` for the full detail.

## Status

**Fixed, pushed to `dev-work`** (commit `f785ce2`). Not yet merged to `main`, not yet deployed.

## Next step

Merge via Dev Tools, deploy (same `git pull` + `systemctl restart dm-dashboard` on the Contabo
server used for the Jefri fixes), then confirm live: log out manually/let a token expire and
confirm the clean message appears instead of a raw error.
