# Capabilities — 2026-07-31

## Capability — Google Ads Missing-Conversion Investigation Workflow

**Date:** 2026-07-31
**Owner:** Thasitha (Google Ads, ledsone.de)
**Status:** Workflow proven once (order LSDE18503); root cause documented as a hypothesis, not
independently confirmed

### Capability

A repeatable 8-step investigation workflow for diagnosing why a real Shopify order has no matching
Purchase Conversion recorded in Google Ads.

### The workflow

1. Review the Shopify session associated with the order.
2. Review the customer journey (touchpoints leading to purchase).
3. Compare against the relevant Google Ads campaign.
4. Review the Purchase conversion action/record in Google Ads.
5. Review the Google & YouTube App integration.
6. Check for an Enhanced Conversion warning flagged on the account/conversion action.
7. If the checkout's email/phone hash data needed for Enhanced Conversions matching is missing,
   that's a likely root cause.
8. If unresolved, escalate to Google Ads support using the specific order as the reference case.

### Originating task

`evidence/thasitha/2026-07-31_google-ads-conversion-lsde18503-evidence.md`,
`handover/thasitha/2026-07-31_google-ads-conversion-lsde18503-handover.md`

### Known limitations

This was a manual/UI-level investigation (Shopify admin + Google Ads UI), not a code change or
automated check — no Postgres/API-level verification was performed. The root cause for the one
order it was applied to ("possible attribution failure") was never independently confirmed as the
actual cause; it remained a documented hypothesis. The handover itself flags a real risk worth
reusing this workflow for: if Enhanced Conversions matching is broken account-wide, other Purchase
conversions may also be under-reported, not just the one order checked.

### Reuse

Explicitly intended for any other reported missing-conversion order, not just LSDE18503 — the
handover's own "What's next" says to "apply the same investigation workflow to any other reported
missing-conversion orders."
