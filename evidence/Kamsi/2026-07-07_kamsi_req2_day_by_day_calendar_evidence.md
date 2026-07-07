# Evidence — Kamsi Req 2: Day-by-Day Calendar Filter (2026-06-01 to 2026-06-30)

**Title:** Added a real daily-granularity calendar filter to Kamsi Req2 (Low CTR Page Identification)
**Purpose:** User requested day-by-day filtering within June 2026 ("like a calendar") instead of only the fixed monthly aggregate
**Requirement Source:** User instruction, 2026-07-07
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan
**Business Question:** For any single day in June 2026, which collection/blog pages had low CTR?

## Discovery
- Req2's existing dataset (`kamsi-req2-low-ctr-pages.html`) is a **monthly aggregate only** — no per-day granularity, confirmed by inspecting the embedded JSON (1,385 rows, one row per page, no date field).
- Checked PostgreSQL for a daily-level GSC source: found `google_search_console.gsc_web_page` — a full GSC mirror with a real `date` column. Verified June 2026 coverage: `min=2026-06-01, max=2026-06-30, distinct_days=30, count=105,409` rows for `sc-domain:ledsone.co.uk`.
- Filtered to the same scope as the original report (page contains `/collections/`, `/blogs/`, or `/blog/`): **13,485 rows across all 30 days**, matching against the same 1,385-page list used in the existing monthly report by URL path.
- 588 of 13,485 rows (161 distinct paths) did not match any of the 1,385 tracked pages — investigated and confirmed these are `/collections/X/products/Y` product-detail pages that satisfy the loose SQL `LIKE '%/collections/%'` pattern but were correctly excluded from the original report's stricter "collection page" definition. Not a bug — correctly dropped from the daily dataset.

## What was built
- Pulled real day-level `clicks`, `impressions`, `position` per page per day (read-only SQL) and matched to the existing page index.
- Added a new `<script id="d2day" type="application/json">` data-holder tag inside Req2's tab panel, containing all 30 days keyed by date, each holding `[pageIndex, impressions, clicks, ctr, position]` per page with data that day.
- Added a calendar-style day-picker grid (31 clickable cells: "Full Month" + June 1–30) above the existing filters in Req2's tab.
- Selecting a day recomputes the table for that single day's clicks/impressions/CTR/position per page (Low CTR flag recalculated live, same `CTR < 2%` rule); pages with zero impressions that day show as 0, not flagged. Selecting "Full Month" reverts to the original, unchanged monthly view.
- All existing filters (search, Flag, Page Type, CTR Range) and the sortable columns continue to work identically on top of whichever day/month is selected.

## Bug found and fixed in the same pass (pre-existing, discovered while working in this file)
- **`id="f_type"` collision between Req2 and Req3**, missed during the original 5-tab merge — both panels used the same id for their "Page Type" dropdown, and since Req2 appears earlier in the DOM, `getElementById('f_type')` always resolved to Req2's element. This meant Req3's own Page Type filter never actually read its own dropdown. Fixed by renaming Req3's to `id="f_type3"` (HTML + its one `getElementById` reference).

## Verification performed
- Div balance: 167 open / 167 close (up from 163, consistent with the new calendar HTML added)
- `node --check` syntax validation on the full ~8 MB combined script: **passed, exit 0**
- Cross-checked June 1st totals directly from the raw daily pull: 419 pages had data, 16,904 impressions, 67 clicks — sane, consistent with a long-tail SEO site (966 of 1,385 pages had zero impressions that specific day)
- Live deployment fetch confirmed the `d2day` dataset (30 days) and the `f_type3` fix are both present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html` — Req2 tab updated with calendar filter; Req3's `f_type` collision fixed
- `reports/Kamsi/data/2026-07-07_kamsi_req2_daily_gsc_raw.json` — raw daily PostgreSQL pull (13,485 rows)
- `reports/Kamsi/data/2026-07-07_kamsi_req2_page_order.json` — page index used to align daily data to the existing report
- `reports/Kamsi/data/2026-07-07_kamsi_req2_build_daily_dataset.py`, `2026-07-07_kamsi_req2_daily_by_day.json` — day-indexed dataset build
- `reports/Kamsi/data/2026-07-07_kamsi_req2_add_day_filter.py` — the HTML/JS patch script
- `reports/Kamsi/data/2026-07-07_kamsi_req1req2req3req4req5_merged_backup.html` — safety backup before this change

## What was explicitly NOT touched
- No PostgreSQL data modified (read-only SELECT queries only)
- Req1, Req3 (aside from the id fix), Req4, Req5 tabs unchanged
- No other staff member's pages touched
- Original monthly aggregate view (default "Full Month") behaves identically to before this change

## Deployment
Deployed to Vercel production and verified live: HTTP 200, all 5 tabs intact, day-by-day dataset present, f_type3 fix confirmed live.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** GSC omits zero-impression rows per day (same limitation as the monthly report), so "0 impressions" for a page on a given day means no recorded activity, not necessarily true zero visibility; Avg Position falls back to the monthly figure when a page has no data that specific day (no daily position to show instead).
**Next Steps:** none
**PASS / FAIL:** PASS
