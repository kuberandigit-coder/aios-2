# Evidence — Jefri Req2: No Date-Range Control Hid Real Historical Data

**Date:** 2026-10-08
**Project:** dm-dashboard
**Follow-up to:** `2026-10-08_jefri-hardcoded-campaign-list-bug_evidence.md` — found while live-
verifying that fix on the production server.

## Investigation

1. After deploying the campaign-list fix, confirmed live: all 8 of Jefri's enabled campaigns now
   appear (was 5), but 7 still showed 0 search terms.
2. Checked directly against the production DB (via SSH, `psql` against `BUSINESS_DATABASE_URL`):
   `google_ads.pmax_campaign_search_term_data` has **1,812,586** rows storewide;
   `google_ads.campaign_search_term_data` has **161,753** rows for just those 7 campaign IDs —
   both tables are genuinely populated, contradicting an old code comment that claimed they were
   "currently empty tables."
3. Checked `MAX(date)` per campaign: 6 of the 7 campaigns' most recent row is **2026-07-06** (one
   as old as 2026-03-20) — today is 2026-10-08, well outside `QUERY_R2`'s hardcoded
   `CURRENT_DATE - INTERVAL '90 days'` window.
4. Checked the frontend (`SearchTermsLabels.jsx`): no date-range control existed at all — the page
   always called `/api/jefri/req2` with no parameters, so this older real data was permanently
   unreachable through the UI, with no indication to the user it existed.

## Fix

- `backend/app/staff_pages/jefri.py`: `QUERY_R2` now accepts optional `from_date`/`to_date`
  (`COALESCE`'d to the prior 90-day default when absent — default view unchanged). The now-false
  "empty tables" comment was corrected with the real finding. Response `reportPeriod` reports the
  actual effective date range used, not a hardcoded label.
- `frontend/src/jefri/pages/SearchTermsLabels.jsx`: added From/To date inputs + Apply/Reset
  buttons, same `from`/`to` query-param convention Req1 already used on this page.

## Validation

`python -m py_compile` — clean. Full `npx vite build` — clean. No live click-through from this
session.

## Files changed

`backend/app/staff_pages/jefri.py`, `frontend/src/jefri/pages/SearchTermsLabels.jsx`. Commit
`0d50953`, pushed to `dev-work`.

## Status

**Fixed and pushed.** Not yet merged to `main` or deployed. To see the real historical data for
the 6 affected campaigns once live: set From ~2026-06-01, To ~2026-07-10.
