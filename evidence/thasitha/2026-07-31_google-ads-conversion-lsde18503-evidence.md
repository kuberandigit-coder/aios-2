# Thasitha Task 3 — Google Ads Conversion Investigation (Order LSDE18503)

**Date:** 2026-07-31
**Team member / Team / Store:** Thasitha / Google Ads / ledsone.de

## Purpose

Investigate why Shopify Order LSDE18503 has no matching Purchase Conversion recorded in Google Ads.

## Requirement source

User-provided task summary, 2026-07-31.

## Business question

Why is a real Shopify order (LSDE18503) not showing as a Purchase Conversion in Google Ads — is this an attribution failure?

## Work completed

- Reviewed the Shopify session associated with the order.
- Reviewed the customer journey (touchpoints leading to purchase).
- Compared against the relevant Google Ads campaign.
- Reviewed the Purchase conversion action/record in Google Ads.
- Reviewed the Google & YouTube App integration.
- Investigated an Enhanced Conversion warning flagged on the account/conversion action.
- Documented a possible attribution failure as the likely cause.
- Produced a repeatable investigation workflow for future missing-conversion cases.

## Files created or modified

None specified in the source summary — this was a manual/UI-level investigation (Shopify admin + Google Ads UI), not a code change.

## PostgreSQL source checked

Not specified in the source summary. If order-level attribution data is stored in Postgres (e.g. `google_ads.*` schema used elsewhere in this project — see `evidence/thasitha/requirement-1-postgresql-source-map.md`), that should be cross-checked in the follow-up.

## Evidence

Task summary supplied directly by the requester describing the 8 investigation steps above as completed for order LSDE18503.

## Validation

See `validation/thasitha/2026-07-31_google-ads-conversion-lsde18503-validation.md`.

## Known limitations

- The exact nature of the "Enhanced Conversion warning" (what it said, which conversion action it applies to) was not specified.
- "Possible attribution failure" is the documented hypothesis, not a confirmed root cause — no Google Ads support ticket or definitive log was referenced.
- No specific order value, date, or campaign name was included in the source summary beyond the order ID.

## Next step

Confirm the exact Enhanced Conversion warning text and conversion action; check whether the order's checkout captured the required matching data (email/phone hash) for Enhanced Conversions to fire; escalate to Google Ads support if the gap persists after that check.

## PASS / FAIL

PASS — investigation completed as scoped; root-cause confirmation remains outstanding (documented as a possible, not confirmed, attribution failure).
