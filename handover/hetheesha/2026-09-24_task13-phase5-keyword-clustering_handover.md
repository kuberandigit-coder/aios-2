# Handover — Task 13 (Hetheesha) Phase 5: Keyword Clustering

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status / closure:** Phase 5 Keyword Clustering Completed — URL Mapping
Pending (Task 13 itself is NOT complete; Phases 6-10 not started)

## What was completed

Real clustering of the 144 classified seed keywords into 83 clusters
(73 `AUTO_CLUSTERED`, 10 `NEEDS_REVIEW`), each with a candidate primary
keyword, metrics and stable `CL-####` ids. See
[[2026-09-24_task13-phase5-keyword-clustering_evidence]] and
[[2026-09-24_task13-phase5-keyword-clustering_validation]].

## Where the code lives

`backend/app/hetheesha_task13.py` (dm-dashboard, commit `2b9e004`,
`dev-work`, not deployed): `build_clusters()`,
`_quality_check_clusters()`, `_pick_candidate_primary()`,
`_llm_merge_decision()`, plus cluster endpoints under
`/api/hetheesha/task13/`.

## Data structure

- `hetheesha_kw13_clusters` — id, `display_id` (`CL-####`), run_id,
  cluster_name, intent, core_topic, `candidate_primary_keyword_id`,
  status (`AUTO_CLUSTERED` / `NEEDS_REVIEW` / `VALIDATED`), metrics
  (JSONB), notes (flags).
- `hetheesha_kw13_cluster_keywords` — cluster_id, keyword_id, run_id,
  relationship_type (`primary` / `member`), membership_reason; unique on
  `(run_id, keyword_id)` so a keyword has one cluster per run.
- Each clustering run is preserved (`keyword_clustering` in
  `hetheesha_kw13_research_runs`); use the latest run with clusters
  (currently run 25; runs 23/24 are empty development leftovers).

## Important logic

Group by `(intent, core_topic)` — intent is a hard boundary. LLM is only
consulted for near-duplicate core topics. Broad topics are flagged, not
forced. `candidate_primary_keyword` is a candidate only — never
`approved_primary_keyword`, and no cluster is mapped to a URL.

## Known limitations / ambiguous cases

- Singular/plural near-duplicates not merged or flagged (Ampoule vs
  Ampoules; Transformateur vs Transformateurs LED) — treat as merge
  candidates during review.
- 10 broad/ambiguous clusters await human review (Luminaire(s),
  Produits, Éclairage, Lampe, Connecteur fil électrique).
- `total_search_volume` is null everywhere: Keyword Planner still needs
  the Google Ads OAuth credential (external blocker from Phase 1).
- Candidate primary currently favours the shortest exact-topic term, so
  it may not be the highest-demand term once real volumes exist —
  revisit when Keyword Planner data arrives.
- No standalone fixture-based test file yet.

## Phase 6 starting point

Map each cluster's candidate primary keyword to one Shopify URL using the
FR inventory (`hetheesha_kw13_shopify_page_inventory`, 1,178 rows) and
per-keyword `candidate_urls`. Do this only in Phase 6; keep the
"1 primary keyword → 1 primary URL" rule. Consider resolving the
singular/plural merge candidates before mapping to avoid creating two
targets for one topic.

## Not done / not claimed

No deployment, no Shopify writes, no UI, no approval workflow.
