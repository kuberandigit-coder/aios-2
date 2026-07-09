---
task: Mahima Requirement 3 — Search Terms Report (Keep / Cut / Scale)
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 3 — Search Terms Report (Keep / Cut / Scale) — Reusable Prompt

## Purpose
Reusable execution prompt for building/refreshing the ledsone.de Google Ads search terms
Keep/Cut/Scale report. Re-run this prompt (with an updated "as of" date) whenever the report
needs refreshing with a new 30-day window.

## Requirement source
Mahima Requirement 3 (Google Ads department) — screenshot / Google Sheet section: "Which
search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query intent,
and wasted spend?"

## Team member
Mahima (Owner) · Kuberan (Reviewer)

## Business question
Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query
intent, and wasted spend, for the ledsone.de Google Ads account?

## PostgreSQL sources checked
- `google_ads.campaign_search_term_data` (search term × campaign × match_type, daily)
- `google_ads.campaign_search_term_insights` (PMax category labels)
- `google_ads.campaigns` (campaign name/type, filtered to `account_id = 9031058245`)
- `google_ads.accounts` (confirmed 9031058245 = ledsone.de, EUR, DE market)
- `google_ads.keywords` (checked for existing negative keywords — none found: 0 of 128
  keywords on this account are negative)

## Prompt (verbatim scope used)
1. Search existing AIOS assets (prompts/evidence/reports/validation/handover/vercel +
   `reports/mahima/`) to confirm no duplicate Req 3 / Search Terms Report exists.
2. Inspect PostgreSQL (read-only) across all schemas for search-term-level Google Ads data.
3. Confirm ledsone.de account_id via `google_ads.accounts`.
4. Pull last-30-day and last-7-day search term aggregates (search_term × campaign ×
   match_type), restricted to rows with clicks > 0 in the 30-day window.
5. Compute CTR, Avg CPC, Conv. Rate, ROAS, Cost/Conv, 7-Day ROAS, 30-Day ROAS — all
   divide-by-zero cases rendered as N/A or 0, never fabricated.
6. Classify Query Intent with a documented rule-based classifier (no query_intent column
   exists in PostgreSQL): Competitor brand / Non-DE-mixed-language / Low-intent-bargain /
   Generic-high / Generic-medium.
7. Apply Mahima's exact Recommended Action formula (Conversions > 0 → Keep; else by intent →
   Exclude with sub-reason).
8. Compute Trend (7-Day ROAS vs 30-Day ROAS) and Priority (High/Medium/Low) per documented
   rules.
9. Build a new standalone report `reports/mahima/mahima-requirement-3-search-terms-report.html`
   following the same visual/structural pattern as
   `reports/mahima/mahima-requirement-1-product-performance-report.html`.
10. Save evidence, validation, handover, prompt, and vercel-readiness notes in AIOS.

## Files created or modified
- `reports/mahima/mahima-requirement-3-search-terms-report.html` (new)
- `reports/mahima/data/2026-07-09_mahima_req3_search_terms_builder.py` (new — calc/classify script)
- `reports/mahima/data/2026-07-09_mahima_req3_html_builder.py` (new — HTML generator script)
- `reports/mahima/data/2026-07-09_mahima_req3_search_terms_raw.json` (new — computed rows + summary)

## Evidence location
`evidence/mahima/2026-07-09_mahima_req3_search_terms_evidence.md`

## Validation result
See `validation/mahima/2026-07-09_mahima_req3_search_terms_validation.md`

## Owner / Reviewer
Owner: Mahima · Reviewer: Kuberan

## Status
Done, local repo only, pending review.

## Known limitations
- Performance Max search-term rows (544 of 1,768) have no cost/CPC/Cost-per-Conv data — this
  is a Google Ads API restriction (PMax search term insights don't expose cost), not a pipeline
  bug.
- Query Intent classifier is rule-based and documented, not Google's semantic categorisation.
- Report scoped to search terms with ≥1 click in the last 30 days (1,768 of 21,282 total
  distinct terms with any impression) to keep the table decision-focused.
- No negative keyword lists exist yet on this account, so "Existing Negative KW" is "No" for
  every row.

## Next steps
Kuberan review → confirm Recommended Action formula and Query Intent rules match Mahima's
sheet exactly → approve for push/deploy.

## PASS / FAIL result
**PASS**
