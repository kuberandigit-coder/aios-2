# Capability — New "DM" Google Ads Tab (Shop_DM_PMax-46_AguAsset / Our_Hreo)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** New tab, staff name not yet confirmed against a real person (see Limitations)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (Jan-Jun backfilled, July live)

## Capability
Stand up a brand-new Google Ads staff attribution tab from a campaign identified as "unclaimed" by the paid-search gap audit, in the same afternoon it was discovered, using the established Sonya/Sajeepan/Theekshy tab template.

## What Was Implemented
New tab on `sales.html` for campaign `Shop_DM_PMax-46_AguAsset`/`Our_Hreo`, matching the existing tab pattern exactly: same backend dispatch shape in `api/sales.js`, same frontend structure, `dm`-prefixed globals. Jan/Feb/Mar-Jun snapshots generated same day; July live by design.

## Technical Knowledge
- Adding a new staff tab is now a templated, same-day operation: identify campaign → add backend handler block with campaign/term match → add frontend tab mirroring an existing one → backfill historical months via a bulk-refresh script → verify live for the current month.

## Important Rules / Logic
- Historical months get static snapshots (fast, no live Shopify scan); the current/live month is always fetched fresh — this convention is uniform across all Ads staff tabs (Sajeepan, Theekshy, Sonya, DM).

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `reports/digital-marketing-member-pages/api/data/dm-uk-ads-sales-2026-0{1-6}.json`

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `ca1ba6a`, `e3d2ef5`, `e507636`, `c812ee1` — not independently re-tested live in this sync.

## Reuse
Template for any future newly-discovered unclaimed campaign found via the gap-audit capability.

## Evidence
`evidence/digital-marketing-member-pages/2026-07-24_dm-google-ads-tab-and-backfill.md`

## Limitations
"DM" is used as a placeholder/short label matching the campaign name (`Shop_DM_PMax-46`) — not confirmed to be a real staff member's name or initials. Manual verification required before treating this as a permanent staff identity in the dashboard.
