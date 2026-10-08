# Capability Index

One file per day that produced a reusable capability — covering the full AIOS history from the
first capability-worthy task found (2026-06-17) through the latest (2026-09-30). Cross-reference
each day's task record(s) in `evidence/`, `validation/`, `handover/`, `closure/`, `source-map/`
for the full task context; these files hold the reusable-capability extract only.

- [`2026-06-17_capability.md`](2026-06-17_capability.md) — Shopify→Google Sheets UTM/Product attribution extension pattern (reuse existing functions, dynamic ID loading, minimal additive GraphQL field, dual ID-type matching).
- [`2026-07-03_capability.md`](2026-07-03_capability.md) — Vercel/GitHub deploy authorization root cause + the standard deploy path (digitalmarketing author) still in use today; safe git-subtree subfolder extraction; two-writer post-rewrite recovery.
- [`2026-07-06_capability.md`](2026-07-06_capability.md) — Shopify Bulk Operations as source-of-truth for catalog-wide metrics (units sold, stock, last order date).
- [`2026-07-13_capability.md`](2026-07-13_capability.md) — Scheduled-trigger live data refresh for Vercel static pages (distinct from the later `ScheduledSnapshot` pattern — different architecture, same problem).
- [`2026-07-22_capability.md`](2026-07-22_capability.md) — Vercel serverless function consolidation pattern (`?fn=`/`?entity=` dispatch under the 12-function cap).
- [`2026-07-23_capability.md`](2026-07-23_capability.md) — 3 capabilities: incremental delta-fetch "Check New Orders" refresh pattern (rolled out to 14 tabs), durable snapshot + refresh-button semantics, CDN-cache-busting for refresh endpoints.
- [`2026-07-24_capability.md`](2026-07-24_capability.md) — 8 capabilities: IndexedDB live-data persistence, Kamsi Req1 access-scope/hang fix, hourly snapshot refresh workflow, Jefri Req3 3-period product comparison, Sajeepan utm_term deep-audit + gap audit, Sonya snapshot backfill, DM Google Ads tab, Kamsi organic-sales rule definition.
- [`2026-07-27_capability.md`](2026-07-27_capability.md) — Meta UK tab + overlap discovery; SalesUK standalone order-level page.
- [`2026-07-29_capability.md`](2026-07-29_capability.md) — SalesUK group construction + dual-repo deploy pattern.
- [`2026-07-31_capability.md`](2026-07-31_capability.md) — Google Ads missing-conversion investigation workflow (Thasitha).
- [`2026-08-04_capability.md`](2026-08-04_capability.md) — Shopify-product-ID-from-campaign-item-ID cost attribution pattern.
- [`2026-08-07_capability.md`](2026-08-07_capability.md) — Cost Dashboard: confirmed-source-only cost attribution (VAT, Transaction Fee, Product Cost rule; N/A instead of guessing).
- [`2026-08-10_capability.md`](2026-08-10_capability.md) — Target Achievement / YoY Growth metric definition (Net-based, not raw Sales).
- [`2026-08-11_capability.md`](2026-08-11_capability.md) — Auth-guard auto-insertion regex gap (security gotcha — a real unauthenticated-access bug found and fixed).
- [`2026-08-13_capability.md`](2026-08-13_capability.md) — Dual-repo sync-drift detector script.
- [`2026-08-14_capability.md`](2026-08-14_capability.md) — Live-deploy-vs-repo mismatch detector (bidirectional — catches live site stale AND live site ahead of git).
- [`2026-08-19_capability.md`](2026-08-19_capability.md) — In-process batch aggregation pattern (avoiding N real HTTP round-trips).
- [`2026-08-20_capability.md`](2026-08-20_capability.md) — Thivajini feed-optimization run/cycle workflow.
- [`2026-08-21_capability.md`](2026-08-21_capability.md) — Mahima STPM immutable snapshot pattern.
- [`2026-08-24_capability.md`](2026-08-24_capability.md) — Sajeepan Lens Keywords Automation (Google Lens → review → keyword derivation pipeline).
- [`2026-08-26_capability.md`](2026-08-26_capability.md) — Sync Monitor admin page (origin) — the visible counterpart to ScheduledSnapshot.
- [`2026-08-27_capability.md`](2026-08-27_capability.md) — Live-vs-historical Postgres caching split (separate tables by data lifetime).
- [`2026-08-29_capability.md`](2026-08-29_capability.md) — **ScheduledSnapshot pattern (origin)** — foundational caching model reused by nearly every slow dm-dashboard page since; updated with a 2026-08-31 connection-limit resilience fix.
- [`2026-08-31_capability.md`](2026-08-31_capability.md) — 2 capabilities: Gemini AI Assistant (grounded task suggestions + conversational chat), verbatim static-page port + dead-dependency repair pattern (EOD Reports).
- [`2026-09-03_capability.md`](2026-09-03_capability.md) — Git branching workflow + "Dev Tools" merge UI (origin) — the standing merge mechanism for this whole project since.
- [`2026-09-04_capability.md`](2026-09-04_capability.md) — Self-service "Create User" for the Dev role; root-cause CSS debugging checklist.
- [`2026-09-07_capability.md`](2026-09-07_capability.md) — 3 capabilities: API Health Monitor pattern (later removed), Deploy-button build-then-revert decision, closed-month cache-gap bug class.
- [`2026-09-09_capability.md`](2026-09-09_capability.md) — Product Ownership: database-backed migration from hardcoded lists (pilot).
- [`2026-09-10_capability.md`](2026-09-10_capability.md) — Competitor price/listing analysis pattern (E27 Competitor Analysis + Lens Search).
- [`2026-09-11_capability.md`](2026-09-11_capability.md) — Content Gap Analysis pattern (competitor search engine); Product Ownership rollout completed (all 6 staff).
- [`2026-09-14_capability.md`](2026-09-14_capability.md) — AI/GEO Visibility Gap Analysis pattern (multi-key quota-rotating AI Overview detection).
- [`2026-09-15_capability.md`](2026-09-15_capability.md) — 2 capabilities: rate-limited/audited Shopify write pattern (Alt Text Keyword Finder), Dev Task Log.
- [`2026-09-16_capability.md`](2026-09-16_capability.md) — SEO metadata audit + traffic-based prioritization.
- [`2026-09-17_capability.md`](2026-09-17_capability.md) — 2 capabilities: broken-link/404 monitor (Screaming Frog CLI), GSC 404 URL monitor.
- [`2026-09-18_capability.md`](2026-09-18_capability.md) — LEDSone content index (Internal Linking Step 01).
- [`2026-09-19_capability.md`](2026-09-19_capability.md) — Internal Linking Suggestion Engine, Steps 02-05 + Blog HTML Editor (complete pipeline, extends Step 01).
- [`2026-09-21_capability.md`](2026-09-21_capability.md) — Collection Page Thin-Content Detector, Level 1 (audit → priority → backlog, "NOT CONFIGURED" convention).
- [`2026-09-22_capability.md`](2026-09-22_capability.md) — 2 capabilities: AI FAQ schema (JSON-LD) generation pattern, anti-repeat "Regenerate" pattern for local-LLM content.
- [`2026-09-24_capability.md`](2026-09-24_capability.md) — French Keyword Research & Page Mapping pipeline (Task 13).
- [`2026-09-25_capability.md`](2026-09-25_capability.md) — Structured Data Validation pipeline (Task 15).
- [`2026-09-29_capability.md`](2026-09-29_capability.md) — Search Console sitemap & indexing monitor (Hetheesha Task 16).
- [`2026-09-30_capability.md`](2026-09-30_capability.md) — DC Voltage "model" collection/product template pattern (reusable for future B22/E14 pages; confirmed still in active use 2026-10-08).
- [`2026-10-01_capability.md`](2026-10-01_capability.md) — Search Intent → Page Action pipeline (deterministic, no-AI classification); dict-row vs tuple-row gotcha.
- [`2026-10-02_capability.md`](2026-10-02_capability.md) — Blog Optimization multi-system reuse workflow; sidebar registration 3-way-duplication dedup.
- [`2026-10-05_capability.md`](2026-10-05_capability.md) — Post-restructuring leftover-import sweep (critical refactor-safety lesson); multi-method completeness verification discipline.
- [`2026-10-06_capability.md`](2026-10-06_capability.md) — Live-API-vs-external-DB verification discipline; mixed int/float JSON bulk-upsert bug class; sidebar-visibility gotcha; common-prefix/suffix HTML diffing.
- [`2026-10-07_capability.md`](2026-10-07_capability.md) — Visual block editor (click-to-edit rendered HTML); parallelized AI section generation.
- [`2026-10-08_capability.md`](2026-10-08_capability.md) — Liquid `article.handle` blog-prefix gotcha; confirm a "duplicate theme" is actually a duplicate before pushing to it; single-source-of-truth product-ownership fix (Mahima Req5b); fixes don't automatically cross codebases (Jefri hardcoded-campaign-list bug).

See `2026-10-08_capability-coverage-report.md` for the full audit methodology, what was/wasn't
individually re-verified, and flagged gaps — note its file-path references predate this day-by-day
regrouping; content is unchanged, just regrouped by date into the files above.
