---
task: Thasitha Requirement 1 — Campaign Performance & ROAS Action
date: 2026-07-10
team_member: Thasitha
---

## Title
Thasitha Requirement 1 — Campaign Performance & ROAS Action — Reusable Prompt

## Purpose
Reusable execution prompt for building/refreshing Thasitha's Req1 campaign-level ROAS action
report.

## Requirement source
GPT-authored execution brief, 2026-07-10, delivered via Kuberan — "THASITHA REQUIREMENT 1 —
EXECUTION" (full governance spec: campaign table, custom date range, ROAS formula, Action
boundaries, Tags/Active Days/Budget rules, AIOS documentation set).

## Team member
Thasitha (Owner) · Kuberan (Supporting AIOS staff)

## Team
Google Ads

## Store
ledsone.de

## Business question
Provide a campaign-level Google Ads performance table for Thasitha's campaigns, with a
user-selectable custom date range and a clear ROAS-based action classification (Poor /
Average / Good / Hero / Data Check Required).

## Prompt (verbatim scope used)
1. Verify the real page location before editing (brief assumed a `Staff-requirements\pages\`
   local folder that does not exist — corrected to the real path
   `reports/digital-marketing-member-pages/pages/thasitha.html`).
2. Search all AIOS folders for existing Thasitha assets (none found beyond the placeholder
   page — duplicate risk GREEN).
3. Inspect PostgreSQL read-only for: campaign ownership field, budget field, tags field,
   conversion value vs count distinction, currency/micros, campaign_performance grain.
4. Discover `google_ads.campaigns.group_name` as the explicit, real campaign-ownership field
   (values across the account: Jefri, Mahima, Thasi) — resolves the ownership-scope
   requirement without inventing a naming-parser rule.
5. Discover `google_ads.campaigns.feeds` as the best-available real Tags source (documented
   caveat: officially "merchant feed country codes" per schema docs, but observed values are
   feed/product-segment codes for this account).
6. Discover `google_ads.campaigns.budget` (decimal, daily budget in account currency) for
   Daily Budget.
7. Confirm `google_ads.campaign_performance.conversion_value` is monetary (EUR, account
   currency, not micros) and distinct from `conversions` (a count) — label as "Conversion
   Value", not "Conversions".
8. Confirm `campaign_performance` grain: one row per (date, campaign_id), UNIQUE constraint
   confirmed, no duplicate-row risk.
9. Pull full daily history (2026-04-20 to 2026-07-10, 157 rows, 2 campaigns) and embed
   client-side for the custom date-range picker (no live backend — static HTML with embedded
   pre-aggregated read-only PostgreSQL data, matching the existing project pattern already
   used for Mahima's reports).
10. Implement ROAS = Conversion Value / Cost × 100, with exact N/A handling for cost=0.
11. Implement Action classification with exact boundary rules.
12. Active Days = count of distinct dates with a `campaign_performance` row in the selected
    range (daily records exist and were used, not `End - Start + 1`).
13. Build/update `thasitha.html` in place (was a placeholder, no existing tabs to preserve).
14. Validate: SQL totals cross-check, boundary tests, zero-cost test, ROAS formula test,
    div-balance/HTML structural check, JS syntax check.
15. Save AIOS documentation set. Do not deploy or push without explicit approval.

## Files created or modified
- `reports/digital-marketing-member-pages/pages/thasitha.html` (placeholder replaced with
  Requirement 1 build)
- `reports/thasitha/data/2026-07-10_thasitha_before_req1_placeholder_backup.html` (pre-edit
  backup)
- `reports/thasitha/data/2026-07-10_thasitha_req1_builder.py`,
  `2026-07-10_thasitha_daily_data.json` (build scripts/data)

## Evidence location
`evidence/thasitha/requirement-1-discovery.md`,
`evidence/thasitha/requirement-1-postgresql-source-map.md`,
`evidence/thasitha/requirement-1-data-validation.md`

## Validation result
See `validation/thasitha/requirement-1-validation.md`

## Owner / Reviewer
Owner: Thasitha · Reviewer: Kuberan

## Status
Built locally, NOT deployed, NOT pushed to git — awaiting explicit approval per governance
rules in the execution brief.

## Known limits
- Tags sourced from `campaigns.feeds`, which is documented as "merchant feed country codes"
  but holds feed-segment codes for this account — flagged AMBER, not fabricated.
- Static HTML with embedded data (not a live query) — matches the existing project's approved
  data-loading pattern (no new backend built).
- Only 2 campaigns currently carry `group_name = 'Thasi'` — scope will need re-verification if
  Thasitha is assigned more campaigns later.

## Duplicate-truth risk
GREEN — no existing Thasitha requirement report existed before this build (placeholder only).

## Next step
Kuberan/Thasitha review → confirm Tags source acceptability → approve for deploy/push.

## PASS / FAIL rule
PASS (see validation doc for full test results).
