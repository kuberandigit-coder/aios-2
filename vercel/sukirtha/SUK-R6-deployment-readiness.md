# SUK-R6 — Deployment Readiness

**Title:** Mailing List Cleanup — Deployment Readiness
**Requirement ID:** SUK-R6
**Purpose:** Confirm the requirement is ready to deploy and note any pre-deploy conditions.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk
**Shopify Objects Checked:** `Customer`, `Customer.emailMarketingConsent`
**Files Modified:** `pages/sukirtha.html`, `home.html`, `api/requirement.js`
**Evidence Location:** `evidence/sukirtha/SUK-R6-shopify-source-map.md`, `evidence/sukirtha/SUK-R6-field-mapping.md`
**Validation Result:** `validation/sukirtha/SUK-R6-validation-report.md` — PASS (pre-deploy scope)
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Ready to deploy, blocked on written approval
**Known Limitations:** Engagement metrics BLOCKED (see field mapping doc)
**Next Step:** Obtain written approval, then run the deploy steps below.
**PASS / FAIL:** PASS (readiness) — deploy itself withheld pending approval

## Files Modified

- `reports/digital-marketing-member-pages/pages/sukirtha.html`
- `reports/digital-marketing-member-pages/home.html`
- `reports/digital-marketing-member-pages/api/requirement.js`

## Deployment Prerequisites

- ✅ `node --check api/requirement.js` — syntax clean.
- ✅ `<div>` tag balance verified on `sukirtha.html` (223/223, no orphaned tags).
- ✅ No new Vercel environment variable required — reuses existing `SHOPIFY_UK_STORE_DOMAIN`,
  `SHOPIFY_UK_API_VERSION`, `SHOPIFY_UK_ADMIN_TOKEN`, already set in Production.
- ✅ No new serverless function file — merged into the existing `api/requirement.js`
  (currently well under the Vercel Hobby-plan 12-function cap).
- ✅ Requirements 1–5 confirmed structurally untouched (no shared identifier collisions).
- ⛔ **NOT deployed to Vercel.**
- ⛔ **NOT pushed to GitHub (`aios-2` or the staff repo).**

## Explicit hold reason

Per the requirement's own instruction: *"Do not deploy to Vercel or push GitHub without
written approval."* All changes described in this document exist only in the local working
copy at `C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\`.
Nothing has left this machine.

## Deploy steps (to run once approval is given)

1. `git add` the 3 modified files, commit, push to `aios-2` (`origin main`).
2. Sync into the `staff-sync29` worktree (the actual `Staff-requirements` repo the task
   refers to), commit, push to `staff temp-de-tabs:main`.
3. `vercel --prod --yes` from `reports/digital-marketing-member-pages` to deploy live.
4. Live-verify: fetch `/api/requirement?fn=sukirtha-r6&refresh=1`, confirm real customer data
   returns; load `pages/sukirtha.html`, click into Requirement 6, confirm the table/cards
   populate; test the Refresh Data button and CSV export; reload Requirements 1–5 to confirm
   no regression.
5. Update this document and `validation/sukirtha/SUK-R6-validation-report.md` with the live
   results, closing out the PENDING rows.
