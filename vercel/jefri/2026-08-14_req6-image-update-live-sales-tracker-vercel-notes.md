# Vercel Notes — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Deployment readiness record for `evidence/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`.

## Current implementation
- Route: `GET /api/requirement?fn=jefri-req6&listingId=<id>&imageUpdateDate=YYYY-MM-DD`
- Handled by the existing `api/requirement.js` serverless function (no new function/route added — stayed under the 12-function Vercel Hobby cap by extending the existing `requirement.js` dispatcher, same pattern as Req4/Req5).
- Frontend: `pages/jefri.html`, new `req6Tab` section, no new page created.

## Required environment variables
None new — reuses `DATABASE_URL` (or `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSSL`), already configured for this Vercel project and used by every other handler in `requirement.js`.

## Backend/API requirements
None new. Same Postgres connection pool pattern (max 3 connections, 8s connect timeout, 30s statement timeout) as `jefriReq5HandlerModule`.

## Database connectivity requirements
None new — same production Postgres instance already in use.

## Deployment readiness
READY — no new infra, no new env vars, no new Vercel function count. Purely additive code inside an existing function and an existing page.

## Known Vercel limitations
None specific to this feature. General project constraint (12 serverless functions on Hobby plan) was respected by not creating a new `api/*.js` file.

## Validation result
PASS — see `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`.

## Deployment status
**DEPLOYED.** Pushed to `Staff-requirements` (commit `92bc7a3`) and `aios-2` (commit `3ec1e14`), then deployed via `vercel --prod --yes`. Confirmed live via `curl` against `/api/requirement?fn=jefri-req6` (multiple test cases, all correct) and against `/pages/jefri.html` (Requirement 6 tab markup present). Re-ran `scripts/check-live-deploy.js` post-deploy — all pre-existing canaries still OK, confirming no regression to earlier same-day fixes (kuberan/piranav sidebar, muguntha embed fix, Staff ID Performance tabs).
