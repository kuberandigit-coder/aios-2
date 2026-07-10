---
task: Thasitha Requirement 1 — Campaign Performance & ROAS Action
date: 2026-07-10
team_member: Thasitha
---

## Title
Thasitha Requirement 1 — Campaign Performance & ROAS Action — Report Note

## Purpose
Point-of-record summary of the report output and where the live working file sits.

## Requirement source
GPT execution brief, 2026-07-10

## Team member / Team / Store
Thasitha / Google Ads / ledsone.de

## Business question
Which of Thasitha's campaigns are performing well by ROAS, and what action does each warrant,
for a user-selected date range?

## PostgreSQL sources checked
`google_ads.campaigns` (ownership via `group_name`, budget, tags via `feeds`),
`google_ads.campaign_performance` (daily cost/conversion_value/conversions, one row per
date×campaign), `google_ads.accounts` (currency/store confirmation). Read-only only.

## Files created or modified
Working file: `reports/digital-marketing-member-pages/pages/thasitha.html` (Requirement 1
built in place, replacing the placeholder).
Backup: `reports/thasitha/data/2026-07-10_thasitha_before_req1_placeholder_backup.html`
Build scripts/data: `reports/thasitha/data/2026-07-10_thasitha_req1_builder.py`,
`2026-07-10_thasitha_daily_data.json`

## Evidence location
`evidence/thasitha/requirement-1-discovery.md`
`evidence/thasitha/requirement-1-postgresql-source-map.md`
`evidence/thasitha/requirement-1-data-validation.md`

## Validation result
PASS — `validation/thasitha/requirement-1-validation.md`

## Owner / Reviewer
Owner: Thasitha · Reviewer: Kuberan

## Status
Built locally, pending review. NOT deployed. NOT pushed.

## Result summary (full range 2026-04-20 to 2026-07-10)
| Campaign | Campaign ID | Tags | Active Days | Daily Budget | Cost | Conv. Value | ROAS | Action |
|---|---|---|---|---|---|---|---|---|
| Pmax \| Thasi \| Shoptimised \| THT \| NewProduct \| MCV -20/04 | 23765634627 | THT | 82 | €5.00 | €267.29 | €535.03 | 200.17% | Average |
| Pmax \| Thasi \| Shoptimised \| MT \| Metal Product \| MCV -27/04 | 23791285134 | MT | 75 | €12.00 | €828.82 | €2,242.07 | 270.51% | Average |

**Totals**: 2 campaigns, €1,096.11 cost, €2,777.10 conversion value, overall ROAS 253.36%.

## Known limitations
See evidence/validation docs — Tags source caveat, browser test not live-verified this run,
both disclosed and non-fabricated.

## Next steps
Kuberan/Thasitha review → approve for push/deploy.

## PASS / FAIL result
**PASS**
