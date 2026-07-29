# Validation — salesuk.html Full Buildout, sales.html Cleanup

**Date range:** 2026-07-27 to 2026-07-29

## Checks
- [x] All 11 groups (10 real + Not Assigned) live-verified for every month Jan-Jul with correct order counts/net sales at each reassignment step.
- [x] Mutual exclusivity verified by code review of `GROUPS`/`assignGroup()` — priority-ordered, first match wins, `Not Assigned` is the logical complement.
- [x] January and February fully reconciled to 0 remaining/unassigned orders; March-June reduced to 0-1 remaining (confirmed genuinely untraceable via `?group=remaining`'s medium/session/last-session diagnostics before being left unassigned).
- [x] July verified live and auto-refreshing (hourly GitHub Action, `salesuk` mode).
- [x] Two real bugs found during expansion (matchValue missing `journey` param; Multifeeds mislabeling) were root-caused against real order data, fixed, and the affected snapshots regenerated and reverified — not just patched blind.
- [x] `sales.html` tab removal confirmed via `node --check` + inline script-block parse test + live curl showing `tabBtnSajeepan` absent, "UK Sales" present.
- [x] `api/sales.js` dead-code removal confirmed via grep (zero remaining references to the 5 removed staff keys) + live smoke test on 2 unrelated endpoints (Kamsi, Mahima) post-deploy.
- [x] Staff-requirements repo kept in sync after every deploy for the remainder of the session, following the dual-deploy discovery.
- [ ] No automated test suite exists for any of this (manual curl/live verification only, consistent with the rest of the codebase).
- [ ] The Assign-from-UI feature for Not Assigned is not built — explicitly deferred by the user pending a GitHub token decision.

## Status: PASS
**Reviewer:** Not recorded.
**Next step:** Assign-from-UI persistence (blocked on a user decision about GitHub-token vs. review-queue architecture); extend to August when it opens.
