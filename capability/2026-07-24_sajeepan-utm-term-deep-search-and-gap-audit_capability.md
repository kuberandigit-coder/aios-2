# Capability — utm_term Deep-Search Fix + Paid-Search Unclaimed-Gap Audit

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Sajeepan Google Ads tab; also surfaced the new DM tab
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed

## Capability
Detect and recover orders silently excluded from a staff member's Google Ads attribution tab because the existing campaign-name whitelist doesn't cover every real `utm_term` value actually seen on paid-search orders — and, more generally, detect entire campaigns with real paid-search order volume that no staff rule currently claims.

## What Was Implemented
1. A deep audit of every real `utm_term` on January UK orders (not filtered to already-classified orders first) — found 4 recurring, user-confirmed terms, 2 of which belonged to campaigns not in Sajeepan's existing 11-campaign whitelist (144 orders / £4,731+£12 net sales recovered).
2. Layered a `utm_term` match on top of (not replacing) the existing campaign-name rule — `matchedOn: 'campaign' | 'utm_term'` recorded per row for auditability.
3. A "paid-search unclaimed-gap audit" added to the `uk-total-debug` endpoint: finds campaigns with real order volume that don't match *any* staff member's current rule. This audit's finding (`Shop_DM_PMax-46_AguAsset`/`Our_Hreo`, 856 Jan orders / £19,378.72) directly led to the same-day creation of the new DM tab.

## Technical Knowledge
- Attribution rules built purely from a known campaign-name whitelist will silently miss orders whose `utm_term` reflects a real campaign not yet in that list — auditing actual `utm_term` values against confirmed-owner terms (not just re-checking existing matches) is the way to find these gaps.
- ValueTrack placeholders (e.g. the literal string `"{keyword}"`) can appear unsubstituted in real recorded `utm_term` data and must be matched as a literal string, not treated as a templating error.
- A "which real campaigns have volume but no matching staff rule" audit is a generalizable technique — it already found one previously-unknown campaign in one afternoon.

## Important Rules / Logic
- Match = campaign-name rule OR utm_term rule (union, not replacement) — a previously-correct rule is never narrowed, only supplemented.
- Recurring per-month regeneration failures (June needed 8 attempts) are a known Shopify-timeout pattern for specific months, not a code bug — retry, don't "fix" the query.

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/scripts/bulk-sajeepan-refresh.js`

## Data Sources / Tools
Shopify Admin GraphQL API order data, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `e65fa5e`, `062cb2a`, `b2c115c` — not independently re-tested live in this sync.

## Reuse
The unclaimed-gap audit technique should be run periodically (or whenever a new staff member/campaign is suspected) rather than only reactively — it is what found the DM campaign.

## Evidence
`evidence/sales/2026-07-24_sajeepan-utm-term-fix-and-gap-audit.md`

## Limitations
The audit is only as good as the confirmed-owner mapping fed into it — a real campaign with no confirmed owner will surface as "unclaimed" but still needs a human decision on who owns it (as happened with "DM").
