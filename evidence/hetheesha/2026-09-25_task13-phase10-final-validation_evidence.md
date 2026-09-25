# Evidence — Task 13 (Hetheesha) Phase 10: Final Validation

**Date:** 2026-09-25
**Scope:** lightweight final integration review of Phases 1-9, as instructed
(no full automated suite; the user tests the UI and workflow manually).
**Related:** phase 1-9 evidence/validation/handover files in this folder,
[[2026-09-24_task13-french-keyword-research-source-map]]

## Checks run in this phase (all real, all lightweight)

| Check | Result |
|---|---|
| Backend loads (`from app.main import app`) | OK |
| Frontend production build (`vite build`) | passes |
| Unused-code scan of the dashboard page (declarations + CSS classes) | none unused |
| Routes under `/api/dev/french-keyword-research` | 41 registered; 0 left on the old `/api/hetheesha/task13` prefix |
| Every endpoint path the dashboard page calls exists in the backend | all present |
| Write endpoints (POST/PATCH) protected by the server-side authorization dependency | 18 of 18 protected, none open |
| Shopify writes in the Task 13 package (GraphQL mutations) | none found |
| Approved Map reads only `approval_status = 'APPROVED'` | confirmed in `review.approved_map()` |
| One approved URL per primary keyword | database unique index `..._review_state_one_approved_idx` |
| Approve checks the stored ledsone.fr page inventory, rejects inactive products, returns 409 on a stale or conflicting change | present in `review.py` (code read, not executed) |
| Task registered in the Development Tasks lists and task registry | present (taskRegistry.js, DevLayout.jsx, AdminLayout.jsx) |
| Sync Monitor job `french-keyword-research` registered | yes |
| Access grant for the task | one grant, for `hetheesha` |
| Review tables clean before manual testing | 0 rows in review_state and review_history |

No integration defect was found, so no code was changed in this phase.

## Live pipeline result (Sync Monitor run 14:19-15:04 on 2026-09-24, success)

| Layer | Count |
|---|---|
| Seed keywords | 2,054 (64 Shopify collections + 1,990 Search Console queries) |
| With Search Console metrics | 2,007 |
| Classified (intent + modifiers) | 2,026; 28 classification errors |
| Clusters | 470 (previously 83 on the original 144 keywords) |
| Mappings | 470: NEEDS_REVIEW 177, CONFLICT 161, NO_SUITABLE_URL 106, AUTO_MAPPED 26, APPROVED 0 |
| Gaps | 258 |
| Potential cannibalisation cases | 162 |
| Mapping conflicts | 164 |
| Approved mappings | 0 (none reviewed yet) |

## Not verified in this phase (deliberately)

- Approve, reject, needs-edit and edit paths end to end.
- Responses to an unauthorized caller (401 / 403) and conflict handling.
- The dashboard in a browser (all tabs, filters, drawers, dialogs).
- That previously open POST endpoints, now protected, break nothing outside
  this page.
- Production deployment (not performed).

## Security

No secrets in code, output or this record. `.env` untouched. Authentication uses
the existing login token; Shopify is read-only.
