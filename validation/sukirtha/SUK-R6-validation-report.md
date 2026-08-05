# SUK-R6 — Validation Report

**Title:** Mailing List Cleanup — Validation Report
**Requirement ID:** SUK-R6
**Purpose:** Verify the build is correct and safe before deployment approval is requested.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk
**Shopify Objects Checked:** `Customer`, `Customer.emailMarketingConsent`
**Files Modified:** `pages/sukirtha.html`, `home.html`, `api/requirement.js`
**Evidence Location:** `evidence/sukirtha/SUK-R6-shopify-source-map.md`, `evidence/sukirtha/SUK-R6-field-mapping.md`
**Validation Result:** See checklist below — pre-deploy checks PASS; live-data checks PENDING (blocked on written deploy approval, not yet run against the live site)
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Built, not yet deployed
**Known Limitations:** See below.
**Next Step:** Await written approval to deploy; then re-run the PENDING checks against the live site and update this report.
**PASS / FAIL:** PASS (pre-deploy scope) — final PASS pending live verification after deploy approval

## Checklist (per the requirement's own validation list)

| Check | Result | Notes |
|---|---|---|
| Requirements 1–5 still work | ✅ PASS (structural) | No existing tab's HTML, IDs, or JS functions were touched — only new `reqTab6`/`tabBtn6`/`r6*` identifiers added, verified to not collide with any existing `r1`–`r5` identifier (checked via `grep`) |
| Requirement 6 loads correctly | ⏳ PENDING | Cannot be confirmed live until deployed |
| `home.html` Requirement count updated | ✅ PASS | Sukirtha's card changed from "5 Reports Live" to "6 Reports Live"; no other staff card touched |
| Data retrieved from Shopify | ⏳ PENDING | Query is written and syntax-valid; live retrieval not yet exercised (requires deploy) |
| Refresh Data retrieves fresh Shopify data | ⏳ PENDING | Same as above |
| No duplicate customers | ✅ PASS (by design) | Backend dedupes by email, keeping the most recently consent-updated row, before the response is ever sent to the browser |
| CSV Export works | ✅ PASS (structural) | Reuses the same CSV-generation pattern already working on Requirement 5; exports the 4 available columns |
| No Shopify credentials exposed | ✅ PASS | `SHOPIFY_UK_ADMIN_TOKEN` is read only inside the serverless function (`api/requirement.js`), never included in any response payload or client-side script — verified by inspecting the response-building code |
| AIOS documents generated | ✅ PASS | This report plus 6 others across all 5 (+2) AIOS folders |

## Structural checks performed

- `node --check api/requirement.js` — syntax clean.
- `<div>` tag balance on `pages/sukirtha.html` before/after edit: 223/223 (perfectly balanced,
  no orphaned tags introduced).
- Confirmed no `r6*`-prefixed identifier collides with any pre-existing `r1`–`r5` identifier.
- Confirmed the new backend module (`sukirthaR6HandlerModule`) does not modify, remove, or
  interfere with any existing handler module in `api/requirement.js` — added as a new,
  self-contained closure, dispatched only via a new `?fn=sukirtha-r6` route.
- Confirmed no new Vercel serverless function file was created (merged into the existing
  `api/requirement.js`, same pattern as Requirements 2/3/5) — no risk to the Hobby-plan
  12-function cap.

## Known limitations

- Engagement metrics are BLOCKED (see field mapping doc) — this is a data-availability fact,
  not a defect, and the requirement's own stop condition explicitly anticipated this outcome.
- Live-data checks (customer count sanity, actual Shopify connectivity, refresh button
  behavior against production) cannot be completed until deployment is approved, per the
  explicit "Do not deploy to Vercel or push GitHub without written approval" instruction.
- "Subscribed Date" carries the caveat documented in the source map (consent-change date, not
  guaranteed original opt-in date).

## PASS / FAIL

**PASS** for everything checkable before deployment. Final sign-off requires deploying (with
approval) and re-running the PENDING rows above against the live site.
