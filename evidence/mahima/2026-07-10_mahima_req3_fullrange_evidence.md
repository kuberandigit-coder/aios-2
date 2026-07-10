---
task: Mahima Requirement 3 — Search Terms Report, extend to full Jan1-Jul10 date range
date: 2026-07-10
team_member: Mahima
---

## Title
Mahima Requirement 3 — Full Date Range Update — Evidence

## Purpose
Extend the Search Terms Report (previously last-30-days only) to the full 2026-01-01 to
2026-07-10 range, matching the scope already applied to Req1.

## Requirement source
Kuberan, 2026-07-10 — "for mahima req 3 is current for last 30day i need from jan 1 to july 10 update that also".

## Business question
Same as original Req3: which search terms should Mahima keep, exclude, or scale — now over
the full campaign history to date instead of a rolling 30-day window.

## PostgreSQL sources checked
`google_ads.campaign_search_term_data`, `google_ads.campaigns`,
`google_ads.campaign_search_term_insights` — same sources as the original Req3 build,
re-queried for the full date range.

## Data pulled
- Main aggregate: `search_term × campaign × match_type`, `date >= '2026-01-01' AND date <=
  CURRENT_DATE`, `HAVING SUM(clicks) > 0` → **12,208 rows** (up from 1,768 in the 30-day
  version).
- 7-Day ROAS window: unchanged methodology — fixed to the most recent 7 days from today,
  independent of the full-range totals (242 rows with any 7-day activity).
- 30-Day ROAS window: fixed to the most recent 30 days from today (12,679 rows).

## Calculation validation
- Total cost: €3,609.94, total conversion value: €22,071.48, overall ROAS =
  22071.48/3609.94 = 6.1141 → 6.11x ✓
- Keep: 682, Exclude: 11,526 (682+11526 = 12,208 = total ✓)
- PMax rows (no cost data): 6,363; Search/EXACT rows (full cost data): 5,845
  (6,363+5,845 = 12,208 ✓)

## Files modified
- `reports/mahima/mahima-requirement-3-search-terms-report.html` (standalone report,
  regenerated for full range)
- `reports/digital-marketing-member-pages/pages/mahima.html` (Tab 3 — `ROWS3` data and all
  descriptive text/filter option counts regenerated for full range; Tab 1/Tab 2 verified
  untouched — ROWS1 6,938 rows, ROWS2 10,133 rows, both confirmed intact after the edit)
- `reports/mahima/data/2026-07-10_mahima_req3_fullrange_*.py` (new — builder/patch scripts)
- `reports/mahima/data/2026-07-10_mahima_before_req3_fullrange_backup.html` (pre-edit backup)

## Validation performed
- Full inline `<script>` block in `mahima.html` re-extracted and passed `node --check` after
  the edit.
- `ROWS3` re-parsed independently: 12,208 rows, valid JSON.
- All Tab 3 element IDs (`q3`, `campsel3`, `actionsel3`, `intentsel3`, `prioritysel3`,
  `tbody3`, `kpiCards3`, `quickFilters3`, `pageInfo3`, `prevPage3`, `nextPage3`) confirmed
  present exactly once.
- Standalone report file's inline script independently validated with `node --check`.

## Known limitations (unchanged from original Req3, still apply)
1. PMax search terms (6,363 of 12,208 rows) have no cost/CPC data — Google Ads API
   restriction.
2. Query Intent remains a rule-based classifier, not Google's semantic tagging.
3. No negative keyword lists exist on this account.
4. Report now scoped to terms with ≥1 click over the full 2026-01-01–2026-07-10 range
   (previously last 30 days).

## Deployment
Pushed to `kuberandigit-coder/aios-2` and `digitalmarketing69140951-sys/Staff-requirements`,
deployed to Vercel production.

## PASS / FAIL result
**PASS**
