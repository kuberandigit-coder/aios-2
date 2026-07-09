---
task: Mahima Requirement 3 — Search Terms Report (Keep / Cut / Scale)
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 3 — Search Terms Report — Evidence

## Purpose
Full evidence trail: existing-asset search, PostgreSQL schema inspection, source table
selection, sample SQL/output, calculation validation, Recommended Action rule validation,
duplicate-risk check.

## Requirement source
Mahima Requirement 3 (Google Ads department)

## Business question
Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query
intent, and wasted spend, for ledsone.de?

## 1. Existing assets searched (duplicate risk check)
Searched `reports/`, `prompts/`, `evidence/`, `validation/`, `handover/` for "search term" and
"mahima":
- `grep -ril "search term" reports/ prompts/ evidence/ validation/ handover/` → no matches
  related to a Google Ads search terms report (only unrelated Kamsi bulk-product JSON files).
- `grep -ril "mahima"` → found Req 1 (Product Performance) and Req 2 (Stock Management) assets
  only. No existing Req 3 / Search Terms Report.
- **Result: no duplicate found. Safe to build.**

## 2. PostgreSQL schemas/tables/views inspected (read-only)
Searched via `search_objects` (all schemas, not fixed to one):
- Pattern `%search_term%` → `google_ads.campaign_search_term_data`,
  `google_ads.campaign_search_term_insights`
- Pattern `%query%` → `google_search_console.query`, `google_search_console.query_page`
  (Search Console, not Ads — not relevant to this requirement)
- Pattern `%negative%` → `google_ads.keywords.is_negative`
- Listed all tables in `google_ads` schema (20 tables) to confirm no other search-term source
  exists (e.g. `keyword_performance` is keyword-level, not search-term-level).

## 3. Final source table/view chosen
- **Primary**: `google_ads.campaign_search_term_data` — daily search_term × campaign ×
  ad_group × match_type rows (impressions, clicks, conversions, conversions_value, cost,
  insight_id).
- **Category context**: `google_ads.campaign_search_term_insights` (joined on insight_id +
  campaign_id) for PMax category labels.
- **Account scope**: `google_ads.campaigns` joined to `google_ads.accounts` — confirmed
  `account_id = 9031058245` = `ledsone.de` (currency EUR, market_place DE, sub_source_id 108).
- **Negative keyword check**: `google_ads.keywords` (`is_negative = true`) — 0 rows found for
  account 9031058245 (128 total keywords, all positive/none negative).

## 4. Sample SQL used

Account confirmation:
```sql
SELECT * FROM google_ads.accounts WHERE account_id = '9031058245';
-- id=13, account_name='ledsone.de', currency_code='EUR', market_place='DE', sub_source_id=108
```

Row-count discovery (30-day window):
```sql
SELECT count(*) AS rows_30d, count(DISTINCT std.search_term) AS distinct_terms
FROM google_ads.campaign_search_term_data std
JOIN google_ads.campaigns c ON c.campaign_id = std.campaign_id
WHERE c.account_id = '9031058245'
  AND std.date >= CURRENT_DATE - INTERVAL '30 days';
-- rows_30d=74,842, distinct_terms=21,282
```

Main 30-day extraction (aggregated, clicks > 0 only, joined to insight category):
```sql
WITH d30 AS (
  SELECT std.search_term, c.campaign_id, c.campaign_name, std.match_type,
         SUM(std.impressions) AS impressions,
         SUM(std.clicks) AS clicks,
         SUM(std.cost) AS cost,
         SUM(std.conversions) AS conversions,
         SUM(std.conversions_value) AS conversions_value,
         (array_agg(std.insight_id ORDER BY std.date DESC))[1] AS insight_id
  FROM google_ads.campaign_search_term_data std
  JOIN google_ads.campaigns c ON c.campaign_id = std.campaign_id
  WHERE c.account_id = '9031058245'
    AND std.date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY std.search_term, c.campaign_id, c.campaign_name, std.match_type
  HAVING SUM(std.clicks) > 0
)
SELECT d30.*, csti.category_label
FROM d30
LEFT JOIN google_ads.campaign_search_term_insights csti
  ON csti.insight_id = d30.insight_id AND csti.campaign_id = d30.campaign_id
ORDER BY d30.cost DESC;
-- 1,768 rows returned
```

7-day window (for Trend / 7-Day ROAS):
```sql
SELECT std.search_term, c.campaign_id, std.match_type,
       SUM(std.cost) AS cost_7d,
       SUM(std.conversions_value) AS conv_value_7d,
       SUM(std.conversions) AS conversions_7d,
       SUM(std.clicks) AS clicks_7d
FROM google_ads.campaign_search_term_data std
JOIN google_ads.campaigns c ON c.campaign_id = std.campaign_id
WHERE c.account_id = '9031058245'
  AND std.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY std.search_term, c.campaign_id, std.match_type;
```

Negative keyword check:
```sql
SELECT count(*) FROM google_ads.keywords WHERE account_id='9031058245' AND is_negative=true;
-- 0
SELECT count(*) FROM google_ads.keywords WHERE account_id='9031058245';
-- 128
```

## 5. Sample output rows
Top-cost "Keep" rows (from computed dataset, `reports/mahima/data/2026-07-09_mahima_req3_search_terms_raw.json`):

| Search Term | Campaign | Cost | Conversions | Conv. Value | ROAS | Query Intent | Priority |
|---|---|---|---|---|---|---|---|
| ledsone | Shopping \| Jeff \| Shoptimised... | €8.99 | 0.98 | €41.88 | 4.66x | Generic - high | High |
| lampenschirm hängelampe | Shopping \| Jeff \| Shoptimised... | €6.76 | 1.0 | €19.02 | 2.81x | Generic - high | High |
| lampenfassung mit kabel | Shopping \| Jeff \| Shoptimised... | €5.12 | 1.0 | €35.95 | 7.02x | Generic - high | High |

Sample Exclude — competitor brand rows:
- `lampenschirm ikea`, `ikea lampenschirm`, `lampenschirm bauhaus stil`, `toom lampenfassung`,
  `obi lampenschirm` → all correctly flagged Competitor brand → Exclude.

Sample Exclude — Non-DE/mixed language rows (post-fix, 6 total):
- `old wall lights`, `lamp shade`, `pendant light shades only` (x2), `rechargeable wall light
  kitchen`, `ceiling canopy kit for pendant light`.

**Classifier fix applied during build**: an earlier version of the rule flagged any pure-ASCII
term without German diacritics as "Non-DE" — this incorrectly caught legitimate German
lighting-electrical terms with no umlauts (e.g. `netzteil 24v`, `abzweigdose flach 15mm`,
`5 volt netzteil`). Fixed by expanding the German product-word marker list (netzteil,
abzweigdose, leitung, stecker, dimmbar, schalter, volt, watt, etc.) and requiring an explicit
English-phrase match (not just "ASCII + no umlaut") before classifying as Non-DE. Re-run
confirmed the German ASCII terms now correctly fall into "Generic — high"/"Generic — medium".
This did not change any Keep/Exclude decision (conversions=0 either way), only the Exclude
sub-reason label.

## 6. Calculation validation
Spot-checked against raw SQL sums for `ledsone` (own-brand term):
- cost=€8.99, conversions=0.98, conv_value=€41.88
- ROAS = 41.88/8.99 = 4.657... → rounded 4.66x ✓
- Cost/Conv = 8.99/0.98 = 9.173... → rounded 9.17 ✓
- CTR/Conv Rate verified analogous to Req 1's method (clicks/impressions, conversions/clicks).
- Division-by-zero: 544 PMax rows have `cost IS NULL` (Google Ads API does not expose
  cost/CPC at search-term level for Performance Max) → rendered as `N/A` in Avg CPC,
  Cost, Cost/Conv columns; ROAS/7-Day/30-Day ROAS rendered as `0` (not fabricated) since
  cost is unknown, per the safe-division rule in the requirement.

## 7. Recommended Action rule validation
Formula implemented exactly as specified:
```
IF Conversions > 0: Keep
ELSE IF QueryIntent = "Competitor brand": Exclude — competitor term, add as negative phrase
ELSE IF QueryIntent = "Non-DE / mixed language": Exclude — low volume, non-native phrasing
ELSE: Exclude — add as negative exact match
```
Verified: all 54 rows with conversions > 0 → Keep (54/54). All 0 competitor-brand rows with
conversions > 0 (no overlap — competitor terms never converted in this data, confirming the
"cut" recommendation makes sense). All 6 Non-DE rows have conversions = 0. Remaining 1,679
Exclude rows with conversions = 0 and non-competitor/non-Non-DE intent → "Exclude — add as
negative exact match".

## 8. Duplicate risk check
Confirmed no existing "Search Terms Report" or "Req 3" content in `reports/mahima/`,
`prompts/`, `evidence/`, `validation/`, `handover/` before building (see section 1). New file
created: `reports/mahima/mahima-requirement-3-search-terms-report.html`. Existing Req 1
(`mahima-requirement-1-product-performance-report.html`) and Req 2 (stock management, on a
local Staff-requirements copy) were not modified.

## 9. Files modified
- New: `reports/mahima/mahima-requirement-3-search-terms-report.html`
- New: `reports/mahima/data/2026-07-09_mahima_req3_search_terms_builder.py`
- New: `reports/mahima/data/2026-07-09_mahima_req3_html_builder.py`
- New: `reports/mahima/data/2026-07-09_mahima_req3_search_terms_raw.json`
- New: `prompts/mahima/2026-07-09_mahima_req3_search_terms_prompt.md`
- New: `evidence/mahima/2026-07-09_mahima_req3_search_terms_evidence.md` (this file)
- New: `validation/mahima/2026-07-09_mahima_req3_search_terms_validation.md`
- New: `handover/mahima/2026-07-09_mahima_req3_search_terms_handover.md`
- New: `vercel/mahima/2026-07-09_mahima_req3_search_terms_vercel_readiness.md`
- No PostgreSQL data, tables, views, Google Ads bidding, negative keywords, or unrelated staff
  pages were touched. Read-only SQL only.

## 10. Final PASS / FAIL
**PASS** — existing assets checked (no duplicate), PostgreSQL read-only source found and
documented, Req 3 section built as a standalone report following the Req 1 pattern,
Recommended Action formula implemented exactly, evidence/validation/handover/prompt saved.
