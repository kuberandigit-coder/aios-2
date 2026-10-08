# Capability Index

Index of `capability/*.md` files — reusable technical knowledge extracted from completed AIOS tasks. Each entry is a one-line pointer; full detail lives in the linked file. Grouped by date, newest first.

## 2026-09-29

- [`2026-09-29_search-console-sitemap-indexing-monitor_capability.md`](2026-09-29_search-console-sitemap-indexing-monitor_capability.md) — read-only GSC Sitemaps API + URL Inspection indexing monitor, high-value-URL priority fallback, and daily-snapshot trend table pattern.

## 2026-09-22

- [`2026-09-22_ai-faq-schema-generation-pattern_capability.md`](2026-09-22_ai-faq-schema-generation-pattern_capability.md) — reusable FAQPage JSON-LD generation from real PAA questions via the local LLM, with deterministic safeguards against bare-JSON and hallucinated-answer failure modes.
- [`2026-09-22_anti-repeat-regenerate-pattern_capability.md`](2026-09-22_anti-repeat-regenerate-pattern_capability.md) — fix pattern for a "Regenerate" button on local-LLM content that returns identical output (temperature + regenerate-awareness in the prompt).

## 2026-09-18

- [`2026-09-18_ledsone-content-index-step01_capability.md`](2026-09-18_ledsone-content-index-step01_capability.md) — persisted Product/Collection content index (Internal Linking Suggestion Engine Step 01), the foundation later linking steps should read from.

## 2026-09-17

- [`2026-09-17_broken-link-404-monitor_capability.md`](2026-09-17_broken-link-404-monitor_capability.md) — licensed Screaming Frog SEO Spider CLI crawl pattern for broken-link/404 detection.
- [`2026-09-17_gsc-404-url-monitor_capability.md`](2026-09-17_gsc-404-url-monitor_capability.md) — bounded GSC-service-account check of known URLs for 404s using the existing credential.

## 2026-09-16

- [`2026-09-16_seo-metadata-audit-traffic-prioritization_capability.md`](2026-09-16_seo-metadata-audit-traffic-prioritization_capability.md) — prioritized SEO metadata rewrite backlog, ranked by real traffic data.

## 2026-08-24

- [`2026-08-24_sajeepan-lens-keywords-automation_capability.md`](2026-08-24_sajeepan-lens-keywords-automation_capability.md) — Google Lens visual search → human review → keyword/attribute/title derivation pipeline, on-demand or weekly-batch. New consumer (2026-10-07): Blog HTML Automation's keyword suggestions read its `google_lens_keyword_planner_suggestion` table.

## 2026-08-21

- [`2026-08-21_mahima-stpm_capability.md`](2026-08-21_mahima-stpm_capability.md) — immutable point-in-time snapshot pattern, unaffected by later data changes.

## 2026-08-20

- [`2026-08-20_thivajini-feed-optimization_capability.md`](2026-08-20_thivajini-feed-optimization_capability.md) — feed-optimization/export workflow tracked in Postgres as a run/cycle, replacing ad-hoc manual exports.

## 2026-07-29

- [`2026-07-29_salesuk-group-construction-and-dual-repo-deploy_capability.md`](2026-07-29_salesuk-group-construction-and-dual-repo-deploy_capability.md) — second/last-session lookthrough matching, permanent vs month-scoped rules, the Not Assigned virtual group, and the dual-repo (aios-2 + Staff-requirements) deploy hazard discovered and fixed this session.

## 2026-07-27

- [`2026-07-27_meta-uk-tab-and-overlap-discovery_capability.md`](2026-07-27_meta-uk-tab-and-overlap-discovery_capability.md) — Meta UK tab, plus the order-name-set comparison technique that found 48% cross-tab order overlap on the main dashboard.
- [`2026-07-27_salesuk-standalone-order-level-page_capability.md`](2026-07-27_salesuk-standalone-order-level-page_capability.md) — building mutually-exclusive tab groups by construction (priority-ordered first-match-wins), order-level rows, and the page-size + static-snapshot combo needed to keep large monthly scans fast.

## 2026-07-24

- [`2026-07-24_indexeddb-live-data-persistence_capability.md`](2026-07-24_indexeddb-live-data-persistence_capability.md) — shared IndexedDB pattern so live-fetched data survives page navigation, rolled out to Kamsi/Dilaksi/Jefri/Mahima and all 14 sales-dashboard tabs.
- [`2026-07-24_kamsi-req1-access-scope-and-hang-fix_capability.md`](2026-07-24_kamsi-req1-access-scope-and-hang-fix_capability.md) — diagnosing Shopify GraphQL access-scope errors and guarding against unbounded full-catalog scan hangs.
- [`2026-07-24_hourly-snapshot-refresh-workflow_capability.md`](2026-07-24_hourly-snapshot-refresh-workflow_capability.md) — GitHub Actions hourly snapshot regeneration + Vercel redeploy pattern (status: built, then removed from working tree same day — unresolved).
- [`2026-07-24_jefri-req3-3period-product-comparison_capability.md`](2026-07-24_jefri-req3-3period-product-comparison_capability.md) — 3-calendar-quarter product comparison with percentile-based tiering and trend-status classification.
- [`2026-07-24_sajeepan-utm-term-deep-search-and-gap-audit_capability.md`](2026-07-24_sajeepan-utm-term-deep-search-and-gap-audit_capability.md) — utm_term deep-audit technique for recovering missed attribution, plus a general unclaimed-campaign gap audit.
- [`2026-07-24_sonya-snapshot-backfill_capability.md`](2026-07-24_sonya-snapshot-backfill_capability.md) — sequential, cooldown-based monthly snapshot backfill script pattern.
- [`2026-07-24_dm-google-ads-tab_capability.md`](2026-07-24_dm-google-ads-tab_capability.md) — templated same-day process for standing up a new staff Ads tab from a gap-audit finding. New consumer (2026-10-07): Blog HTML Automation's keyword suggestions read its `google_ads` schema.
- [`2026-07-24_kamsi-organic-sales-rule-prompt_capability.md`](2026-07-24_kamsi-organic-sales-rule-prompt_capability.md) — reusable written definition of the "organic sales" rule for ledsone.co.uk.

## 2026-07-22

- [`2026-07-22_vercel-serverless-function-consolidation-pattern_capability.md`](2026-07-22_vercel-serverless-function-consolidation-pattern_capability.md) — merging many API handler files into a small fixed number of base files with query-param (`?fn=`/`?entity=`) dispatch, to stay under Vercel Hobby's 12-serverless-function cap. Confirmed reused across 35+ later task records (jefri, mahima, dilaksi, Kamsi, thasitha, sukirtha, salesuk).

---

## Coverage notes

This index and the files it points to were brought up to date on 2026-10-08 via a full historical
AIOS capability backfill (earliest record found: 2026-06-09; latest reviewed: 2026-10-07/08). See
`capability/2026-10-08_capability-coverage-report.md` for the full methodology, what was checked,
and what was intentionally left out.
