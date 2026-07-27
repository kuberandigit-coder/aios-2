# Capability Index

Index of `capability/*.md` files — reusable technical knowledge extracted from completed AIOS tasks. Each entry is a one-line pointer; full detail lives in the linked file. Grouped by date, newest first.

## 2026-07-24

- [`2026-07-24_indexeddb-live-data-persistence_capability.md`](2026-07-24_indexeddb-live-data-persistence_capability.md) — shared IndexedDB pattern so live-fetched data survives page navigation, rolled out to Kamsi/Dilaksi/Jefri/Mahima and all 14 sales-dashboard tabs.
- [`2026-07-24_kamsi-req1-access-scope-and-hang-fix_capability.md`](2026-07-24_kamsi-req1-access-scope-and-hang-fix_capability.md) — diagnosing Shopify GraphQL access-scope errors and guarding against unbounded full-catalog scan hangs.
- [`2026-07-24_hourly-snapshot-refresh-workflow_capability.md`](2026-07-24_hourly-snapshot-refresh-workflow_capability.md) — GitHub Actions hourly snapshot regeneration + Vercel redeploy pattern (status: built, then removed from working tree same day — unresolved).
- [`2026-07-24_jefri-req3-3period-product-comparison_capability.md`](2026-07-24_jefri-req3-3period-product-comparison_capability.md) — 3-calendar-quarter product comparison with percentile-based tiering and trend-status classification.
- [`2026-07-24_sajeepan-utm-term-deep-search-and-gap-audit_capability.md`](2026-07-24_sajeepan-utm-term-deep-search-and-gap-audit_capability.md) — utm_term deep-audit technique for recovering missed attribution, plus a general unclaimed-campaign gap audit.
- [`2026-07-24_sonya-snapshot-backfill_capability.md`](2026-07-24_sonya-snapshot-backfill_capability.md) — sequential, cooldown-based monthly snapshot backfill script pattern.
- [`2026-07-24_dm-google-ads-tab_capability.md`](2026-07-24_dm-google-ads-tab_capability.md) — templated same-day process for standing up a new staff Ads tab from a gap-audit finding.
- [`2026-07-24_kamsi-organic-sales-rule-prompt_capability.md`](2026-07-24_kamsi-organic-sales-rule-prompt_capability.md) — reusable written definition of the "organic sales" rule for ledsone.co.uk.

## 2026-07-27

- [`2026-07-27_meta-uk-tab-and-overlap-discovery_capability.md`](2026-07-27_meta-uk-tab-and-overlap-discovery_capability.md) — Meta UK tab, plus the order-name-set comparison technique that found 48% cross-tab order overlap on the main dashboard.
- [`2026-07-27_salesuk-standalone-order-level-page_capability.md`](2026-07-27_salesuk-standalone-order-level-page_capability.md) — building mutually-exclusive tab groups by construction (priority-ordered first-match-wins), order-level rows, and the page-size + static-snapshot combo needed to keep large monthly scans fast.
