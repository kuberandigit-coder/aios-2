## Purpose
Fix slow loading on muguntha.html's Employee Performance page — each staff tab (Sonya, Sajeepan, Kamsi, Jefri, Dilaksi) fired 40 separate HTTP requests (20 months x sales+cost) on first click, per `loadAll()` in muguntha.html.

## Change (Sonya only, per user's request to scope it down)
1. `api/muguntha.js`:
   - Refactored the single-month cost handler into a reusable `getCostPayload(employeeKey, month, forceRefresh)` function (pure refactor, no behaviour change — verified live via `?employee=sonya&month=2026-08`, HTTP 200, 2.7s, same field shape as before).
   - Added `handlePerfBatch()` behind a new `?action=perf-batch&member=sonya` route: fetches all 20 months' sales (in-process calls into `salesuk.js`/`sales25.js`'s existing handlers via a mock req/res, avoiding real HTTP round trips) and cost (direct `getCostPayload` calls) in one serverless invocation, concurrency-capped at 6 via a server-side `mapLimit`.
2. `pages/muguntha.html`: added `fetchSonyaBatch()` + wired `loadAll()` to use it only when `member === 'sonya'`; every other staff member is untouched, still uses the original 40-request path.
3. `vercel.json`: bumped `api/muguntha.js`'s `maxDuration` from 60 to 300, matching `salesuk.js`'s own budget — required because the batch endpoint now runs `salesuk.js`'s live-month Shopify scan (documented 30-90s+) in-process, and the old 60s limit was silently killing the request before that scan could finish.

## Bug found & fixed during rollout
First deploy (maxDuration still 60) caused the batch endpoint to hang with no response (HTTP 000) — traced to Vercel killing the function at 60s while the live-month (2026-08) Shopify scan needs up to 90s+. Confirmed via a control test that the existing standalone `/api/salesuk?group=sonya&month=2026-08` endpoint (unmodified, `maxDuration: 300`) also takes 20s+ (this is pre-existing, documented behavior — not something I introduced). Fixed by raising `api/muguntha.js`'s maxDuration to 300, redeployed, and user confirmed manually the Sonya tab now loads fast.

## Files changed
- `reports/digital-marketing-member-pages/api/muguntha.js`
- `reports/digital-marketing-member-pages/pages/muguntha.html`
- `reports/digital-marketing-member-pages/vercel.json`

## Evidence
- Deployed to production (final deployment dpl_6xh7zU1Wk197kaBX8Lau8TADq9Wz, READY, aliased to https://dm-dashboard.vintageinterior.co.uk)
- User confirmed manually: "ok perfect i ckeck mannually now fast"
- Pushed to both repos: Staff-requirements (commits fc901a6, 83db560), aios-2 (commits 80faf63, 6fec643)

## Status
PASS — user-confirmed live.

## Reviewer
Kuberan

## Next step
If Kuberan wants the same fix for the other staff tabs (Sajeepan, Kamsi, Jefri, Dilaksi), extend `handlePerfBatch()`'s `member` allow-list and add each one's `fetchXBatch()` on the frontend, same pattern as Sonya's.
