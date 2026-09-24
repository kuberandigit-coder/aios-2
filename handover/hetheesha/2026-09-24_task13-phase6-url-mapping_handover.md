# Handover — Task 13 (Hetheesha) Phase 6: Primary Keyword → URL Mapping

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status / closure:** Phase 6 Primary Keyword → URL Mapping Completed —
Gap & Cannibalisation Analysis Pending (Task 13 itself is NOT complete;
Phases 7-10 not started). Code is on the working tree of dm-dashboard
awaiting coordinator review/commit; not deployed.

Evidence: [[2026-09-24_task13-phase6-url-mapping_evidence]] ·
Validation: [[2026-09-24_task13-phase6-url-mapping_validation]] (PARTIAL)

## What was completed

A mapping decision for each of the 83 clusters (run 27): 26 AUTO_MAPPED,
20 CONFLICT, 20 NO_SUITABLE_URL, 17 NEEDS_REVIEW, 0 APPROVED, using only
the verified Shopify FR inventory, with GSC as source-labelled evidence.

## Where the code lives

`backend/app/hetheesha_task13.py`: `_evaluate_cluster_mapping()` (pure),
`_apply_cross_cluster_conflicts()` (pure), `_mapping_quality_issues()`
(pure), `build_url_mappings()`, `_quality_check_mappings()`, `_llm_pick_url()`.
Tests: `backend/tests/test_hetheesha_task13_url_mapping.py` (24 fixtures).

## Data structure

`hetheesha_kw13_url_mappings` — unique `(mapping_run_id, cluster_id)`;
`selected_url` (leading candidate or NULL), `mapping_status`
(AUTO_MAPPED/NEEDS_REVIEW/NO_SUITABLE_URL/CONFLICT/APPROVED),
`mapping_reason`, `relevance_evidence`, `gsc_evidence`,
`candidate_urls` (all alternatives), `potential_mapping_conflict`
(`type`, `blocking`), `selected` (true only for AUTO_MAPPED/APPROVED),
`reviewed_by/at`. `url_mapping` added to the research-run CHECK
constraint (single existing constraint block edited, no duplicate).
Use the latest run: currently 27 (26 is an earlier, superseded build).

## API (`/api/hetheesha/task13`)

`POST /url-mappings/build` · `GET /url-mappings` ·
`GET /url-mappings/quality-check` · `GET /url-mappings/{id}` ·
`GET /url-mappings/{id}/candidates` · `PATCH /url-mappings/{id}` (human
review; only path that can set APPROVED; validates the URL is in the
inventory, page-type compatible and an ACTIVE product).

## Conflict types passed to Phase 7

- `gsc_multiple_urls_for_primary_keyword` (8): every URL with impressions
  is listed with clicks/impressions/position; no significance threshold
  was applied (spec gives none) — Phase 7 should decide one.
- `shared_primary_url_across_clusters_same_intent` (12): mostly the
  un-merged Phase 5 near-duplicates (Ampoule/Ampoules, plafonniers/
  plafonnier suspension, support de lampe/support, câbles/cable pour
  lampe, panneaux led/panneau led, connecteurs).
- `shared_primary_url_across_intents` (4, non-blocking annotation).

## Known limitations

- **No blog/page inventory** (FR token lacks `read_content`), and **no page
  content** (titles/handles only). GSC proves real blog articles exist
  (e.g. for CL-0061 "quelle hauteur suspension cuisine", CL-0051), so
  informational NO_SUITABLE_URL results are gap *candidates*, not
  confirmed gaps. Granting `read_content` and re-fetching the inventory
  is the highest-value follow-up.
- Brand queries ("ledsone", typo "ledysone") behave oddly: 14 GSC URLs →
  CONFLICT; typo → NO_SUITABLE_URL. Consider a brand rule.
- `Home page` (CL-0001) is a Phase 3 artefact from Shopify's built-in
  "Home page" collection; that collection (`frontpage`) is excluded as a
  target.
- GSC evidence is the stored per-keyword snapshot (2026-08-25 →
  2026-09-24); many collection-derived seeds have no GSC rows at all.
- The successful PATCH/approve write path is untested against production
  rows. pytest is not installed in the venv (tests run via a minimal
  runner).

## Phase 7 starting point

Turn NO_SUITABLE_URL + CONFLICT rows into gap and cannibalisation
findings using the priority rules in the original spec (HIGH: transactional,
volume ≥ 600, unmapped; HIGH: two URLs rank for one primary keyword — this
data is already recorded; NO ACTION: mapped and ranking Top 3). Volumes
are still null (Keyword Planner blocked), so the volume rule cannot fire
yet. Resolve or merge the Phase 5 singular/plural clusters first.

## Not done / not claimed

No deployment, no Shopify write, no UI, no approval, no gap report.
No new capability record was created (mapping logic is Task-13-specific;
revisit at final closure).
