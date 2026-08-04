# Jefri Req2 — Campaign-Wise Breakdown + Filter (Handover)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## What was done

Requirement 2 (Search Terms Labels) now breaks results down by campaign: a Campaign filter
dropdown, a per-campaign summary card table, and a Campaign column on every row. Backend
query changed to `GROUP BY` including `campaign_id` instead of merging all 5 campaigns
together. Deployed to production and verified live.

## What's next

- Confirm with Jefri that per-campaign row splitting (a term in 2 campaigns = 2 rows) and
  per-campaign tag classification match what he meant by "campaign wise."
- No other follow-up — feature is complete and deployed.

## Where to find things

- Evidence: `evidence/jefri/2026-08-04_req2-campaign-wise-filter-evidence.md`
- Validation: `validation/jefri/2026-08-04_req2-campaign-wise-filter-validation.md`
- Report: `reports/jefri/2026-08-04_req2-campaign-wise-filter-report.md`
- Code: `reports/digital-marketing-member-pages/api/requirement.js`
  (`jefriSearchTermsHandlerModule`), `reports/digital-marketing-member-pages/pages/jefri.html`
  (Req2 tab)

## Risks / open questions

If a future change touches Req1's `JEFRI_CAMPAIGNS` list (e.g. a 6th campaign added), the
duplicated copy inside Req2's module (`jefriSearchTermsHandlerModule`) must be updated too
— they are two separate constants by design (module isolation), not shared.
