# Handover — Thasitha Requirement 2: PMax Product Zero-Performance — Live Refresh

**Title:** Req2 live refresh
**Status:** PASS — live and verified in production (2026-07-29)
**Reviewer:** Not recorded.

## What changed
`thasitha.html` Tab R2 no longer shows data frozen at 2026-07-15/16. It now fetches live from `fn=thasitha-req2` on every load (with IndexedDB restore for instant paint + a "Refresh Data" button), same pattern as Req1/Req3. New campaigns are picked up automatically (a 3rd Thasi PMax campaign added 2026-07-22 already shows up with no code change needed).

## Data Check column
Kept per user instruction ("use the same proxy as mahima, keep the column"). It is **not** real Google Merchant Center approval data — that doesn't exist anywhere in Postgres for PMax (re-confirmed live 2026-07-29). It's the same derived proxy as Mahima's Feed Status: which of 10 `google_ads.merchant_products` catalog columns are blank for that product. Documented in the API's `dataNote` field and should stay documented wherever this column is explained to Thasitha.

## Where
- Backend: `thasithaReq2HandlerModule` in `api/requirement.js`, dispatched via `fn=thasitha-req2`.
- Frontend: `pages/thasitha.html`, R2 tab — static `R2_PRODUCTS` array replaced with `r2Load`/`r2ApplyLive` live-fetch functions.
- Deployed via push to `staff/main` (Vercel auto-deploy), synced to `aios-2`.

## Two real bugs found and fixed mid-build
1. Live-stock fetch was calling a function scoped in a different module's closure — silently failed for every row. Fixed with a self-contained copy inside the new module.
2. `first_date` (a `Date` object from `pg`) was stringified with `String()` instead of `.toISOString()`, producing `"Mon Apr 27"` instead of `"2026-04-27"`. Fixed.
Both confirmed fixed via live re-check after redeploy — see validation doc.

## Next steps
None outstanding. If a real GMC diagnostics feed is ever connected to Postgres, swap `thasitha2DataCheck()` in `requirement.js` for the real fields.
