## Purpose
Evidence for Sajeepan Requirement 3 (Feed & PPC Product Action Dashboard) and Requirement 4 (Feed Optimisation Opportunity, with a persistent optimisation tracker) built in the new local `dm-dashboard` app (React + FastAPI), porting the old `pages/sajeepan.html` panels 3 and 4 one-for-one.

## What was built
- **Req3** — `backend/app/sajeepan.py::req3`, frontend `frontend/src/sajeepan/pages/ProductActionDashboard.jsx`. Morning Revenue Risk (OOS bestsellers, limited campaigns, sudden drops, cross-platform low-visibility), PPC Product Action Dashboard (9-band ROAS classification with editable thresholds), Duplicate Product Findings (same-ID-multiple-campaigns; title/merchant-ID duplicates explicitly marked "Not available" — `google_ads.merchant_products` has no data for these two sub-features once feed_label-scoped, no viable substitute in `listings.shopify_listings`).
- **Req4** — `backend/app/sajeepan.py::req4` + `req4/tracker-save` + `req4/tracker-detail`, frontend `FeedOptimization.jsx`. 3-level product classification (Critical Waste / Low ROAS / Watch List), collapsible help panel, drawer-based optimisation tracker with Before-vs-After comparison. New Postgres table `public.feed_optimization_tracker` in the app's own DB (`DATABASE_URL`), mirroring the old system's Neon `AUTH_DATABASE_URL` table.

## Checks performed
1. `curl` against all 5 new endpoints (`/req3`, `/req4`, `/req4/tracker-save`, `/req4/tracker-detail`) with real date ranges — confirmed 200 responses with real DB-backed numbers (e.g. Req3: 41 OOS bestsellers, 500 ROAS-banded products, 100 duplicate-campaign items; Req4: 130/10/31 products across the 3 levels).
2. End-to-end tracker round-trip: saved a test tracker row (`optimization_started=true`, `start_date=2026-08-01`), confirmed `tracker-detail` returned real before/after windows (`£11.67`/`560% ROAS` before vs `£7.88`/`0% ROAS` after), then deleted the test row so it doesn't appear as fake production data.
3. Caught and fixed a page-size swap during review (`R3_OOS_PG`/`R3_PG` were 50/25 in the old JS; I'd coded them backwards) before calling Req3 done.
4. Caught and fixed 3 backend bugs surfaced only by live testing: missing `updated_at` column and unique constraint on the pre-existing `feed_optimization_tracker` table (from an earlier session), and a `text = bigint` param-type collision in the tracker-detail query (fixed by casting to text instead of bigint).
5. `npx vite build` — clean build after each requirement, no new errors introduced.

## Result
PASS — both requirements built, live-tested against the real business Postgres DB, and wired into the sidebar + admin Requirement Pages directory (reqCount 2 → 4).

## Outstanding
Sajeepan Requirement 5 (Automation Keyword Finder / Google Lens Search Keywords) intentionally deferred — needs a `SERPAPI_KEY` not currently configured, same reasoning as the AI-chat features skipped elsewhere. Left disabled in the sidebar with a "not built yet" note.

## Reviewer
Kuberan
