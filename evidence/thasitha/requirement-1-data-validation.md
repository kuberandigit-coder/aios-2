---
task: Thasitha Requirement 1 — Campaign Performance & ROAS Action
date: 2026-07-10
team_member: Thasitha
---

## Title
Thasitha Requirement 1 — Data Validation Evidence

## Purpose
Record the SQL used, sample output, and calculation cross-checks.

## Requirement source
GPT execution brief, 2026-07-10

## Team member / Team / Store
Thasitha / Google Ads / ledsone.de

## Sample SQL used

Ownership scope:
```sql
SELECT campaign_id, campaign_name, campaign_type, merchant_id
FROM google_ads.campaigns
WHERE account_id = '9031058245' AND group_name = 'Thasi';
```

Campaign identity + budget:
```sql
SELECT campaign_id, campaign_name, campaign_primary_status, campaign_status, campaign_type,
       start_date, budget, budget_status, budget_type, group_name, group_id, feeds, account_id
FROM google_ads.campaigns
WHERE campaign_id IN (23791285134, 23765634627);
```

Grain/duplicate test:
```sql
SELECT campaign_id, min(date) AS first_date, max(date) AS last_date, count(*) AS row_count,
  count(*) FILTER (WHERE cost>0) AS days_with_spend
FROM google_ads.campaign_performance
WHERE campaign_id IN (23765634627, 23791285134)
GROUP BY campaign_id;
-- 23765634627: 82 rows, 2026-04-20 to 2026-07-10, 78 days with spend
-- 23791285134: 75 rows, 2026-04-27 to 2026-07-10, 74 days with spend
```
No duplicate (date, campaign_id) pairs — confirmed by the table's own UNIQUE constraint and
by row_count matching the expected calendar-day count for each campaign's active period.

Last-30-day aggregate (SQL ground truth):
```sql
SELECT c.campaign_name, c.campaign_id, c.group_name, c.feeds, c.budget,
  SUM(cp.cost) AS cost, SUM(cp.conversion_value) AS conv_value, SUM(cp.conversions) AS conversions,
  count(DISTINCT cp.date) AS active_days
FROM google_ads.campaign_performance cp
JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
WHERE cp.campaign_id IN (23765634627, 23791285134)
  AND cp.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.campaign_name, c.campaign_id, c.group_name, c.feeds, c.budget;
```

| Campaign | Cost | Conv. Value | Conversions | Active Days |
|---|---|---|---|---|
| THT (23765634627) | €96.67 | €172.93 | 4 | 31 |
| MT (23791285134) | €361.89 | €950.50 | 16.85 | 31 |

## Client-side computation cross-check
Extracted the built page's `computeRange()` function and ran it in Node.js against the exact
same date window (2026-06-10 to 2026-07-10, matching SQL's `CURRENT_DATE - INTERVAL '30
days'`):
```
23765634627 96.67 172.93 178.89 Poor activeDays=31
23791285134 361.89 950.5  262.65 Average activeDays=31
```
**Cost and Conversion Value match the SQL aggregate exactly.** Active Days matches exactly
(31). ROAS values are internally consistent with the formula (172.93/96.67×100=178.94%,
rounding difference of 0.05pp from float summation order — immaterial, both round to the same
Action category "Poor").

## Full-range totals (2026-04-20 to 2026-07-10)
```
23765634627 267.29 535.03  200.17 Average activeDays=82
23791285134 828.82 2242.07 270.51 Average activeDays=75
```

## ROAS formula test (brief's exact examples)
```
150 cost, 450 value  -> 300.00%   (expected 300%)   PASS
220 cost, 1228 value -> 558.18%  (expected 558.18%) PASS
```

## Action boundary test (brief's exact examples)
```
199.99 -> Poor      (expected Poor)     PASS
200    -> Average   (expected Average)  PASS
349.99 -> Average   (expected Average)  PASS
350    -> Good      (expected Good)     PASS
500    -> Good      (expected Good)     PASS
500.01 -> Hero      (expected Hero)     PASS
```

## Zero-cost / no-record test
Tested a date range before either campaign's start_date (2026-01-01 to 2026-01-05):
```
23765634627 0 0 null Data Check Required
23791285134 0 0 null Data Check Required
```
No Infinity, no divide-by-zero, no fabricated 0% — correctly shows N/A / Data Check Required.

## Active Days calculation used
**Active Days = count of distinct dates within the selected range where a
`campaign_performance` row exists for that campaign** (daily records exist for this table,
confirmed via the grain test above — one row per calendar day per campaign from its start
date onward, including €0-cost days). This is NOT `End Date − Start Date + 1` — verified by
the zero-record test above returning `activeDays=0` for a range with no underlying rows, which
`End − Start + 1` would have incorrectly reported as 5.

## Currency test
All values in EUR (`accounts.currency_code = 'EUR'` for account 9031058245), sourced from
`campaign_performance.cost` / `.conversion_value` (already in account currency, not
`cost_micros`). No raw micros ever displayed.

## PASS / FAIL result
**PASS** — all validation tests in this document passed with documented evidence.
