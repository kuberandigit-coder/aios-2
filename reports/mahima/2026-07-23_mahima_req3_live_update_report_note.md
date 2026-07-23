---
task: Mahima Requirement 3 — Search Terms Report, live update on Tab 3 of mahima.html
date: 2026-07-23
team_member: Mahima
---

## Title
Mahima Requirement 3 — Search Terms Report — Live Update Report Note

## Purpose
Point-of-record summary: Req3, previously a static one-off snapshot (built 2026-07-09/10), is now backed by a live PostgreSQL endpoint.

## Requirement source
User instruction, 2026-07-23: continue and finish the previously-interrupted Mahima Req3 work, and make it live-updating.

## Business question
Same as the original 2026-07-09 requirement — which of ledsone.de's Google Ads search terms should Mahima keep, or exclude (as a negative keyword)?

## Data source
PostgreSQL (`google_ads.campaign_search_term_data`, `google_ads.pmax_campaign_search_term_data`, joined to `google_ads.campaigns`), account-wide for account 9031058245 (ledsone.de), rolling last 30 days with a trailing 7-day trend window. Live endpoint: `/api/requirement?fn=mahima-search-terms`.

## Files created or modified
- `reports/digital-marketing-member-pages/api/requirement.js` — new `mahimaSearchTermsHandlerModule`.
- `reports/digital-marketing-member-pages/pages/mahima.html` — Tab 3 Refresh button + `r3Reload()` wired to the live endpoint, replacing the static `ROWS3` dataset on click.
- `reports/digital-marketing-member-pages/pages/sales.html` — a Search Terms tab was added here first, then fully removed per user correction; Req3 lives only on `mahima.html`.

## Evidence location
`evidence/mahima/2026-07-23_req3-search-terms-live-relocation.md`

## Validation result
PASS — `validation/mahima/2026-07-23_req3-search-terms-live-relocation.md`. Live-tested: 59,918 search terms (95 Keep / 59,823 Exclude) returned from production.

## Owner / Reviewer
Owner: Mahima · Reviewer: User (directed the relocation from `sales.html` to `mahima.html`).

## Status
Deployed to Vercel production. Done.

## Result summary
| Metric | Value |
|---|---|
| Total search terms (rolling 30d) | 59,918 |
| Keep | 95 |
| Exclude | 59,823 |
| Data source | PostgreSQL, account-wide (not campaign-scoped) |

## Known limitations
"Existing Negative Keyword" (`nk`) column has no real live data source and defaults to "No" — same as the original 2026-07-09 static report, not a new gap introduced by this change.

## Next steps
None outstanding.

## PASS / FAIL result
**PASS**
