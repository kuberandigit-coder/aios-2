# Source Map — GSC 404 URL Monitor (Dilaksi)

Date: 2026-09-17

## Sources used (all reused, no new credentials/integrations)

- **Google Search Console URL Inspection API** —
  `backend/app/google_client.py`'s `inspect_url()` (new function, same
  `GSC_SERVICE_ACCOUNT_KEY` credential already configured). Returns
  Google's real per-URL crawl/index verdict. One URL per call, no bulk
  mode — see this task's evidence doc for the full audit of why.
- **Google Search Console Search Analytics API** —
  `google_client.py`'s existing `query_gsc()`, site
  `sc-domain:ledsone.co.uk`. Supplies (a) the candidate URL list (every
  URL GSC has traffic data for, since Inspection can't discover URLs
  itself) and (b) clicks/impressions/ctr/position traffic context.
- **GA4 Data API** — `google_client.py`'s existing `fetch_ga4_report()`,
  property `408110563`. Organic-sessions traffic context only.
- **Shopify Admin GraphQL API** — `shopify_client.py`'s existing
  `graphql()`, store `ledsone_uk`. Read-only; used to verify handle
  matches and search for title/handle-similar replacement candidates.
- **This app's own Postgres** — new table
  `public.gsc_404_monitor_issues`; new Sync Monitor snapshot table
  `sales_cache.gsc_404_monitor_snapshot` (auto-created by the shared
  `ScheduledSnapshot` helper).
- **Existing Sync Monitor infrastructure** —
  `backend/app/scheduled_snapshot.py`'s `ScheduledSnapshot` class and
  `backend/app/sales.py`'s generic `/api/sales/sync/*` endpoints.
  Registering scope `gsc-404-monitor` was the only backend change
  needed; no new scheduler or new Sync Monitor endpoint was written.

## Credentials

None new. `GSC_SERVICE_ACCOUNT_KEY` / `GA4_SERVICE_ACCOUNT_JSON` in
`backend/.env` (gitignored, not touched by this task) are the only
credentials involved, already in place before this task began.

## Not yet documented (because not yet run)

- No live scan has been executed against production yet, so there is
  no real output data to characterize (volume of actual 404s found,
  typical match confidence distribution, etc.) — see validation doc.
