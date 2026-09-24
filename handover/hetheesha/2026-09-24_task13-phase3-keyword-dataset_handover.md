# Handover — Task 13 (Hetheesha) Phase 3: French Keyword Dataset + Seed Processing

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status:** Phase 3 Keyword Dataset Completed — Classification Pending
(Phases 4–10 not started)

## What was completed

Built and live-tested the French seed keyword dataset pipeline on top of
Phase 2's data sources — seed generation from real ledsone.fr data,
normalization, multi-source provenance merging (no duplicate rows), and
enrichment (GSC metrics, candidate Shopify URLs, Keyword Planner metrics
where available). Strictly data preparation — no classification,
clustering, URL mapping, gap/cannibalisation detection, approval
workflow, or dashboard UI; zero LLM calls.

## Where the code lives

- `backend/app/hetheesha_task13.py` — extended in place (same file as
  Phase 2, no new module). **Uncommitted in dm-dashboard as of this
  handover** — pending coordinator's review/commit to `dev-work` (not
  deployed, not pushed to `main`).

## Dataset — current real status

- **144 real seed keywords** generated: 64 from real Shopify FR
  collection titles (e.g. "Applique murale", "Plafonniers", "Rosaces de
  plafond"), 80 from the top real GSC queries (by impressions) for
  ledsone.fr over the trailing 30 days. No literal UK-to-FR translation,
  no invented categories — every term traces to real data via
  `source_refs`.
- **85 seeds (59%)** enriched with real GSC metrics (clicks, impressions,
  CTR, position, page URL) — status `Partial`.
- **95 seeds (66%)** got real candidate (non-primary) Shopify URLs
  attached from the live 1,178-row FR page inventory.
- **0 seeds** have Keyword Planner metrics — still blocked on the same
  missing `GOOGLE_ADS_*` credential identified in Phase 1/2. Enrichment
  was correctly attempted (batched, 8 calls of ≤20 seeds) and correctly
  reported `BLOCKED_CONFIG_REQUIRED` every time — status `Missing
  Metrics` for these 59 seeds.
- Duplicate handling proven live: the same normalized keyword from two
  different real sources merges into one row with combined provenance,
  never a duplicate row.

## Data model (extended, not duplicated)

`hetheesha_kw13_seed_keywords` gained: `normalized_term` (dedup key),
`status` (Seeded / Enriched / Partial / Missing Metrics / Invalid /
Excluded), `source_refs` (JSONB array of `{source, source_reference}` —
supports the richer Phase 3 provenance taxonomy without needing to widen
the original `source` column's DB constraint), `gsc_metrics` (JSONB,
structurally separate from Keyword Planner data), `candidate_urls`
(JSONB, explicitly labeled non-primary), `run_id`. `run_type` on
`hetheesha_kw13_research_runs` gained a new allowed value
`seed_dataset_build`.

## API endpoints added (all under `/api/hetheesha/task13/seed-dataset/`)

- `POST /build` — generate seeds + run GSC enrichment + candidate URLs in
  one call
- `POST /gsc-enrich` — re-run GSC enrichment for a custom date range
- `POST /candidate-urls` — re-run Shopify candidate URL attachment
- `POST /keyword-planner-enrich` — batch-attempt Keyword Planner
  enrichment (optionally for specific seed IDs)
- `GET /keywords` — list seeds, filterable by `status`/`source`
- `GET /keywords/{id}` — full detail for one keyword (provenance, GSC
  metrics, candidate URLs, Keyword Planner metrics if any)

## Known limitations

- Same Keyword Planner blocker as Phase 1/2 (external Google Ads OAuth
  credential still not provisioned).
- Seed generation deliberately uses collection titles, not individual
  product titles (1,114 of them) — avoids noisy, overly-specific seeds
  per spec section 4's explicit guidance; can be revisited in a later
  phase if product-level seeds are wanted for long-tail coverage.
- Candidate URL matching is a simple substring heuristic (not
  LLM-assisted, per this phase's no-AI rule) — expect some noise; Phase 6
  (URL mapping) is where a more deliberate primary-URL decision belongs.
- France/French Keyword Planner geo/language target constants remain
  live-unverified (same limitation carried over from Phase 2).

## Unresolved blockers

1. Google Ads OAuth credential for Keyword Planner (external action,
   unchanged from Phase 1/2).

## Phase 4 starting point

Phase 4 (Intent + Modifier Classification) can begin directly on this
144-row dataset — `GET /seed-dataset/keywords` gives the full seed list
with GSC metrics and candidate URLs already attached. Reuse Thivajini's
French-proven local LLM pipeline pattern (`thivajini_feed_providers.py`)
per the Phase 1 source map, rather than building a new LLM integration.

## Current status

Phase 3 complete and verified live against real ledsone.fr data. **Do
not proceed into Phase 4 automatically** — awaiting explicit
instruction, per the task's own rule.
