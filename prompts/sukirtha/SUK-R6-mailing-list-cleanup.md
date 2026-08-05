# SUK-R6 — Mailing List Cleanup (Prompt)

**Title:** Mailing List Cleanup
**Requirement ID:** SUK-R6
**Purpose:** Give Sukirtha a live view of which subscribed customers need email-list cleanup, based on subscription status and email engagement.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk
**Shopify Objects Checked:** `Customer` (email, firstName, lastName, emailMarketingConsent)
**Files Modified:** `pages/sukirtha.html`, `home.html`, `api/requirement.js`
**Evidence Location:** `evidence/sukirtha/SUK-R6-shopify-source-map.md`, `evidence/sukirtha/SUK-R6-field-mapping.md`
**Validation Result:** See `validation/sukirtha/SUK-R6-validation-report.md`
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Built — awaiting written approval to deploy/push
**Known Limitations:** Email engagement metrics (Opens, Clicks, Last Open Date, Last Click Date, Total Emails Sent) are BLOCKED — not available from Shopify's Admin API. See field mapping doc.
**Next Step:** Await written approval to deploy to Vercel and push to GitHub.
**PASS / FAIL:** PASS (for the fields that are available; engagement fields are a documented, approved BLOCKED outcome, not a failure of the build)

## Original request (as given, verbatim scope)

Execution-worker task: add a new "Requirement 6 – Mailing List Cleanup" tab to `sukirtha.html`
only (no new HTML page), update Sukirtha's card count on `home.html` only, using ONLY the
approved Shopify Admin API for `ledsone.co.uk` (read-only), with a required table (Email,
Name, Subscription Status, Subscribed Date, Last Open Date, Last Click Date, Opens, Clicks,
Total Emails Sent), summary cards, filters, table features, live refresh, and full AIOS
documentation — with an explicit instruction that if Shopify cannot provide the engagement
metrics, STOP and return BLOCKED rather than fabricate data.

## Discovery outcome that shaped the build

Discovery (conducted before any file was touched, per the requirement's own instruction)
confirmed the engagement metrics are genuinely unavailable from Shopify's Admin API — checked
two independent ways (Shopify API schema knowledge, and a live search of this project's
entire Postgres warehouse + AIOS knowledge base for any email-engagement data, which found
none). The user, on seeing this finding, explicitly said "ok start development with the
available column" — authorizing a scoped build with only the confirmed-available fields
(Email, Name, Subscription Status, Subscribed Date) rather than a full stop with nothing
delivered.
