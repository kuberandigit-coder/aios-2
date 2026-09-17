# Source Map — GSC 404 URL Monitor (Dilaksi)

Date: 2026-09-17

## UPDATE (2026-09-17, later same day) — sources changed materially

`inspect_url()`/URL Inspection API and the Sync Monitor registration
were both REMOVED (the automatic scan design was dropped per explicit
instruction in favor of manual CSV/ZIP upload only). Added since:
**local LLM (Qwen3-Next, self-hosted, `LOCAL_LLM_*` credential --
already configured, reused from `alt_text_keywords`)** as the primary
Shopify-matching AI, Gemini (`ai_shared.call_gemini`) only as a
fallback. Added a second dataset/table for the Non-Indexed tab
(`gsc_non_indexed_urls`, GSC Page Indexing export). Original content
below is kept for history (superseded, not deleted).

## Original sources used (superseded, see UPDATE above)

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

## Current sources (2026-09-17, later)

- **Manual GSC exports** (.zip/.csv) — 404 report (Pages → Not found)
  and Page Indexing report ("Crawled - currently not indexed"), both
  uploaded by hand through the UI; no API involved for either, since
  neither report has one (confirmed, see evidence doc).
- **GSC Search Analytics API** — `query_gsc()`, unchanged, traffic
  context only now (not the URL-discovery source it was under the
  removed automatic-scan design).
- **GA4 Data API** — unchanged.
- **Local LLM (Qwen3-Next)** — `LOCAL_LLM_API_KEY`/`LOCAL_LLM_BASE_URL`/
  `LOCAL_LLM_MODEL` in `backend/.env`, same credential already used by
  `alt_text_keywords/ai_alt_text.py` — no new credential. Primary
  Shopify-match AI; Gemini is the fallback only.
- **Shopify Admin GraphQL API** — unchanged, read-only.
- **This app's own Postgres** — `public.gsc_404_monitor_issues` (404
  tab) and `public.gsc_non_indexed_urls` (Non-Indexed tab, new). No
  Sync Monitor table anymore.

## Credentials

None new at any point. `GSC_SERVICE_ACCOUNT_KEY` / `GA4_SERVICE_ACCOUNT_JSON`
/ `LOCAL_LLM_*` in `backend/.env` (gitignored) are the only credentials
involved, all already in place before this task began.

## Confirmed limitation (2026-09-17, later)

Google's URL Inspection tool (the GSC website's own UI) has no
constructable deep-link for a specific URL from outside its own
session -- its `id=` parameter needs an opaque token only Google
generates internally when a URL is searched inside the tool itself.
Live-tested and confirmed broken (real screenshots, 404 response);
removed from the code entirely rather than left as a non-functional
feature.

## Live output (2026-09-17, later)

A real ~1000-URL GSC 404 export was uploaded to production and fully
processed: 220 Shopify replacements found via the local-LLM matcher,
priority distribution 5 High / 90 Medium / 199 Low / 8 Review
Required in one representative run -- this task's core flow has now
been exercised against real data, not just code-reviewed.
