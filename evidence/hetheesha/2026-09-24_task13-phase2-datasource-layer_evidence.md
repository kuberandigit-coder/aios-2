# Evidence — Task 13 (Hetheesha) Phase 2: Data Source Layer

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase1-audit_evidence]],
[[2026-09-24_task13-french-keyword-research-source-map]]

## Scope

Phase 2 built ONLY the data-retrieval/normalization layer for Task 13 —
no classification, clustering, URL mapping, gap/cannibalisation detection,
or dashboard UI (explicitly out of scope per the Phase 2 spec).

## Files changed (dm-dashboard, commit `83e131f` on `dev-work`)

- **New:** `backend/app/hetheesha_task13.py` (587 lines) — the full Phase 2
  data-source layer.
- **Modified:** `backend/app/main.py` — 2-line router wiring
  (`from .hetheesha_task13 import router as hetheesha_task13_router`,
  `app.include_router(hetheesha_task13_router)`), same pattern as every
  other dev-task router in this file.

No other dm-dashboard files touched. No `.env` changes. No Shopify writes.
No deployment.

## Live test results (2026-09-24, run against real systems)

```
--- Keyword Planner status ---
{'source': 'google_keyword_planner', 'configured': False,
 'missing_config': ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
                     'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN',
                     'GOOGLE_ADS_CUSTOMER_ID'],
 'note': "Google Ads Keyword Planner requires a user OAuth refresh token, ..."}

--- GSC fetch (2026-09-01 to 2026-09-07, limit 5) ---
status: SUCCESS rows: 5
  {'query': 'ampoule baionnette', 'clicks': 0, 'impressions': 81, 'ctr': 0.0,
   'average_position': 4.15, 'page_url': 'https://ledsone.fr/collections/ampoules-b22',
   'site': 'ledsone.fr', 'country': 'fr', 'language': 'fr', 'source': 'google_search_console'}
  {'query': 'abat jour metal', 'clicks': 0, 'impressions': 79, 'ctr': 0.0,
   'average_position': 8.76, 'page_url': 'https://ledsone.fr/collections/abat-jour', ...}
  (+ 3 more real rows)

--- Shopify FR inventory fetch ---
{'source': 'shopify_admin_api', 'status': 'SUCCESS', 'run_id': 4,
 'counts': {'products': 1114, 'collections': 64, 'blogs': 0},
 'blog_status': 'BLOCKED_SCOPE_REQUIRED'}
```

Backend import sanity check: `from app.main import app` → `IMPORT OK`
(confirms the new router doesn't break app startup).

## What each result proves

1. **Keyword Planner**: the provider correctly identifies itself as
   unconfigured (0 fake rows, `BLOCKED_CONFIG_REQUIRED` recorded in
   `hetheesha_kw13_research_runs`) rather than crashing or returning
   invented numbers. This is the expected, correct Phase 2 outcome given
   Phase 1's confirmed credential gap — not a bug.
2. **GSC**: real French search queries with real metrics, scoped
   specifically to `site_url = 'https://ledsone.fr/'`, normalized to the
   spec's exact field contract, explicitly labeled
   `source: "google_search_console"` (never conflated with Keyword
   Planner or presented as search volume).
3. **Shopify France**: a real, current page inventory — 1,114 products +
   64 collections written to `hetheesha_kw13_shopify_page_inventory`.
   Blogs correctly reported blocked (scope issue on the FR token), not
   silently dropped or faked as empty-but-successful.

## Database changes (app's own DB, `get_conn()` — never the read-only
business DB)

Four new tables, all idempotent `CREATE TABLE IF NOT EXISTS`:
- `public.hetheesha_kw13_research_runs`
- `public.hetheesha_kw13_seed_keywords`
- `public.hetheesha_kw13_keyword_metrics`
- `public.hetheesha_kw13_shopify_page_inventory`

Confirmed via the live test run above: 4 real rows now exist in
`hetheesha_kw13_research_runs` (one per fetch attempt, including the
correctly-recorded Keyword Planner `BLOCKED_CONFIG_REQUIRED` attempt), and
1,178 rows in `hetheesha_kw13_shopify_page_inventory` (1,114 + 64, blogs =
0 since blocked).

## Security check

No secrets printed in any test output, code, or this evidence file.
`SHOPIFY_FR_ADMIN_TOKEN` and `GOOGLE_ADS_*` referenced by name only.
`.env` not modified.
