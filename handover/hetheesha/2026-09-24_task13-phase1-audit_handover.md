# Handover — Task 13 (Hetheesha) French Keyword Research & Page Mapping — Phase 1

**Date:** 2026-09-24
**Owner:** Hetheesha
**Implementation status:** Phase 1 Audit Completed — Implementation Pending

## What was completed

A full read-only architecture audit of DM Dashboard for Task 13, per the
original Phase 1 requirement
([[2026-09-24_task13-french-keyword-research-page-mapping_original-prompt]]).
No code was written, no database table was created, no production
functionality was touched. Full findings, with file:line citations and live
verification results, are in
[[2026-09-24_task13-phase1-audit_evidence]]; validation results in
[[2026-09-24_task13-phase1-audit_validation]]; source map in
[[2026-09-24_task13-french-keyword-research-source-map]].

## What was discovered (headline)

- **Google Keyword Planner: code exists, not usable yet.** A real
  `KeywordPlanIdeaService` client (`backend/app/sajeepan_lens_keyword_planner.py`)
  is written but requires `GOOGLE_ADS_*` OAuth credentials that are not
  present in `backend/.env` — confirmed live. It also currently targets
  Canada/English; France/French targeting constants would need adding.
- **Google Search Console for ledsone.fr: real data already exists and is
  large/current.** `google_search_console.query_page` (business Postgres)
  has 316,028 rows for `site_url = 'https://ledsone.fr/'`, dated through
  2026-09-21 — live-verified this session. Already used by Thivajini's
  Feed Optimization task, not yet by anything Hetheesha-specific.
- **Shopify France: fully working today.** Live-tested `graphql("ledsone_fr",
  ...)` succeeds now; a synced catalog mirror also exists in
  `listings.shopify_listings WHERE site = 'France'`.
- **Local LLM already proven on French text.** `thivajini_feed_providers.py`
  is a live, working precedent for French-language LLM classification/
  generation — directly reusable pattern for Task 13's intent/modifier
  classification step.
- **No duplicate keyword-clustering table or capability exists anywhere in
  the codebase or AIOS** — confirmed by search before this audit.
- **UAM/registration path is standard and ready** — Task 13 would be one
  `taskRegistry.js` entry + one `HetheeshaLayout.jsx` panel, exactly like
  every other Hetheesha task page already registered.

## Where the relevant code exists

See evidence doc §8 for the full file list. Most load-bearing:
`backend/app/sajeepan_lens_keyword_planner.py` (Keyword Planner client),
`backend/app/google_client.py` (GSC generic client),
`backend/app/thivajini_feed_sql.py` (live ledsone.fr GSC query example),
`backend/app/shopify_client.py` (`ledsone_fr` store registration),
`backend/app/thivajini_feed_providers.py` (French-language local-LLM
precedent), `frontend/src/taskRegistry.js` /
`frontend/src/hetheesha/HetheeshaLayout.jsx` (registration path),
`frontend/src/styles/dashboard.css` (`jreq-*` reusable UI system).

## Important logic / constraints carried into Phase 2

- Never label Google Ads "competition" as SEO difficulty/KD (explicit
  business rule from the original requirement).
- Never treat Google Ads campaign-performance data as a Keyword Planner
  substitute — the two are structurally different data sources
  (`sajeepan_lens_keyword_planner.py`'s own docstring warns about this).
- Any new Task 13 table must go in the app's own DB (`get_conn()`), never
  the business DB schemas — the business DB is read-only to this app
  (independently reconfirmed this session).
- Priority rules must be reproduced exactly as specified (HIGH/MEDIUM/
  LOW/NO ACTION thresholds) — not reinvented.

## Blockers

- **Google Keyword Planner has no usable credential.** Real search
  volume/competition/CPC data cannot be retrieved for ANY keyword (French
  or otherwise) until a Google Ads OAuth app + refresh token is
  provisioned by whoever owns Google Ads API access for this
  organization. This is an external/account-access blocker, not a code
  gap — the client code is ready to use once credentials exist.
- The exact upstream process that originally populated
  `google_search_console.query_page` for ledsone.fr was not located in
  this backend's own scheduled-job code (`gsc_live_sync.py` only covers
  UK) — worth confirming with whoever owns that sync before depending on
  its freshness guarantee long-term (see Gap Report in the full report to
  the user).

## Remaining work / Phase 2 next step

Full Phase 2–10 plan is in the report delivered to the user (not
duplicated here to avoid drift between two copies — see the chat response
this handover accompanies, or ask Hetheesha/dev-lead for the
"# PHASE 1 COMPLETE" report). Immediate next step if greenlit: Phase 2 —
data source layer (GSC live-query wrapper for ledsone.fr, Shopify FR
product/collection fetch, proposed app-DB schema, and the Keyword Planner
credential provisioning request as a parallel/separate action item since it
blocks Step 02 of the original requirement).

## Owner / status

Owner: Hetheesha. Implementation status: **Phase 1 Audit Completed —
Implementation Pending.** No closure record was created for Task 13 itself
(intentional — per the task specification, Phase 1 must not be reported as
a completed task; only this handover + audit trail exist at this stage).
