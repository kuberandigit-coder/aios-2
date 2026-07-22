---
title: Jefri Requirement 2 — Search Terms Labels, summary report
date: 2026-07-22
type: report
---

# Requirement Summary
Live dashboard section classifying Jefri's Google Ads search terms (last 90 days) into Hero/Villain/Zombie/Sidekick tags, so he can quickly see which terms to scale, monitor, improve, or ignore.

# Requester
Jefri, Google Ads department.

# Business Question
Which search terms should be scaled (Hero), watched for wasted spend (Villain), ignored (Zombie), or kept an eye on (Sidekick)?

# Tables Inspected (read-only)
- `google_ads.campaign_search_term_data`
- `google_ads.pmax_campaign_search_term_data`

# Columns Used
`search_term, match_type, impressions, clicks, cost, conversions, conversions_value, campaign_id, date` (both tables share this shape).

# SQL Mapping
UNION ALL of both tables filtered to Jefri's 5 campaign IDs and `date >= CURRENT_DATE - INTERVAL '90 days'`, re-aggregated `GROUP BY search_term, match_type`. CTR/Avg CPC/Cost-per-Conversion/ROAS computed in application code from the aggregated sums (not per-row daily averages).

# Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/jefri.html`

# Validation
See `validation/jefri/2026-07-22_req2-search-terms-labels-validation.md` — all 6 revised-spec tag-classification examples PASS, ROAS formula matches exactly, live endpoint confirmed returning real (non-hardcoded) data.

# Known Limitations
- Tag rules leave a meaningful minority of rows (~3,214 of 50,768) untagged when none of the 4 named conditions match (e.g. 1-2 clicks with ROAS < 400%) — this is per the explicit "if none match, leave Tag empty" instruction, not a bug.
- The original build prompt's own validation example conflicted with its own stated rule at exactly ROAS=400% — resolved by the same-day revision prompt, which explicitly confirmed 400% is Hero (inclusive boundary). Documented in the validation file for traceability.
- No static snapshot/caching for this endpoint yet — every dashboard load queries Postgres live. Not yet a reported problem (query returns in well under 60s for 50k+ rows), but worth monitoring if traffic increases.

# Next Steps
1. Get Jefri's confirmation that the dashboard matches his real workflow.
2. Git commit/push (pending explicit user permission) and sync to `Staff-requirements`.
3. Monitor whether the large Zombie count is expected or signals a scope/window issue worth revisiting.

# Reviewer
Pending — user.

# PASS / FAIL
PASS
