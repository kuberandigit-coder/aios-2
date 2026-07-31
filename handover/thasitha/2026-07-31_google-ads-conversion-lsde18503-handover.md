# Thasitha Task 3 — Google Ads Conversion Investigation (Handover)

**Date:** 2026-07-31
**Team member / Team / Store:** Thasitha / Google Ads / ledsone.de

## What was done

Investigated why Shopify Order LSDE18503 has no matching Purchase Conversion in Google Ads: reviewed the Shopify session, customer journey, the relevant campaign, the Purchase conversion action, the Google & YouTube App integration, and an Enhanced Conversion warning. Documented a possible attribution failure and produced a reusable investigation workflow.

## What's next

- Get the exact text of the Enhanced Conversion warning and which conversion action it's attached to.
- Check whether the order's checkout captured email/phone hash data needed for Enhanced Conversions matching.
- If the gap persists, escalate to Google Ads support with order LSDE18503 as the reference case.
- Apply the same investigation workflow to any other reported missing-conversion orders.

## Where to find things

- Evidence: `evidence/thasitha/2026-07-31_google-ads-conversion-lsde18503-evidence.md`
- Validation: `validation/thasitha/2026-07-31_google-ads-conversion-lsde18503-validation.md`
- Report: `reports/thasitha/2026-07-31_google-ads-conversion-lsde18503-report.md`

## Risks / open questions

If Enhanced Conversions matching is broken account-wide (not just this order), other Purchase conversions may also be under-reported — worth a wider sample check, not just this one order.
