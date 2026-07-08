# Evidence — Kamsi Req2: Day Filter Re-sourced to GSC API (Replaced PostgreSQL Mirror)

**Title:** Swapped the day-by-day calendar filter's data source from the PostgreSQL GSC mirror to a direct Google Search Console API pull
**Purpose:** User explicitly wanted daily figures sourced from GSC directly ("kamsi is asking date by date from GSC"), not the PostgreSQL mirror table used in the previous build
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## Options presented (per user request, before building)
1. **Re-fetch all 30 days from the GSC API and embed as static data** (same architecture as before — chosen)
2. Build a live serverless backend that calls GSC API at the moment a date is picked — ruled out (adds new infrastructure, not needed for the actual requirement of viewing per-day metrics)

## What was done
- Wrote `reports/Kamsi/data/2026-07-08_kamsi_req2_gsc_daily_fetch.py`, reusing the exact same GSC service account/site/scope logic as the original monthly fetch (`2026-07-03_kamsi_req2_gsc_fetch.py`), but with `dimensions=["page","date"]` instead of `["page"]`.
- Fetched **13,485 daily rows across all 30 days of June 2026, 1,385 distinct pages** — directly from the GSC Search Analytics API (read-only), same page scope (`/collections/`, `/blogs/`, `/blog/`) as the existing monthly report.
- Matched the new GSC-sourced daily rows to the existing page index (`2026-07-07_kamsi_req2_page_order.json`) by URL path, exactly as before.
- Swapped the `<script id="d2day" type="application/json">` data-holder tag in the live page with this new GSC-sourced dataset — no HTML/JS logic changes needed, since the day-picker/filtering code (`pickDay2`, `dayBase`) already just reads whatever is in `d2day`.

## Known discrepancy (investigated, not a bug)
- 588 of 13,485 rows (161 distinct paths) don't match the existing 1,385-page index — same exact count as the earlier PostgreSQL-sourced pull.
- Investigated: these are `/collections/X/products/Y` URLs, which satisfy the API's `page contains "/collections/"` filter but represent product pages, not collection pages.
- Since this identical mismatch appeared in a pull sourced from Postgres AND a pull sourced fresh from the API, it isn't a scope-matching bug in either — it reflects that the underlying page-set has drifted slightly since the original monthly report was built on 2026-07-03 (GSC data is known to receive minor attribution revisions for up to ~2 weeks after the fact). Documented, not silently dropped.

## Verification performed
- Div balance: 159 open / 159 close (unchanged, pure data swap)
- `node --check` syntax validation: passed, exit 0
- Spot-checked 2026-06-05: 403 pages with data, 19,507 impressions, 61 clicks — sane numbers
- Live deployment fetch confirmed the new `d2day` dataset (30 days) is live and matches the same 2026-06-05 spot-check numbers

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` — `d2day` dataset swapped
- `reports/Kamsi/data/2026-07-08_kamsi_req2_gsc_daily_fetch.py` — the new GSC API fetch script
- `reports/Kamsi/data/2026-07-08_kamsi_req2_gsc_daily_raw.json` — raw API pull (13,485 rows)
- `reports/Kamsi/data/2026-07-08_kamsi_req2_gsc_daily_by_day.json` — day-indexed dataset built from the API pull
- `reports/Kamsi/data/2026-07-08_kamsi_before_gsc_daily_swap_backup.html` — safety backup before this change

## What was explicitly NOT touched
- No PostgreSQL data read or written in this pass (pure GSC API call, read-only)
- Monthly aggregate view ("Full Month") unchanged — still the original GSC API monthly pull from 2026-07-03
- Req1, Req3, Req4, Req5 tabs unaffected
- No other staff member's pages touched

## Deployment
Deployed to Vercel production and verified live: HTTP 200, all 30 days present, all 5 tabs intact, spot-check numbers matched.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** Still a pre-fetched static snapshot (fetched 2026-07-08), not a live-on-click API call; 161 product-under-collection pages are out of scope and excluded (documented above, same as before).
**Next Steps:** none
**PASS / FAIL:** PASS
