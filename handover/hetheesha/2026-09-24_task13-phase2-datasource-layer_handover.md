# Handover — Task 13 (Hetheesha) Phase 2: Data Source Layer

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status:** Phase 2 Data Source Layer Completed — Task 13 Implementation
Pending (Phases 3–10 not started)

## What was completed

Built and live-tested the backend data-retrieval foundation for Task 13,
strictly scoped to data source access — no classification, clustering,
URL mapping, gap/cannibalisation detection, or dashboard UI yet.

## Where the code lives

- `backend/app/hetheesha_task13.py` (new, 587 lines) — all Phase 2 logic.
- `backend/app/main.py` — 2-line router registration.
- Committed on `dev-work` (dm-dashboard repo), commit `83e131f`, pushed.
- **Not deployed** — no Vercel/production push.

## Data sources — current real status

1. **Google Keyword Planner** — code-complete but blocked. The call path
   (`fetch_keyword_ideas_fr()`) reuses the existing OAuth/config helpers
   from `sajeepan_lens_keyword_planner.py`, adds France/French targeting,
   and will work once `GOOGLE_ADS_CLIENT_ID` / `..._CLIENT_SECRET` /
   `..._REFRESH_TOKEN` / `..._DEVELOPER_TOKEN` / `..._CUSTOMER_ID` are set
   in `backend/.env`. Until then it correctly returns
   `BLOCKED_CONFIG_REQUIRED` and writes zero fake data. **This is an
   external/account-access blocker, not a code gap** — provisioning this
   credential is a parallel, non-code action item.
2. **Google Search Console** — fully working. Reads the existing synced
   `google_search_console.query_page` table for `ledsone.fr` directly.
   Live-tested with real data.
3. **Shopify France** — products and collections fully working
   (1,114 + 64 live-confirmed). Blogs/articles blocked — the
   `SHOPIFY_FR_ADMIN_TOKEN` lacks the `read_content` scope. Fix is an
   account/app-permission change (grant that scope), not a code fix.

## API endpoints (all under `/api/hetheesha/task13/`)

- `GET /keyword-planner/status` — reports configured/blocked state
- `POST /keyword-planner/fetch` — attempts a real fetch (blocked today)
- `POST /gsc/fetch` — fetch + normalize real GSC rows for a date range
- `POST /shopify/fetch` — fetch + store real Shopify FR page inventory
- `GET /shopify/inventory` — read back the stored inventory
- `GET /runs` — read research-run history

## Database changes

Four new tables in the app's own database (never the read-only business
DB): `hetheesha_kw13_research_runs`, `hetheesha_kw13_seed_keywords`,
`hetheesha_kw13_keyword_metrics`, `hetheesha_kw13_shopify_page_inventory`.
Full field-level documentation in the source map and in code comments.

## Known limitations

- Keyword Planner: blocked on missing Google Ads OAuth credential (see
  above) — someone with Google Ads account access needs to provision
  this before any real search-volume/competition/CPC data can flow.
- Shopify blogs: blocked on missing `read_content` scope on the FR token.
- France/French Keyword Planner geo/language target-constant IDs
  (`geoTargetConstants/2250`, `languageConstants/1002`) are the publicly
  documented values but have not been live-verified against a real API
  call (no credential to call with yet) — spot-check on first real use.

## Unresolved blockers

1. Google Ads OAuth credential for Keyword Planner (external action).
2. `read_content` scope grant on `SHOPIFY_FR_ADMIN_TOKEN` (external
   action).

## Phase 3 starting point

Phase 3 (Keyword Research Dataset + Seed Processing) can begin on the GSC
and Shopify data already flowing — it does not need to wait on the
Keyword Planner credential, since seed-keyword derivation from real
Shopify categories/GSC queries doesn't require Keyword Planner metrics
(those get attached once the credential exists). Build on
`hetheesha_kw13_seed_keywords`'s existing contract rather than creating a
new seed table.

## Current status

Phase 2 complete and verified live. **Do not proceed into Phase 3
automatically** — awaiting explicit instruction, per the task's own rule.
