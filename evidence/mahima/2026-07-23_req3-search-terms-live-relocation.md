# Evidence — Mahima Req3 Search Terms Report Goes Live, Then Relocated to mahima.html

**Date:** 2026-07-23
**Commits:** `80f7b9a` (built live in `sales.html`), `81c315f` (Check New Orders button added), `be89ae8` (relocated to `mahima.html`, removed from `sales.html`)

## Purpose
Mahima Req3 (Search Terms Report, Keep/Exclude classification) had only ever existed as a static one-off snapshot report (`reports/mahima/mahima-requirement-3-search-terms-report.html`, built 2026-07-09/10 from hand-pulled PostgreSQL JSON exports). User asked to make it live-updating.

## What was built (`80f7b9a`)
- New live endpoint `fn=mahima-search-terms` in `api/requirement.js`: queries `google_ads.campaign_search_term_data` + `google_ads.pmax_campaign_search_term_data` (UNION), joined to `google_ads.campaigns`, filtered to account 9031058245 (ledsone.de), account-wide (not scoped to named campaigns) — rolling last-30-days with a trailing 7-day window for trend comparison.
- Classification logic (Query Intent classifier, Keep/Exclude action rule, Priority, Trend) ported line-for-line from the original 2026-07-09 Python builder script, so live results match the original static report's rules exactly.
- Initially added as a third tab ("Search Terms") on Mahima's section of `sales.html`, alongside Organic and Google Ads.
- Verified live: 59,918 search terms returned (95 Keep / 59,823 Exclude).

## Correction — relocated per user instruction (`be89ae8`)
- User determined the tab did not belong on `sales.html` (a Shopify-order-based sales dashboard) and asked for it to live on `mahima.html`'s pre-existing "Tab 3: Search Terms Report" instead (the original static-snapshot tab).
- The "Search Terms" tab (button, HTML container, and all `MST_`-prefixed JS) was fully removed from `sales.html`.
- `mahima.html`'s existing Tab 3 — previously a ~4.2MB hardcoded static `ROWS3` array from the 2026-07-09/10 build — got a new Refresh button wired to the same `fn=mahima-search-terms` live endpoint, mapping the API's field names onto the field shape (`st`/`c`/`mt`/`imp`/`cl`/etc.) the existing filter/render/pagination code already expected, so none of that code needed to change.
- Live-verified after relocation: `mahima.html` Tab 3 fetches 59,918 live terms via the Refresh button; `sales.html` confirmed to have zero remaining references to Search Terms/`MST_`/`mstLoad`.

## Raw diff
See `git show 80f7b9a`, `git show 81c315f`, `git show be89ae8`.
