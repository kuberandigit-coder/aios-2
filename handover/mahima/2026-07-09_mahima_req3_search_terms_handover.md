---
task: Mahima Requirement 3 — Search Terms Report (Keep / Cut / Scale)
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 3 — Search Terms Report — Handover

## Purpose
Point-of-record handover for Kuberan/Mahima review of the completed Req 3 report.

## Requirement source
Mahima Requirement 3 (Google Ads department) — Search Terms Report (Keep/Cut/Scale)

## Business question
Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query
intent, and wasted spend, for ledsone.de Google Ads?

## PostgreSQL sources checked
`google_ads.campaign_search_term_data`, `google_ads.campaign_search_term_insights`,
`google_ads.campaigns`, `google_ads.accounts`, `google_ads.keywords` (all read-only).

## Files created or modified
Live report: `reports/mahima/mahima-requirement-3-search-terms-report.html`
Supporting data/scripts: `reports/mahima/data/2026-07-09_mahima_req3_*`

## Evidence location
`evidence/mahima/2026-07-09_mahima_req3_search_terms_evidence.md`

## Validation result
PASS — `validation/mahima/2026-07-09_mahima_req3_search_terms_validation.md`

## Owner / Reviewer
Owner: Mahima · Reviewer: Kuberan

## Status
Done, local repo only, pending review. Not deployed to Vercel/live yet (see
`vercel/mahima/2026-07-09_mahima_req3_search_terms_vercel_readiness.md`).

## Result summary
| Metric | Value |
|---|---|
| Account | ledsone.de (Google Ads account_id 9031058245) |
| Date range | Last 30 days as of 2026-07-09 (2026-06-10 → 2026-07-09) |
| Total search terms (clicks > 0) | 1,768 |
| Total cost | €525.14 |
| Total conversion value | €1,292.94 |
| Overall ROAS | 2.46x |
| Keep | 54 |
| Exclude | 1,714 |
| — Exclude: competitor brand | 29 |
| — Exclude: non-DE/mixed language | 6 |
| — Exclude: negative exact match (default) | 1,679 |
| PMax rows (no cost data available) | 544 |
| Search/EXACT rows (full cost data) | 1,224 |

## Known limitations
1. Performance Max search-term rows have no cost/CPC — Google Ads API limitation, disclosed in
   report Notes, not fabricated.
2. Query Intent is a documented rule-based classifier (PostgreSQL has no query_intent column).
3. Report scoped to the 1,768 terms with ≥1 click in 30 days, out of 21,282 total distinct
   terms with any impression.
4. No negative keyword lists exist on this account yet — confirmed via direct query, not
   assumed.

## Next steps
1. Mahima/Kuberan review the Recommended Action and Query Intent classifications against the
   original Req 3 sheet for sign-off.
2. If approved, consider whether the 1,679 default "Exclude — add as negative exact match"
   rows should be pushed as actual negative keywords in Google Ads — **that action was
   explicitly out of scope for this build** (no Google Ads changes were made).
3. Optional: extend Query Intent classifier with any additional competitor brands or German
   product-word markers Mahima flags as missing.
4. **Not linked into the live tabbed `mahima.html` staff page yet.** The team's main page at
   `reports/digital-marketing-member-pages/pages/mahima.html` is an 8.5MB file with embedded
   Req 1/Req 2 tab data on very long single lines — too risky to blindly patch without a
   dedicated review of its tab structure first. Followed the same precedent as Req 1, which
   also exists as a standalone report file (`mahima-requirement-1-product-performance-report.html`)
   independent of the tabbed page. Recommend a follow-up task to add a "Req 3" tab/link once
   the tabbed page's structure has been safely reviewed.

## PASS / FAIL result
**PASS**
