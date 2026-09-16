# Capability — Automation Keyword Finder (Sajeepan Requirement 5)

**Date:** 2026-08-24
**Owner:** Kuberan
**Staff/Requirement:** Sajeepan / REQ-DM-2026-08-SAJE01
**Store/Project:** digital-marketing-member-pages / Postgres (`DILAIKSHAN_NEON_DB`)
**Status:** Code complete, live usage unconfirmed (documentation added retroactively during 2026-09-16 AIOS recovery)

## Capability
Given a product SKU, run a Google Lens visual search (via SerpAPI) to find visually
similar competitor listings, capture the results as structured evidence, route them
through a mandatory human review step, and use the reviewed ("INCLUDED") results to
derive keyword frequency/category insights, a Keyword Planner cache, validated
attributes, and final title/alt-text/Ads-keyword output — either on demand or as a
fully automatic weekly 50-product batch.

## What Was Implemented
- Postgres state machine (3 additive migrations) modeling a run's full lifecycle:
  `CREATED -> PREPARING -> SEARCHING_PRODUCTS -> BUILDING_RESULTS -> COMPLETED[_WITH_WARNINGS]/FAILED`,
  with per-product sub-state and an idempotency key so retries/double-clicks never
  double-spend paid SerpAPI credits.
- 20-module application layer (`lib/lens-keywords/`) covering the full pipeline:
  search, caching, quota tracking, human review, analysis, Keyword Planner
  integration, Google Ads output, AI-assisted title/alt-text/attribute generation,
  weekly automation, and export.
- Dedicated frontend tab (Requirement 5) mounted into the existing `sajeepan.html`
  dashboard without disturbing Requirements 1-4.
- A separate migration runner script and a 7-file automated test suite.

## Technical Knowledge
- Deliberately kept the Phase-1 (Lens search) state machine separate from the
  later analysis-phase state, because Stage 3 of the requirement is a human
  gate ("use only INCLUDED competitor results") — merging the two would let
  analysis start before a human has reviewed anything.
- Never stores a raw provider API response or a real API key value — only a
  named key slot and a normalized, allow-listed subset of fields
  (`normalize.js` / `SAFE_RESULT_FIELDS`).
- Weekly automation tracks cache-served vs. real API searches separately
  (`cached_searches_used` vs `searches_used`) so the UI can report honestly
  which work cost real credits.

## Important Rules / Logic
- Every automated Lens match is a candidate, never an auto-validated
  competitor — defaults to `NEEDS_REVIEW`.
- Migrations are additive-only (`IF NOT EXISTS`, no `DROP`/`TRUNCATE`) and
  scoped to the `google_lens_keyword_*` namespace — proven not to touch
  `thivajini_feed_*`, `mahima_stpm_*`, or any operational table.

## Files / Components
See `source-map/2026-08-24_sajeepan-lens-keywords-source-map.md` for the full file list.

## Data Sources / Tools
SerpAPI (Google Lens engine), PostgreSQL (`DILAIKSHAN_NEON_DB`).

## Validation
`node --test` on all 7 test files: 73/77 passed; 4 failed only due to a missing
`pg` dependency in the recovery worktree (not a code defect). See
`validation/sajeepan/2026-08-24_lens-keywords-automation-validation.md`.

## Reuse
The Postgres-run-as-state-machine + idempotency-key pattern is the same one
already used for `thivajini_feed_cycle` and `mahima_stpm_run` — reusable for
any future paid-API-backed batch feature that must survive Vercel Function
timeouts/retries without double-spending.

## Evidence
`evidence/sajeepan/2026-08-24_lens-keywords-automation-schema.md`

## Limitations
Live/production run history is unconfirmed — this capability record documents
what the code can do, not confirmed proof that it has been used.
