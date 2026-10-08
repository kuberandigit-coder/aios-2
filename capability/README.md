# Capability Index

One file per day that produced a reusable capability — covering the full AIOS history from the
first capability-worthy task found (2026-06-17) through the latest (2026-09-30). Cross-reference
each day's task record(s) in `evidence/`, `validation/`, `handover/`, `closure/`, `source-map/`
for the full task context; these files hold the reusable-capability extract only.

- [`2026-06-17_capability.md`](2026-06-17_capability.md) — Shopify→Google Sheets UTM/Product attribution extension pattern (reuse existing functions, dynamic ID loading, minimal additive GraphQL field, dual ID-type matching).
- [`2026-07-22_capability.md`](2026-07-22_capability.md) — Vercel serverless function consolidation pattern (`?fn=`/`?entity=` dispatch under the 12-function cap).
- [`2026-07-24_capability.md`](2026-07-24_capability.md) — 8 capabilities: IndexedDB live-data persistence, Kamsi Req1 access-scope/hang fix, hourly snapshot refresh workflow, Jefri Req3 3-period product comparison, Sajeepan utm_term deep-audit + gap audit, Sonya snapshot backfill, DM Google Ads tab, Kamsi organic-sales rule definition.
- [`2026-07-27_capability.md`](2026-07-27_capability.md) — Meta UK tab + overlap discovery; SalesUK standalone order-level page.
- [`2026-07-29_capability.md`](2026-07-29_capability.md) — SalesUK group construction + dual-repo deploy pattern.
- [`2026-07-31_capability.md`](2026-07-31_capability.md) — Google Ads missing-conversion investigation workflow (Thasitha).
- [`2026-08-04_capability.md`](2026-08-04_capability.md) — Shopify-product-ID-from-campaign-item-ID cost attribution pattern.
- [`2026-08-13_capability.md`](2026-08-13_capability.md) — Dual-repo sync-drift detector script.
- [`2026-08-19_capability.md`](2026-08-19_capability.md) — In-process batch aggregation pattern (avoiding N real HTTP round-trips).
- [`2026-08-20_capability.md`](2026-08-20_capability.md) — Thivajini feed-optimization run/cycle workflow.
- [`2026-08-21_capability.md`](2026-08-21_capability.md) — Mahima STPM immutable snapshot pattern.
- [`2026-08-24_capability.md`](2026-08-24_capability.md) — Sajeepan Lens Keywords Automation (Google Lens → review → keyword derivation pipeline).
- [`2026-08-29_capability.md`](2026-08-29_capability.md) — **ScheduledSnapshot pattern (origin)** — foundational caching model reused by nearly every slow dm-dashboard page since.
- [`2026-09-16_capability.md`](2026-09-16_capability.md) — SEO metadata audit + traffic-based prioritization.
- [`2026-09-17_capability.md`](2026-09-17_capability.md) — 2 capabilities: broken-link/404 monitor (Screaming Frog CLI), GSC 404 URL monitor.
- [`2026-09-18_capability.md`](2026-09-18_capability.md) — LEDSone content index (Internal Linking Step 01).
- [`2026-09-22_capability.md`](2026-09-22_capability.md) — 2 capabilities: AI FAQ schema (JSON-LD) generation pattern, anti-repeat "Regenerate" pattern for local-LLM content.
- [`2026-09-29_capability.md`](2026-09-29_capability.md) — Search Console sitemap & indexing monitor (Hetheesha Task 16).
- [`2026-09-30_capability.md`](2026-09-30_capability.md) — DC Voltage "model" collection/product template pattern (reusable for future B22/E14 pages; confirmed still in active use 2026-10-08).

See `2026-10-08_capability-coverage-report.md` for the full audit methodology, what was/wasn't
individually re-verified, and flagged gaps — note its file-path references predate this day-by-day
regrouping; content is unchanged, just regrouped by date into the files above.
