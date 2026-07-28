# Thasitha Requirement 1 — Live PostgreSQL Refresh — Handover

**Date:** 2026-07-28

## What this is

Requirement 1 (Campaign Performance & ROAS Action) on `reports/digital-marketing-member-pages/pages/thasitha.html` was converted from a static, hourly-rebaked snapshot to a live PostgreSQL-backed page with a "Refresh Data" button, matching Jefri's Requirement 1 pattern.

## Files Modified

1. `reports/digital-marketing-member-pages/api/requirement.js`
   - Added `thasithaReq1HandlerModule` (self-contained IIFE, own `pg` `Pool`, own 60s cache) right before the final `module.exports` dispatcher.
   - Queries: `google_ads.campaigns WHERE group_name='Thasi'` for campaign id/name/budget/tags, and `google_ads.campaign_performance WHERE campaign_id = ANY($1)` for daily impressions/clicks/cost/conversion_value/conversions.
   - Registered dispatch: `if (fn === 'thasitha-req1') return thasithaReq1HandlerModule(req, res);` — reuses the existing merged `requirement.js` function, no new Vercel function created.
   - `?refresh=1` bypasses the cache (sent by the frontend's Refresh button).

2. `reports/digital-marketing-member-pages/pages/thasitha.html`
   - Added a live status chip (`#t1LiveChip`) and "Refresh Data" button (`#t1RefreshBtn`) to the R1 header, plus a `#t1LastRefreshed` timestamp in the footnotes.
   - Renamed the old hardcoded `CAMPAIGNS`/`DAY`/`MIN_DATE`/`MAX_DATE`/`GENERATED_AT` to `FALLBACK_*` — kept only as an instant first-paint / offline fallback.
   - Added `applyLiveData(data)` (rebuilds `CAMPAIGNS`/`DAY`/date range from the API response, into the exact shape `computeRange()`/`computeDaily()` already expect — no changes needed to those functions) and `r1Load(force)` (fetch + chip/button state handling).
   - `r1Load(false)` runs on page load (after the fallback data has already rendered once via the existing `applyRange()` call), and the Refresh button calls `r1Load(true)`.

## Verified

Queried Postgres directly (`mcp__ledsone-db-mcp__execute_sql`) before/after wiring: data is live through 2026-07-28, and the live `group_name='Thasi'` query correctly surfaced a 3rd campaign (`24051146082`) that the old hardcoded 2-campaign list was missing. This is concrete proof the live approach is materially better, not just architecturally cleaner.

## Continuing this work

- To see it live: run the app locally (`vercel dev` inside `reports/digital-marketing-member-pages/`) or deploy, then open `pages/thasitha.html`, Requirement 1 tab — it should show "Fetching live from PostgreSQL…" then "Live — fetched just now", with 3 campaigns in the table.
- If Requirement 2–5 should also move to live-refresh, follow the identical pattern: new `fn=thasitha-reqN` branch reusing this same `Pool`/`getPool()` (or a sibling pool per the file's existing per-feature-pool convention), a frontend fetch + refresh button + chip, per the Jefri precedent.
- The old hourly cron routine that rebakes this file's fallback constants (`evidence/thasitha/requirement-1-hourly-live-refresh-routine-evidence.md`) still runs. It's now redundant for R1's primary data path but still useful as the fallback source — no action taken on it; flag to the user if they want it disabled.

## Evidence Location

`evidence/thasitha/2026-07-28_requirement-1-live-refresh-evidence.md`

## Status

Implementation complete, code- and database-validated. Not deployed/pushed — per project rules, no git push or Vercel deploy without explicit approval.

## Next Step

Get approval to deploy/push, then verify live in a browser.
