---
task: Mahima Requirement 1 — Full Rebuild (Product Performance Report)
date: 2026-07-10
team_member: Mahima
---

## Title
Mahima Requirement 1 — Full Rebuild — Handover

## Purpose
Point-of-record handover for Kuberan/Mahima review of the fully rebuilt Req1 (Tab 1).

## Requirement source
Kuberan, 2026-07-10 — full replacement + iterative follow-ups (date range restore, 7d/30d
ROAS, CSS/filters, real Missing Attribute data, join-bug fix, real Status data, Suggested
Action column).

## Business question
Product-level Google Ads performance for ledsone.de with honest handling of unavailable
fields, plus an actionable Suggested Action per Mahima's own formula.

## PostgreSQL sources checked
`google_ads.product_performance`, `google_ads.campaigns`, `google_ads.merchant_products`,
`google_ads.ad_group_products`, `google_ads.asset_group_listing_group_filters`,
`google_ads.asset_group_product_group_performance`, `raw_data.gmc_product_diagnostics_daily`
(confirmed absent). All read-only.

## Files created or modified
Live report: `reports/digital-marketing-member-pages/pages/mahima.html` (Tab 1 only; Tab 2/3
untouched — verified after every edit).
Supporting scripts/data: `reports/mahima/data/2026-07-10_mahima_req1_*`

## Evidence location
`evidence/mahima/2026-07-10_mahima_req1_rebuild_evidence.md`

## Validation result
PASS — `validation/mahima/2026-07-10_mahima_req1_rebuild_validation.md`

## Owner / Reviewer
Owner: Mahima · Reviewer: Kuberan

## Status
**Done and deployed to production.** Live at https://digital-marketing-member-pages.vercel.app/pages/mahima.html
as of 2026-07-10 (commit `7417e52`, deployment `dpl_6owYHkKZRfE6o5KL9BetrCriRPgX`). See
`vercel/mahima/2026-07-10_mahima_req1_production_deployment_evidence.md` for full deployment
record.

## Result summary
| Metric | Value |
|---|---|
| Total product rows | 6,938 (2026-01-01 to 2026-07-10, 5 campaigns) |
| Total cost / conv. value | €9,361.66 / €22,563.64 |
| Overall ROAS | 2.41x |
| Product title / Missing Attribute matched | 6,386 rows (92.0%) |
| Status matched (real, from ad_group_products) | 805 rows (11.6%), all "Eligible" |
| Suggested Action: Pause / Optimize / Scale / Maintain / Reduce / N/A | 1,191 / 5,191 / 5 / 0 / 2 / 549 |

## Known limitations
1. Status only covers 11.6% of rows (Shopping campaign only — PMax structurally excluded).
2. Missing Attribute ≠ Google's policy/disapproval codes — feed-completeness only.
3. 552 rows (8%) have no findable feed entry under any ID format.
4. Suggested Action inherits the same Status/Missing-Attribute/FeedStatus coverage limits —
   "Not Available in PostgreSQL" when FeedStatus can't be determined.
5. Real per-product eligibility (the "Not eligible / Product paused" the user's screenshots
   show) confirmed absent from PostgreSQL via exhaustive multi-method search — requires Google
   Merchant Center Content API integration, not a query fix.

## Next steps
Kuberan/Mahima review → confirm Suggested Action formula mapping (FeedStatus=availability) is
acceptable → approve for deploy.

## PASS / FAIL result
**PASS**
