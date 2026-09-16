## Dilaksi Requirement 07 — Handover

**What was implemented:** An automated Meta Title & Description Audit
inside the existing DM Dashboard, registered as Dilaksi's own
"Requirement 07" tab. Scans every live Shopify product/collection page's
current meta title and description, flags missing/duplicate/over-length
metadata, pulls GA4 organic-traffic sessions for every flagged page,
classifies traffic (High/Low/No GA4 data) against a new configurable
threshold, assigns a priority (HIGH/MEDIUM/LOW/NO ACTION) per the 4
documented rules, and produces a prioritized rewrite backlog. It never
generates, rewrites, or publishes replacement metadata, and never writes
to Shopify — the backlog is the final output.

**Where it is:**
- Backend: `backend/app/dilaksi_meta_audit.py`, routed at `/api/dilaksi/meta-audit/*`, registered in `backend/app/main.py`.
- Frontend: `frontend/src/dilaksi/pages/MetaTitleDescriptionAudit.jsx`, wired into `frontend/src/dilaksi/DilaksiLayout.jsx` as the "Requirement 07" nav item, and into `frontend/src/taskRegistry.js` (task key `dilaksi.MetaTitleDescriptionAudit`) for the UAM grant system.
- Git: committed to `dev-work` branch, commit `6b31d19`. **Not pushed, not merged to main, not deployed** as of this handover.

**How it works:**
1. Click "Run Audit" → `POST /run` starts a background thread (never blocks the request) that pages through Shopify's entire live product+collection catalog (`products`/`collections` GraphQL, ACTIVE only) and one GA4 report call for organic sessions over the last 30 days.
2. Missing (blank/null), duplicate (same value across 2+ different URLs), and length (title >60, description >150 chars) checks run in plain Python against the fetched data.
3. Each flagged page's URL is matched to a GA4 path; unmatched pages show "No GA4 data" rather than an assumed zero.
4. Priority: missing+high-traffic→HIGH, missing+low/no-data→MEDIUM (per the requirement's own Phase 7 mapping), duplicate→MEDIUM, length-only→LOW, clean→NO ACTION — highest applicable rule wins per page.
5. The full result is saved as one JSONB snapshot row (`public.dilaksi_meta_audit_snapshot`) so every other read (`/summary`, `/results`, `/duplicates`, `/length-issues`, `/traffic`, `/backlog`) is instant, no repeat Shopify/GA4 calls, until the next explicit "Run Audit".

**Data sources:** Shopify Admin API (`ledsone_uk` store, existing `shopify_client.py`) for pages/metadata; GA4 Data API (existing `google_client.py`, property `408110563`, organic-search-only, same convention as Dilaksi's own Req1/Req2) for traffic. No Semrush, Keyword Planner, or Google Ads API anywhere in this feature.

**Important logic to know:**
- The 50-session-per-30-days "high traffic" threshold is new (nothing existed to reuse) and is overridable per-request via `highTrafficThreshold` — never a silent rule, always echoed back in every API response.
- A GA4 outage degrades every page to "No GA4 data", never a fabricated zero — mirrors the `GoogleNotConfigured` handling pattern already used elsewhere in `dilaksi.py`.
- Only ACTIVE Shopify pages are audited (matches what a shopper/Google actually sees).

**Current status:** Implementation complete, pipeline logic live-verified against real Shopify+GA4 data (see evidence record — 5,533 real pages audited, 1 HIGH / 2,232 MEDIUM / 1,729 LOW / 1,571 NO ACTION found). Not yet pushed/deployed.

**Known issues:**
- This sandbox couldn't boot the full FastAPI app locally (missing `psycopg_pool` package + broken local Postgres auth, a pre-existing environment limitation unrelated to this feature) — so the actual HTTP route dispatch + Postgres snapshot save/read round-trip hasn't been exercised end-to-end yet, only the logic it calls. Low risk (same proven pattern as several other features this session), but worth confirming once deployed.
- No browser click-through of the new tab was possible in this sandbox — verify visually once live.

**Remaining work:**
1. User approval to push `dev-work` (and, separately, to merge to `main`/deploy).
2. Post-deploy: click "Run Audit" once, confirm the tab renders correctly and the numbers match this handover's figures (or are a sensible live update of them).

**Next step:** See Closure record's "Next Step" section — same 2 items.

**Owner:** Kuberan. **Requester:** Dilaksi (SEO team).
