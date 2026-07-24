# Capability — Sonya Google Ads Tab Monthly Snapshot Backfill (Jan-Jul)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Sonya Google Ads tab
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (snapshots); bulk-refresh script uncommitted

## Capability
Regenerate a full Jan-Jul static-snapshot set for a staff member's Google Ads tab sequentially, with cooldowns, tolerating intermittent Shopify timeouts on individual months without blocking the whole batch.

## What Was Implemented
Refreshed Sonya's Jan, Feb-May, June, and July (live) snapshots across four separate commits the same afternoon. A new `bulk-sonya-refresh.js` script (mirroring the proven `bulk-sajeepan-refresh.js`) automates re-running all 7 months with per-month cooldowns and a 290s curl timeout per attempt.

## Technical Knowledge
- Certain months (June, for both Sajeepan and by pattern likely any staff member) are prone to repeated Shopify timeouts independent of code correctness — a strictly sequential retry-with-cooldown script (not concurrent) is the established fix, already proven on Sajeepan the same day.

## Important Rules / Logic
- Snapshot regeneration always targets the deployed API with `?refresh=1` — never bypasses the live attribution logic, only forces a fresh computation instead of serving the cached static file.

## Files / Components
- `reports/digital-marketing-member-pages/api/data/sonya-uk-ads-sales-2026-0{1-7}.json`
- `reports/digital-marketing-member-pages/scripts/bulk-sonya-refresh.js` (new, uncommitted as of this sync)

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `855a190`, `2802162`, `beeaf24`, `533711d` — not independently re-tested live in this sync.

## Reuse
`bulk-sonya-refresh.js` is directly reusable as a template for any future staff tab needing a full-year backfill.

## Evidence
`evidence/sonya/2026-07-24_sonya-monthly-snapshot-backfill.md`

## Limitations
`bulk-sonya-refresh.js` itself was not committed as of this sync — confirm with user before assuming it is part of the shipped codebase.
