## Purpose
Document dm-dashboard commits for 2026-09-09, recovered from the `dm-dashboard` GitHub repo (`dev-work` branch).

## Certainty
VERIFIED (commit existence) / SUPPORTED (business intent, inferred from commit messages).

## Summary (16 commits)
- **Access control**: "dev" role reserved for Kuberan only, no longer assignable via Users page `722a418`.
- **Product Ownership (new Dev Tool)**: database-backed replacement for hardcoded per-staff product-ID lists `944d5d4`; Mahima's product IDs cut over to the database first, as a verified pilot of 6 planned migrations `e1108df`.
- **Task registry**: SKU Audit + DM Campaign registered so User Access Management can grant them `2778aa0`.
- **Jefri Non-Moving Products tab**: product image column + click-to-expand `21f792b`.
- **DM Campaign (new Admin-only page)**: added `9e54cd9`; scoped to ENABLED campaigns only `b1b6c62`; removed Performance Trend chart `8388864`; removed Real Revenue/Sales Gap columns `993cf39`; graph view + Product ID as link + All Time default + no emojis `344e11a`.
- **SKU Audit (new Admin-only page)**: added, E27 Base Bulb pilot vs live ledsone.co.uk spec sheet `dde4bd7`; multi-collection tabs + B22 Base Bulb `719d48a`; read-only Duplicate Listings report with real Shopify sales `9cf9eab`; fixed slow Spec Audit tab load (was sequential Shopify calls) `0b2c483`; upgraded to background ScheduledSnapshot (proper fix, not just parallelized-live) `df5c038`; added LED Bulbs, E14 Candle Bulbs, Dimmable/Non-Dimmable collections `ce1f666`.

## Files / Areas
New `product_ownership` DB-backed feature (dev tools), new `SKU Audit` and `DM Campaign` admin pages, Jefri Non-Moving tab.

## Status
VERIFIED (commit existence) / SUPPORTED (business intent). Retroactive documentation, no live-test evidence recovered.

## Evidence
`dev-work` branch commits `722a418`..`dde4bd7` dated 2026-09-09.

## Reviewer
Pending — Kuberan

## Next step
None required unless deeper per-feature evidence is wanted.
