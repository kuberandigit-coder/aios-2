---
task: Mahima Requirement 3 — Search Terms Report (Keep / Cut / Scale)
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 3 — Search Terms Report — Validation

## Purpose
Confirm the built report meets Mahima's Requirement 3 spec: correct source, correct formulas,
correct field coverage, no production changes.

## Requirement source
Mahima Requirement 3 (Google Ads department)

## Business question
Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query
intent, and wasted spend, for ledsone.de?

## PostgreSQL sources checked
`google_ads.campaign_search_term_data`, `google_ads.campaign_search_term_insights`,
`google_ads.campaigns`, `google_ads.accounts`, `google_ads.keywords` — all read-only SELECT,
no writes.

## Validation checklist

| Check | Result |
|---|---|
| Existing Req 3 / Search Terms Report searched for before building | PASS — none found |
| PostgreSQL searched across all schemas, not fixed names | PASS — searched `%search_term%`, `%query%`, `%negative%`, plus full `google_ads` table list |
| Correct ledsone.de account identified | PASS — `account_id=9031058245`, confirmed via `google_ads.accounts.account_name='ledsone.de'` |
| Date range = last 30 days | PASS — `WHERE date >= CURRENT_DATE - INTERVAL '30 days'`, run 2026-07-09 |
| All 22 required fields present in table | PASS — Search Term, Campaign, Match Type, Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, Conv. Rate, Conv. Value, ROAS, Cost/Conv, Query Intent, Existing Negative KW, 7-Day ROAS, 30-Day ROAS, Trend, Priority, Recommended Action |
| CTR = clicks/impressions | PASS |
| Avg CPC = cost/clicks | PASS (N/A when cost is null — PMax) |
| Conv. Rate = conversions/clicks | PASS |
| ROAS = conv_value/cost | PASS (0 when cost=0 or null, not fabricated) |
| Cost/Conv = cost/conversions | PASS (N/A when conversions=0 or cost null) |
| Division-by-zero handled safely | PASS — N/A or 0 shown, never NaN/blank/fabricated. Spot-checked generated HTML: `grep -c "NaN\|undefined"` = 0 |
| Recommended Action formula exact match to spec | PASS — see evidence doc section 7 |
| Query Intent classifier documented | PASS — 5-tier rule-based classifier documented in report Notes section and evidence doc |
| Trend rule (7d vs 30d ROAS) implemented exactly | PASS |
| Priority rule documented and applied | PASS — documented in report legend |
| Summary cards present (6 required) | PASS — Total Search Terms, Total Cost, Total Conv. Value, Overall ROAS, Keep Count, Exclude Count |
| Filters present (Campaign, Action, Intent, Priority, Search box) | PASS |
| Color coding (Keep=green, Exclude=red/pink, Priority High/Medium/Low) | PASS — `.row-keep`/`.row-exclude` row tinting, `.b-keep`/`.b-exclude` badges, `.p-high`/`.p-medium`/`.p-low` priority classes |
| Notes section (source, date range, rules, limitations) | PASS — `.sources` and `.limits` blocks in report |
| No PostgreSQL writes | PASS — SELECT-only queries used throughout |
| No Google Ads changes (bids, negative keywords) | PASS — analysis only, nothing pushed to Google Ads |
| No duplicate report created | PASS — new standalone file, Req 1 and Req 2 assets untouched |
| No unrelated staff pages modified | PASS — only `reports/mahima/` and AIOS doc folders touched |

## Numeric spot-check
Row: `ledsone` (own-brand term), Shopping | Jeff | Shoptimised campaign —
cost=€8.99, conversions=0.98, conv_value=€41.88.
- ROAS manual calc: 41.88 / 8.99 = 4.6585... → report shows 4.66x ✓
- Cost/Conv manual calc: 8.99 / 0.98 = 9.1734... → report shows 9.17 ✓

Summary totals cross-check (from `req3_rows.json`):
- total_terms = 1,768; total_cost = €525.14; total_conv_value = €1,292.94;
  overall_roas = 1292.94/525.14 = 2.4622 → report shows 2.46x ✓
- keep_count = 54; exclude_count = 1,714; 54+1,714 = 1,768 = total_terms ✓

## Known limitations (carried into report Notes)
1. 544 of 1,768 rows are Performance Max search terms with no cost/CPC data (Google Ads API
   restriction, not a pipeline gap).
2. Query Intent is a rule-based classifier, not Google's own semantic tagging — first-pass
   triage only.
3. Report scoped to terms with ≥1 click in 30 days (1,768 of 21,282 total distinct terms).
4. No negative keyword lists exist yet on this account (0 of 128 keywords negative) — "Existing
   Negative KW" is "No" for every row by fact, not assumption.

## PASS / FAIL result
**PASS**
