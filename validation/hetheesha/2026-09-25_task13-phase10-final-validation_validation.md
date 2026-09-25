# Validation — Task 13 (Hetheesha) Phase 10: Final Validation

**Date:** 2026-09-25
**Evidence:** [[2026-09-25_task13-phase10-final-validation_evidence]]

| Requirement | Validation | Result |
|---|---|---|
| Full flow connected: GSC + Shopify -> keywords -> intent/modifiers -> clusters -> mapping -> gaps -> cannibalisation -> review -> approved map | The whole pipeline ran on the server on 2,054 keywords and produced 470 clusters, 470 mappings, 258 gaps, 162 cannibalisation cases; review and approved-map endpoints exist | PASS |
| Page connected to Development Tasks, task registry, APIs, data layer | Registered in taskRegistry.js, DevLayout.jsx, AdminLayout.jsx; every endpoint the page calls exists; build passes | PASS |
| UAM / access | One access grant for the task exists (`hetheesha`); write endpoints check admin/dev role or that grant on the server | PASS (configuration) / PARTIAL (behaviour not exercised) |
| Core rule: one primary keyword -> one approved URL | Database unique index on approved keywords; approve refuses a keyword already approved elsewhere (code read) | PASS (design) / PARTIAL (not exercised) |
| Approved Map contains only approved mappings | `approved_map()` filters `approval_status = 'APPROVED'` | PASS |
| URLs come from the real ledsone.fr inventory | Approve validates against the stored Shopify page inventory | PASS (code read) |
| No fabricated keywords, URLs or data | All keywords come from Shopify collections and Search Console; no metrics invented | PASS |
| No automatic Shopify SEO/content changes | No GraphQL mutations anywhere in the package | PASS |
| Existing dashboard functionality not broken | Backend loads; frontend builds; only additive edits to shared files (`auth.py` adds one function) | PARTIAL — not exercised in a browser |
| Server-side authorization on all writes | 18 of 18 write endpoints protected | PASS |
| Approve / reject / needs-edit workflow | Written, code reviewed, not run end to end | PARTIAL — manual test pending |
| Unauthorized caller handling, conflict handling | Not exercised | PARTIAL — manual test pending |
| Data-source completeness | Blog/article pages missing from the page inventory (Shopify token lacks `read_content`) | PARTIAL |
| Search demand data (volume, competition, CPC) | Not implemented — Google Keyword Planner was dropped by decision; columns removed from the UI | N/A (out of scope) |
| Deployment | Not deployed | NOT PERFORMED |

**Overall result: PARTIAL.** Implementation is complete for the agreed scope and
nothing failed, but the human-review workflow, authorization failures and the
UI have not been exercised, and blog pages are not in the inventory. Task 13
must not be recorded as COMPLETED until the manual checks in the handover pass.

## Duplicate-risk review

No new tables, services or routes were created in this phase. Earlier phases
used existing patterns (ensure_schema, ScheduledSnapshot, jreq UI classes,
existing access grants). The only new cross-cutting code is `auth.verify_token`.

---

## Update after deployment (2026-09-25)

Evidence: [[2026-09-25_task13-post-phase10-changes_evidence]]

| Requirement | Validation | Result |
|---|---|---|
| Pipeline runs on the server and covers all keywords | Sync Monitor run: success, 758 s, 2,054 keywords covered | PASS |
| Blog articles gathered from Shopify | Blog job: success, 71 articles in the page inventory | PASS |
| Failed blog read is visible, not hidden | Simulated blocked and error responses make the job fail with the reason and leave stored rows unchanged (1,183 rows before and after) | PASS |
| Clusters tab not empty during a run | Endpoint returned 470 clusters while the newest run was empty; run 684 (467 clusters) now shows | PASS |
| Keyword tab shows every keyword | Endpoint returns total 2,054 (2.7 MB, about 3 s) | PASS (endpoint) / PARTIAL (not seen in a browser by me) |
| Informational keywords map to blog pages | Mappings were built before the blogs were stored; not rebuilt | PARTIAL — re-run required |
| Auto-resume after a real restart | Decision logic tested with simulated records; no live restart observed | PARTIAL |
| Phase 9 review workflow, authorization failures, UI | Not exercised | PARTIAL — manual testing pending |

**Overall result: PARTIAL** (unchanged). Nothing failed; the remaining items
are the re-run and the manual checks.
