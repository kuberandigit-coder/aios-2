# SUK-R6 — Completion Report

**Title:** Mailing List Cleanup — Completion Report
**Requirement ID:** SUK-R6
**Purpose:** Summarize what was delivered for sign-off.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk
**Shopify Objects/Fields Used:** `Customer` — `id`, `email`, `firstName`, `lastName`, `emailMarketingConsent { marketingState, marketingOptInLevel, consentUpdatedAt }`
**Files Modified:** `pages/sukirtha.html`, `home.html`, `api/requirement.js`
**Evidence Location:** `evidence/sukirtha/SUK-R6-shopify-source-map.md`, `evidence/sukirtha/SUK-R6-field-mapping.md`
**Validation Result:** `validation/sukirtha/SUK-R6-validation-report.md` — PASS (pre-deploy scope)
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Built, awaiting deploy approval
**Known Limitations:** Engagement metrics BLOCKED (see below)
**Next Step:** Written approval → deploy → live validation
**PASS / FAIL:** PASS

## What Was Delivered

- New "Requirement 6 · Mailing List Cleanup" tab added to the existing live Sukirtha member
  page (`pages/sukirtha.html`), preserving Requirements 1–5 unchanged.
- Table: **Email, Name, Subscription Status, Subscribed Date** — the 4 fields Shopify's
  Admin API can actually provide.
- Summary cards: Total Subscribers, Subscribed, Unsubscribed.
- Filters: Search Email, Search Name, Subscription Status.
- Sorting (any column), pagination (50/100/250/500 rows), sticky header, responsive layout,
  CSV export of the filtered view, "Refresh Data" button with live server-side re-fetch and a
  "Last Refreshed" timestamp.
- New `sukirthaR6Handler` added to `api/requirement.js`, reusing the existing UK Shopify
  credential architecture (`SHOPIFY_UK_*` env vars, same as `api/salesuk.js`) and the existing
  merged-endpoint pattern (no new Vercel function, stays under the Hobby-plan 12-function cap).
- `home.html`'s Sukirtha card updated from "5 Reports Live" to "6 Reports Live" — only her
  card touched.
- **5 requested columns explicitly NOT built** (Last Open Date, Last Click Date, Opens,
  Clicks, Total Emails Sent) and **3 requested cards NOT built** (Never Opened, Recently
  Active, Inactive Subscribers) and **2 requested filters NOT built** (Open Activity, Click
  Activity) — all because the underlying engagement data does not exist in Shopify's Admin
  API, confirmed via two independent checks (API schema review + a live search of this
  organization's entire Postgres warehouse and AIOS knowledge base, which found zero
  matching tables or documentation). Per the requirement's own instruction, these were left
  out rather than filled with sample or estimated values.

## Files Modified

- `reports/digital-marketing-member-pages/pages/sukirtha.html`
- `reports/digital-marketing-member-pages/home.html`
- `reports/digital-marketing-member-pages/api/requirement.js`

## Deployment status

**Not yet deployed or pushed** — per the explicit instruction not to deploy to Vercel or push
to GitHub without written approval. See `vercel/sukirtha/SUK-R6-deployment-readiness.md`.
