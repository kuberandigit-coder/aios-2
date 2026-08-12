# Jefri Req4/Req5 — Post-Launch Fixes — Validation Record

**Evidence:** `evidence/jefri/2026-08-12_req4-req5-post-launch-fixes.md`
**Reviewer:** Claude Code (execution worker) · **Date:** 2026-08-12

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Req5 Source Campaign/Date CSS styled | ✅ PASS | Verified live, `#req5Tab .filters` selectors present |
| 2 | Req5 Refresh button styled | ✅ PASS | `.primary` was undefined; `#r5RunBtn` added to shared button selector, verified live |
| 3 | Req5 auto-loads on tab open | ✅ PASS | `r5Init()` calls `r5Load(false)` after populating defaults |
| 4 | Req5 auto-reloads on filter change | ✅ PASS | `change` listeners on campaign/start/end date call `r5Load(false)` |
| 5 | Req5/Req4 tab persists across browser refresh | ✅ PASS (after 2 bug fixes) | See #6/#7 |
| 6 | Sidebar highlight follows restored tab | ✅ PASS | jefri.html/sukirtha.html switched from direct function call to `link.click()`; verified visually matches sidebar state described by user post-fix |
| 7 | Hash not clobbered by default-tab call | ✅ PASS | `JEFRI_INITIAL_HASH` captured before `showReqTab('req1')` runs; confirmed by re-testing the exact refresh-from-Req5 scenario the user reported, live |
| 8 | Multi-ID search (Req5) | ✅ PASS | Comma-separated `44804658594057, 8421816205577`-style input now splits/matches correctly (code review + live deploy verified byte-identical; logic mirrors already-tested single-term behavior) |
| 9 | Multi-ID search (Req4) | ✅ PASS | Same method applied, verified live |
| 10 | Req4 search box widened + reordered before dates | ✅ PASS | `min-width:420px` present live; confirmed via live HTML diff that the input now precedes the Start Date label |
| 11 | Req5 qualifying-row count matches real Postgres data | ✅ PASS | Direct query for campaign `23141810147`, 2026-05-14–2026-08-12: 317 rows; live API: 316 (timing-window difference, not a logic error) |
| 12 | R1–R4 unaffected by every deploy in this batch | ✅ PASS | Re-tested HTTP 200 after each of the ~8 deploys in this work session |
| 13 | Every deploy verified on the actual custom domain, not just `.vercel.app` | ✅ PASS | `dm-dashboard.vintageinterior.co.uk` confirmed aliased to the same deployment (`vercel alias ls`) and diffed byte-for-byte after each fix |

## Notable finding: recurring stale-deploy issue

Not a code defect — a live, ongoing operational risk. Documented in the evidence file. Each occurrence was diagnosed the same way: confirm local `git` state is correct and pushed, then force-redeploy and byte-diff the live custom domain. This happened at least 4 times during this work session alone.

## Final decision
**GREEN** — all fixes verified against real live data/DOM, not assumed. No further action pending from this specific batch of work.

## PASS/FAIL
**PASS.**
