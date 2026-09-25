# Validation — Task 13 Phase 9: Human Review + Approved Keyword Map

**Date:** 2026-09-25
**Overall result: PARTIAL.** End-to-end workflow, API and browser testing was
cut short by the user's instruction ("stop testing, finish Phase 9"). Phase 10
must test the paths listed under NOT verified.
**Deployment:** Local/development implementation only — deployment pending.
**Closure:** Phase 9 Human Review & Approved Keyword Map Completed — Final
Validation Pending. (Task 13 is not closed; Phase 10 remains.)

## Verified

| Item | Result | Evidence |
|---|---|---|
| Backend imports | PASS | `from app.main import app` -> IMPORT OK |
| Frontend compiles | PASS | one `npx vite build` succeeded |
| No unused code left | PASS | unused-declaration and unused-CSS scan: none |
| Schema is additive only | PASS | code review of the schema diff: two new tables, three indexes; no existing table or constraint changed |
| Pipeline job unaffected | PASS (code review) | `pipeline.py`, `url_mapping.py` unchanged; the job calls functions directly, not HTTP |
| Authorization design | PASS (code review) | every POST/PATCH depends on `require_task_access`; identity from the JWT; grant lookup matches the real `access_grants` columns |
| Reviewer identity | PASS (code review) | taken from the token; the request body has no reviewer field |
| Old mapping PATCH cannot approve | PASS (code review) | APPROVED now rejected there |
| Server-side approve checks present | PASS (code review) | URL in inventory, page-type/intent compatibility, active product, unique approved primary keyword (code + partial unique index), version token, required notes |
| History append-only | PASS (code review) | history is inserted, never updated |
| Approved map = APPROVED only | PASS (code review) | query filters `approval_status = 'APPROVED'` |
| Earlier partial API testing | PARTIAL evidence | before it was stopped, the previous agent's testing left history for approve, reject, reopen (edit), needs-edit, re-approve, revoke to needs-edit and an approval with secondary keywords. These were test rows and were deleted. |
| Test data cleanup | PASS | 8 history rows and 3 state rows (all `zz-test-reviewer`) deleted; both tables 0 rows; `url_mappings` unchanged (0 with a reviewer, 0 APPROVED) |
| No secrets in the new code | PASS (code review) | no credentials in the new backend or frontend code |

## NOT verified (Phase 10 must test)

- Each workflow path re-run end to end: approve, reject (reason required),
  needs-edit (note required), edit/reopen.
- Backend authorization for an unauthorized caller (401 without a token, 403
  without a grant) and for an authorized non-admin with a grant.
- Conflict handling: two reviewers approving the same primary keyword, stale
  version token, candidate changed while the drawer was open, URL no longer
  active.
- The Approved Map returning only approved rows in a browser, and the queue
  filters and pagination with the full dataset.
- The review drawer, confirmation dialog and error display in a browser; the
  page was not visually verified.
- That Hetheesha can see the task: an admin must tick her in the User Access
  Management matrix (no grant row was written).
- Regression of existing pages and the effect of protecting the previously open
  POST endpoints (the dashboard page itself only uses GETs plus the new review
  POSTs).

## Known limitations

- The existing UAM has a single grant per task, so review, edit, approve and
  reject cannot be separated; every authorized user can do all of them.
- Approving requires a page in the Shopify page inventory; the French store has
  no blog rows yet (missing `read_content` permission), so informational
  keywords cannot be approved to a blog page until that is granted.
- Read-only GET endpoints remain open, per the existing dev-task convention.
