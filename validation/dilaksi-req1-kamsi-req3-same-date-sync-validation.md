# Validation — Dilaksi Req1 & Kamsi Req3 Same-Date Sync

**Date:** 2026-07-07
**Reviewer:** Claude Code (fetch script cross-check + live deployment check)

| Check | Result |
|---|---|
| Both fetch scripts run back-to-back, same "today" reference | PASS |
| Confirmed identical sessions/pages/revenue at every window (60/45/30/15/7d) between the two reports | PASS |
| Dilaksi Req1 GSC query column: root cause found (regex scraping literal `<td>` tags that don't exist in a JS-rendered page) | PASS |
| Fix verified: query map entries went from 1 (broken) to 43 (correct, matches embedded JSON) | PASS |
| Tab-nav/back-button now baked into Dilaksi req1 builder template (previously would regress on every rerun) | PASS |
| Both pages' "Generated" date updated to actual fetch date (2026-07-07) | PASS |
| Deployed and confirmed live via curl (matching 60-day session totals: 15,890 on both) | PASS |
| Restored pre-fix dilaksi.html from git before rerunning corrected builder (no data loss) | PASS |

**Overall: PASS**
