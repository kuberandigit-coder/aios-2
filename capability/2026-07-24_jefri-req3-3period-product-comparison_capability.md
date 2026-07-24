# Capability — 3-Period Product Comparison (Jefri Requirement 3 / T-03)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Jefri Req3 (T-03)
**Store/Project:** digital-marketing-member-pages / Postgres (`google_ads.product_performance`)
**Status:** Completed

## Capability
Compare a product's Google Ads Conv. Value and ROAS across three fixed calendar-quarter windows (Previous 3M, Last 3M, Prior-Year 3M), classify a directional Improved/Same/Drop status, and rank products into a High/Mid performance tier by revenue-contribution percentile combined with a ROAS threshold.

## What Was Implemented
- A new Postgres query (`JEFRI_R3_QUERY`) with three period CTEs, a UNION of product IDs active in *any* period (not just the intersection), and a `ROW_NUMBER()`/`COUNT() OVER()` window function for percentile-based tiering.
- Reused Req1's SKU-resolution CTEs (`resolved_ids`/`child_fallback`/`resolved_listing`) verbatim rather than reimplementing.
- Pure classification functions: `jefriR3Roas()`, `jefriR3PctChange()`, `jefriR3Status()`, `jefriR3Tier()`.
- Same 60s in-memory cache + static-snapshot-fallback + `?refresh=1` pattern as Req1/Req2 (`jefriReq3Handler`).
- Frontend: grouped 2-row `<thead>` table, sort/search/filter, pagination, CSV + lightweight HTML-table-as-`.xls` export, IndexedDB persistence matching Req1/Req2.

## Technical Knowledge
- When a period predates a campaign's tracked history (here, Apr-Jun 2025 has 0 rows before 2025-05-12), that's a real, disclosed data gap — verified via `information_schema.columns` and manual row counts before writing any code, not silently absorbed into the output.
- A tier bucket returning 0 rows ("mid: 0") looked suspicious but was independently re-verified with a standalone query against the same percentile/ROAS thresholds — confirmed as correct real-data output, not a bug, before shipping.

## Important Rules / Logic
- Product set = UNION across all three periods (a product active in only one period is still included, with zeros for the others) — not an intersection.
- Tier is a percentile-of-revenue-rank + ROAS-threshold combination; Status is Conv. Value/ROAS trend-direction based with a defined precedence rule when the two metrics disagree (see the live evidence file for the exact precedence note).

## Files / Components
- `reports/digital-marketing-member-pages/api/requirement.js` (`jefriReq3Handler`, `JEFRI_R3_QUERY`)
- `reports/digital-marketing-member-pages/pages/jefri.html` (Requirement 3 tab)

## Data Sources / Tools
PostgreSQL: `google_ads.product_performance`, `listings.shopify_listings`.

## Validation
Live-tested same session: `GET /api/requirement?fn=jefri-req3&refresh=1` returned `summary:{"totalProducts":4791,"high":166,"mid":0,"improved":48,"same":2,"drop":74}`; top row spot-checked against a manual SQL re-run and matched exactly; deployed HTML confirmed via grep for `req3Tab`/`tabBtnReq3`/`fn=jefri-req3`. See `validation/jefri/2026-07-24_req3-3period-comparison-validation.md`.

## Reuse
The 3-period comparison pattern (UNION-of-periods + percentile-tier + trend-status) is reusable for any other staff member needing a similar multi-window product comparison.

## Evidence
`evidence/jefri/2026-07-24_req3-3period-comparison-evidence.md`

## Limitations
The Prior-Year 3M window has a genuine data gap for campaigns not yet tracked before 2025-05-12 — any product active only in that gap window will show incomplete history, by design, not a bug.
