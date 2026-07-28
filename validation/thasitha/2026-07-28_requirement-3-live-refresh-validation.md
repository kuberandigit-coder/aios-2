# Thasitha Requirement 3 — Live PostgreSQL Refresh — Validation

**Date:** 2026-07-28

## Checklist

| Check | Result |
|---|---|
| Data comes from PostgreSQL only (no baked/static data) | PASS — old ~470KB static `R3_DATA` literal removed entirely; `let R3_DATA = []` populated only by live fetch |
| Refresh Data makes a new server-side request | PASS — `r3Load(true)` calls `fetch('/api/requirement?fn=thasitha-req3&refresh=1')`, bypassing the 3-minute cache |
| Removed/stale campaign products correctly excluded | PASS — verified live on production: a Jefri campaign whose last activity was 2026-03-04 is correctly excluded from "currently overlapping" against a live latest-date of 2026-07-28 |
| "Currently active" threshold computed live, not hardcoded | PASS — `R3_LATEST_DATE`/`R3_ACTIVE_THRESHOLD` are `let`, recomputed from the live payload's `latestDate` on every load |
| No credentials exposed client-side | PASS — DB creds read only server-side in `requirement.js`, same pattern as existing endpoints |
| No production data modified | PASS — only `SELECT` queries added |
| Query completes without timing out | PASS after fix — initial deploy hit `statement_timeout: 30000` on a ~33s query and returned 500; raised to 60000ms, re-tested live: 200 OK in ~46s including network+JSON serialization |
| Payload structure matches what the existing frontend render logic expects | PASS — `{sku,title,img,lnk,camps:[{cid,cname,ctype,cstatus,isThasi,lastActive,daily:[{d,cost,clk,conv,cv}]}]}`, identical shape to the old static `R3_DATA`, so `r3ComputeRow`/`renderR3Row`/`renderR3` needed no logic changes |
| Campaign/Type filter dropdowns repopulate after live load | PASS — `initR3Filters()` converted from one-shot IIFE to a function re-called in `applyR3LiveData()` |
| Requirements 1, 2, 4, 5 unaffected | PASS — no shared IDs/functions touched outside the R3 script section and the new backend module |
| Both files pass syntax validation | PASS — `node -c` on `api/requirement.js`; `new Function()` parse check on both `<script>` blocks in `thasitha.html` |
| Deployed to production and verified live | PASS — `vercel --prod` deploy, then direct `curl` against `https://digital-marketing-member-pages.vercel.app/api/requirement?fn=thasitha-req3&refresh=1` returned 200 with 485 products and the expected stale-exclusion behavior |

## Known Limitations

- Query is slow (30-45s) due to historical row volume; mitigated with a longer (3-minute) cache than other endpoints. A user clicking "Refresh Data" will wait up to ~45s for a response — this was accepted as the tradeoff for genuine on-demand freshness rather than optimizing the query further in this pass.
- Not yet interactively tested in a browser (only via direct API/curl verification) — recommend a follow-up visual check of the R3 tab's filters, pagination, and CPC inflation table rendering with live data.

## PASS / FAIL

**PASS** — bug confirmed fixed against live production data; one deployment-blocking issue (query timeout) found and fixed during verification, redeployed and re-confirmed working.
