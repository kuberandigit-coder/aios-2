# SUK-R5 — Deployment Readiness

**Title:** Low-Stock Alerts — Deployment Readiness
**Requirement ID:** SUK-R5
**Purpose:** Confirm the requirement is ready to deploy and note any pre-deploy conditions.
**Business Question:** Which products/variants on ledsone.de currently have low stock and require attention?
**Shopify Store:** ledsone.de
**Shopify Objects/Fields Used:** see `evidence/sukirtha/SUK-R5-shopify-source-map.md`
**Inventory Locations:** single active location "LEDSone DE LTD"
**Current Stock Logic:** SUM(available) across operational locations
**Low-Stock Threshold Source:** user-confirmed, Current Stock < 10
**Status Logic:** Not Assessable → Low Stock (<10) → OK
**Refresh Architecture:** Browser → `/api/requirement?fn=req2-req3&req=5` (existing merged Vercel function) → Shopify Admin GraphQL

## Files Modified

- `reports/digital-marketing-member-pages/pages/sukirtha.html`
- `reports/digital-marketing-member-pages/api/requirement.js`

## Deployment Prerequisites

- No new environment variables required — reuses the existing `SHOPIFY_ADMIN_TOKEN` already configured for ledsone.de (SUK-R2/R3).
- No new Vercel serverless function created — R5 is dispatched through the existing merged `api/requirement.js?fn=req2-req3` function, so `vercel.json`'s function list does not need updating.
- Both modified files pass local syntax validation (`node -c` on the API file; `new Function()` parse check on the inline HTML script block).

## Deployment Status

**NOT YET DEPLOYED.** Per project rules, no git push or Vercel deploy is performed without explicit user approval.

## Evidence Location

`evidence/sukirtha/SUK-R5-*.md`

## Validation Result

PASS (code-level) — see `validation/sukirtha/SUK-R5-validation-report.md`.

## Known Limitations

- Live production verification (actual Shopify row counts, real low-stock list) has not been performed and requires either a deployed environment or local dev-server run.

## Next Step

On approval: deploy via `vercel --prod` (or the project's standard flow) and/or push to GitHub, then verify Requirement 5 live in browser against real ledsone.de inventory data.

## PASS / FAIL

PASS (ready to deploy pending approval)

Owner: Sukirtha · Coordinator: Kuberan · Technical Reviewer: Sajeesan · Queryability Reviewer: Tamil Selvan · Business Validator: SEO Lead
