# Thasitha Requirement 1 — Live PostgreSQL Refresh

**Date:** 2026-07-28
**Team member / Team / Store:** Thasitha / Google Ads / ledsone.de

## Purpose

Convert Requirement 1 (Campaign Performance & ROAS Action) from a static, hourly-rebaked HTML snapshot into a live, on-demand PostgreSQL-backed page — matching the pattern already used on Jefri's Requirement 1 (a "Refresh Data" button that triggers a fresh server-side Postgres query, not a client-side reload of stale baked JSON).

## What changed

- **Backend:** added `thasithaReq1HandlerModule` / `handleThasithaReq1` to `reports/digital-marketing-member-pages/api/requirement.js`, dispatched via `?fn=thasitha-req1`. Reuses the same `pg` Pool pattern, env vars (`DATABASE_URL`/`PGHOST` etc.), and `ssl:false` config already proven working for the Jefri endpoint in the same file. 60s in-memory cache, bypassed by `&refresh=1` (sent when the user clicks "Refresh Data").
- **Frontend:** `reports/digital-marketing-member-pages/pages/thasitha.html` Requirement 1 tab now fetches `/api/requirement?fn=thasitha-req1` on page load and on-click of a new "Refresh Data" button, with a live status chip ("Fetching live from PostgreSQL…" / "Live — fetched just now" / "Unable to refresh…") and a "Last Refreshed" timestamp. The previously hardcoded `CAMPAIGNS`/`DAY`/`MIN_DATE`/`MAX_DATE`/`GENERATED_AT` constants were renamed to `FALLBACK_*` and are now used only as an instant first paint before the live fetch resolves (and as a fallback if a fetch ever fails) — they are no longer the primary data path.

## Query source (live, not hardcoded)

```sql
SELECT campaign_id, campaign_name, budget, feeds
FROM google_ads.campaigns
WHERE group_name = 'Thasi'
ORDER BY campaign_id;

SELECT to_char(date, 'YYYY-MM-DD') AS date, campaign_id, impressions, clicks,
       cost, conversion_value, conversions
FROM google_ads.campaign_performance
WHERE campaign_id = ANY($1::bigint[])
ORDER BY date ASC, campaign_id ASC;
```

Same tables/fields already validated in `evidence/thasitha/requirement-1-postgresql-source-map.md` — no new source mapping was needed, only a live query path replacing the build-time bake.

## Live verification (2026-07-28)

Ran both queries directly against the database via `mcp__ledsone-db-mcp__execute_sql` before wiring the endpoint:

- Confirmed data is current through **2026-07-28** (today), e.g. campaign `23791285134` on 2026-07-27: impressions 2547, clicks 52, cost €12.87, conversion_value €128.24, conversions 2.
- **Important finding:** `group_name = 'Thasi'` now returns **3 campaigns**, not the 2 that were hardcoded in the old static page (`23765634627`, `23791285134`, and a new one, `24051146082` — "Pmax | Thasi | Klarna | SUMT | NewProduct | MCV -22/07"). This confirms the live-query-by-`group_name` approach (rather than a hardcoded campaign ID list) is necessary — a static list would have silently missed this new campaign going forward.

## Known consideration

An existing scheduled cloud routine ("Thasitha Req1 Hourly Data Refresh", see `evidence/thasitha/requirement-1-hourly-live-refresh-routine-evidence.md`) rewrites the `DAY`/`CAMPAIGNS`/`MAX_DATE` literals in this file hourly and pushes to git. That routine is now redundant for Requirement 1's live data path (the page no longer depends on those baked values except as a cold-start fallback) but was not disabled as part of this change — disabling/removing it is a separate decision left to the user, since it also serves as the fallback-data source if live Postgres is ever unreachable.

## PASS / FAIL

PASS — live query verified against production Postgres, returns current data (through today), and correctly surfaces a campaign the old static list was missing.
