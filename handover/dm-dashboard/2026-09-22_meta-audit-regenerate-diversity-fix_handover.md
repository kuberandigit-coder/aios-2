# Handover — Meta Title & Description Audit: Regenerate diversity + log-tab keyword edit

Date: 2026-09-22
Owner: (dm-dashboard dev tooling)
Reviewer: project owner/team

## What was fixed

Two real bugs on the Meta Title & Description Audit page
(`dev_tasks/meta_audit`), both confirmed via live testing against the
real database and the real self-hosted LLM:

1. Regenerate could return identical/near-identical text to the previous
   generation, even with a corrected keyword — root cause: no
   `temperature` set on the LLM call, and the prompt had no awareness it
   was a regenerate.
2. The Generated Titles/Descriptions log tab's own Regenerate button had
   no way to change the keyword at all — always reused the original.

## Files changed

- `backend/app/dev_tasks/meta_audit/generate.py` (temperature + previous-
  version-avoidance prompt block)
- `backend/app/dev_tasks/meta_audit/router.py` (fetches previous text on
  regenerate, both the replaceLogId path and the Missing Metadata tab's
  own path)
- `backend/app/dev_tasks/meta_audit/schema.py`
  (`get_generation_log_entry`, `get_latest_generation`)
- `frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx`
  (editable "Keywords Used" cell on the log tab)

## Testing

Live-tested 3 consecutive regenerates on the same real product/keyword
locally (3 genuinely distinct titles), the full router-level
`replaceLogId` path, AND re-verified directly against **production**
after deploy via two live `curl` calls to the real API — confirmed
genuinely different output both times. Test log rows deleted after
verification.

## Current status

Implemented, live-tested locally and in production, pushed to
`dev-work` only (commit `d380483`). **Confirmed live and working in
production the same day** — this one is fully closed out.

## Known limitations

None identified — both reported symptoms reproduced, root-caused, fixed,
and re-verified live.

## Next step

None — done.
