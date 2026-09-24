# Handover — Task 13 Backend Restructure + Table Rename

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status:** structural cleanup only — Task 13's actual phase status is
unchanged (Phases 1-7 complete, Phase 8 dashboard UI complete pending
human review/approved map). See
[[2026-09-24_task13-backend-restructure_evidence]] for full detail.

## What was done

The Task 13 backend, previously one file (`backend/app/hetheesha_task13.py`),
was split into its own `dev_tasks` package —
`backend/app/dev_tasks/french_keyword_research/` — matching the layout
every other dev task already uses. The API route prefix moved from
`/api/hetheesha/task13` to `/api/dev/french-keyword-research`. All ten
database tables were renamed from `hetheesha_kw13_*` to
`french_keyword_research_*` via `ALTER TABLE RENAME` (verified
byte-for-byte identical row counts + id-list checksums before/after — no
data loss). The Phase 8 frontend file was updated to call the new API
prefix.

## Why

The user asked for Task 13's backend to follow the same folder structure
as every other Development Task, and for no staff usernames to appear in
file, route, or table names anywhere in the codebase.

## Where the code lives now

`backend/app/dev_tasks/french_keyword_research/` — see the package's own
`__init__.py` docstring for the full module map and phase history.

## Testing

Structural/regression verification only (import success, route-list
diff, quality-check functions re-run against real data through the new
tables, one frontend build) — per explicit user instruction, no new
feature/browser testing was performed as part of this restructure. The
underlying business logic was already verified in each phase's own
evidence record and is unchanged by this move.

## Known limitations

None introduced by this restructure. All Phase 1-7 findings (Keyword
Planner still blocked, FR Shopify token missing `read_content`, Phase 5
singular/plural cluster duplicates) remain exactly as documented in their
own phase records — this work did not touch business logic.

## Next step

None required for this restructure — it is complete. Task 13's own next
step remains what Phase 8's handover already recorded: human review of
the dashboard, then Phase 9 (approval workflow).
