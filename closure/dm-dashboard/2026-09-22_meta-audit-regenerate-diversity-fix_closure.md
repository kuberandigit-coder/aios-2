# Closure — Meta Title & Description Audit: Regenerate diversity + log-tab keyword edit

Date: 2026-09-22
Owner: (dm-dashboard dev tooling)
Reviewer: Kuberan
Repo: dm-dashboard, branch `dev-work`

## Status: COMPLETE

Both reported symptoms (Regenerate producing identical/near-identical
output; the log tab's Regenerate having no way to correct a wrong
keyword) were root-caused, fixed, live-tested locally, deployed, and
**re-verified directly against the real production API** the same day —
two sequential live calls to the same real product/keyword returned
genuinely different titles.

## What was built

- `temperature=0.9` on the local LLM call (previously unset — the actual
  root cause of the "identical output" symptom).
- A "previous version, must genuinely differ" instruction injected into
  the prompt whenever a prior generation exists for that URL/field.
- The Generated Titles/Descriptions log tab's "Keywords Used" column
  made editable, wired into the Regenerate call.

## Key files

`backend/app/dev_tasks/meta_audit/generate.py`,
`backend/app/dev_tasks/meta_audit/router.py`,
`backend/app/dev_tasks/meta_audit/schema.py`,
`frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx`

## Commits

`d380483` (dev-work), deployed and confirmed live.

## Known limitations

None identified.
