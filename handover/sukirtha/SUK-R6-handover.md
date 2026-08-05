# SUK-R6 — Handover

**Title:** Mailing List Cleanup — Handover
**Requirement ID:** SUK-R6
**Purpose:** Hand off the current state of this requirement — what's built, what's blocked, what's next.
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
**Status:** Built locally, awaiting written approval to deploy/push
**Known Limitations:** Email engagement metrics BLOCKED (Shopify API has no such data — confirmed independently two ways). Live verification pending deploy.
**Next Step:** Get written approval, then deploy + push + re-validate live.
**PASS / FAIL:** PASS (build stage)

## What was done

1. **Discovery first** (per instruction): confirmed Requirements 1–5 exist and are untouched;
   confirmed the UK Shopify connection architecture already exists (`SHOPIFY_UK_*` env vars,
   used by `api/salesuk.js`); confirmed via Shopify API schema knowledge AND a live check of
   the ledsone MCP servers (AIOS knowledge base + Postgres warehouse, all 18 schemas) that
   email engagement data does not exist anywhere in this organization's approved or existing
   infrastructure.
2. User explicitly authorized proceeding with only the available columns ("ok start
   development with the available column") rather than a full stop.
3. Added a new, isolated backend module `sukirthaR6HandlerModule` to `api/requirement.js`,
   dispatched via `?fn=sukirtha-r6`. Reuses the UK Shopify credentials already in production
   use — no new token, no new Vercel function file.
4. Added a "Requirement 6 · Mailing List Cleanup" tab to `pages/sukirtha.html` — table
   (Email, Name, Subscription Status, Subscribed Date), 3 summary cards, 3 filters, sorting,
   pagination, sticky header, CSV export, "Refresh Data" live-refresh button. Requirements
   1–5 were not touched (verified via `grep` for ID collisions and a div-balance check).
5. Updated `home.html`'s Sukirtha card from "5 Reports Live" to "6 Reports Live" — no other
   staff card touched.
6. Full AIOS documentation set created across prompts/evidence/validation/handover/reports/
   vercel folders.

## What's next

- **Get written approval** — per the explicit instruction, nothing has been deployed to
  Vercel or pushed to GitHub yet.
- Once approved: deploy, then live-test the Refresh Data button, confirm real customer counts
  return, confirm CSV export downloads correctly, update this handover + the validation report
  with the live results.

## Where to find things

- Backend: `reports/digital-marketing-member-pages/api/requirement.js` — search
  `sukirthaR6HandlerModule`
- Frontend: `reports/digital-marketing-member-pages/pages/sukirtha.html` — search `reqTab6`
- Home card: `reports/digital-marketing-member-pages/home.html`

## Risks / open questions

- If Sukirtha or the business later wants "original subscribe date" specifically (not the
  consent-last-changed date Shopify actually provides), that's a hard Shopify data limitation,
  not something fixable in code.
- `home.html`'s Sukirtha card subtitle still says "SEO & Digital Marketing · ledsone.de" even
  though SUK-R6 is scoped to ledsone.co.uk — left unchanged since only the report count was
  in scope for this task; worth flagging to Sukirtha/coordinator if the subtitle should
  reflect the multi-store scope now.
