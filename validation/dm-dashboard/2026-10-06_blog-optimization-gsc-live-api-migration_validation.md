# Validation — Blog Optimization: GSC live API migration + applied-fix persistence

Date: 2026-10-06
Reviewer: (pending)

| Requirement | Test | Result | PASS/FAIL |
|---|---|---|---|
| Identify which sites have real, live GSC API access before building anything | Direct live API test against all 8 old sites + a raw request for the FR dedicated credential | 3 of 8 confirmed working (ledsone.co.uk, ledsone.de, ledsone.fr); 5 confirmed HTTP 403 | PASS |
| Disconnect from the external business database | Grepped `gsc.py` after rewrite for `get_business_conn` | No references remain; reads go through `get_conn()` against the app's own tables | PASS |
| Live GSC API data lands in the app's own Postgres | Ran `run_full_sync()` live, queried row counts before/after the ctr/position dtype fix | 0 rows before fix (silent per-site failure); 301,175 page rows + 75,606 query rows after | PASS |
| Weekly scheduler registered the same way every other scheduled dev task is | Code review against `collection_thin_content/scheduler.py`'s precedent + confirmed `blog_optimization_gsc_snapshot.start()` wired into `start_dev_task_snapshots()` | Matches established pattern exactly | PASS |
| Scheduler appears in Sync Monitor | Checked production page directly, found entry missing after first deploy; traced to `DevLayout.jsx`'s separate hardcoded menu array; fixed and re-confirmed live | Entry now visible under Sync Monitor sidebar | PASS |
| Frontend site dropdown shows only confirmed-working sites | `router.py`'s `/sites` reads `gsc.SITES.values()`, which now derives from `gsc_sync.SYNC_SITES` (3 sites) | Confirmed via import check: `SITES = {'sc-domain:ledsone.co.uk': 'ledsone.co.uk', 'https://ledsone.de/': 'ledsone.de', 'https://ledsone.fr/': 'ledsone.fr'}` | PASS |
| Shopify content lookup works for all 3 GSC-connected sites | Live-tested `fetch_blog_content()` against real articles on both ledsone.de and ledsone.fr | ledsone.fr succeeded end-to-end; ledsone.de returned a real, reproducible `ACCESS_DENIED` (Shopify app missing `read_content` scope — a permissions grant, not a code fix) | PARTIAL — flagged, not a code defect |
| Applied fixes persist across a page reload | Live round-trip test: `save_fix_log` then `get_fix_log` against the real database | Rows written and read back in the exact shape the frontend expects | PASS |
| "Locate Changes" correctly finds the changed span | Code review of the common-prefix/common-suffix approach against every fix's actual behavior (dedupe-links, heading renumber, FAQ-schema append — all single-region edits) | Approach is sufficient for this fix set; not yet click-tested in the live UI by a second person | PASS (logic), UI click-through pending |

## Overall

**PASS overall.** One flagged, non-code limitation (ledsone.de Shopify content access scope)
and one item (Locate Changes) validated by code/logic review and a live data round-trip but
not yet manually click-tested end-to-end in the browser by someone other than the person who
built it — recommended as the next verification step before calling this feature fully closed.
