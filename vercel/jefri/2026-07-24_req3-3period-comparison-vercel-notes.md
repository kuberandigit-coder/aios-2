# Vercel Notes — Jefri Requirement 3 (T-03), 3-Period Product Comparison

**Date:** 2026-07-24

## Deployment
- Deployed via `vercel --prod --yes` from `reports/digital-marketing-member-pages/`.
- Project: `digital-marketing-member-pages` (`prj_ziowoLxTbIReqBYx1zVweZZBaBDg`).
- No new environment variables required — reuses the existing `DATABASE_URL` (Postgres) already configured for Req1/Req2.
- No new serverless function created — `jefriReq3Handler` was added inside the existing `jefriProductStatusHandlerModule` in `api/requirement.js` and dispatched via the existing `?fn=` router, so this stays within the Vercel Hobby-plan function-count limit.

## Live verification performed
- `GET https://digital-marketing-member-pages.vercel.app/api/requirement?fn=jefri-req3&refresh=1` → HTTP 200, real data (4,791 products).
- `GET https://digital-marketing-member-pages.vercel.app/pages/jefri.html` → confirmed `req3Tab`, `tabBtnReq3`, and the `fn=jefri-req3` fetch call are present in the deployed HTML.

## Caching behavior
- 60-second in-memory cache (`JEFRI_R3_CACHE`), resets on cold start.
- Static-snapshot fallback checked at `data/jefri-req3-snapshot.json` — **file does not exist yet**, so every cold-start/non-cached request currently does a live Postgres query. Not yet added to the hourly snapshot-refresh job (`api/scripts/generate-snapshots.js postgres` would need a `jefri-req3` entry added to its `POSTGRES_ENDPOINTS` list if this becomes a priority).
