# Evidence — Task 13 (Hetheesha) Phase 5: Keyword Clustering

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase4-intent-classification_evidence]],
[[2026-09-24_task13-french-keyword-research-source-map]]

## Scope

Clusters only. Explicitly NOT done (out of scope per spec): URL mapping,
primary-URL selection, gap detection, cannibalisation detection,
redirect recommendations, approval workflow, dashboard UI, Shopify writes.

## Files changed (dm-dashboard, commit `2b9e004` on `dev-work`)

- `backend/app/hetheesha_task13.py` only — extended in place. No `.env`,
  no Shopify, no deployment.

## Clustering logic (as implemented)

1. **Deterministic base grouping** by `(intent, normalized core_topic)` —
   intent is a hard clustering boundary, so the same core topic with a
   different intent can never silently merge (spec sections 4-6).
2. **Near-duplicate core topics** (same intent, one topic string
   contained in the other, e.g. singular/plural) are the ONLY case sent
   to the LLM: a validated MERGE/SEPARATE question via the existing
   local-LLM chain (no new LLM service). The LLM never creates clusters.
3. **Ambiguous broad topics** (luminaire, éclairage, produits, lampe…) →
   cluster status `NEEDS_REVIEW`, never force-fit, never dropped.
4. **Candidate primary keyword** (NOT approved, NOT a URL decision):
   exact core-topic match first, then shortest term, then GSC impressions.
5. **Metrics** per cluster: keyword count, GSC clicks/impressions,
   candidate Shopify URL count, intent distribution, and
   `total_search_volume` — documented in-record as a derived aggregate
   that may include overlapping demand, and `null` while Keyword Planner
   remains blocked (no fabricated volumes).
6. **Stable IDs**: `CL-####` display ids from the serial PK; every run
   keeps its own clusters (never overwritten).

## Live results (real Phase 4 dataset, run 25)

- 144 classified keywords in → **83 clusters, 144 memberships** (every
  keyword accounted for exactly once; 0 orphans, 0 duplicates).
- Status: 73 `AUTO_CLUSTERED`, 10 `NEEDS_REVIEW`.
- Real examples: `CL-0012 Ampoule` (15 kw, primary "ampoule baionnette"),
  `CL-0041 Suspension` (9 kw), `CL-0051 Abat jour` (7 kw, primary
  "abat jour metal"), `CL-0010 Transformateurs LED` (4 kw).
- **Intent boundary verified live:** 12 core topics appear in more than
  one intent and each is correctly split into separate clusters (e.g.
  `suspension` → 3 clusters TRANSACTIONAL/COMMERCIAL/INFORMATIONAL;
  `luminaire` → 3; `abat jour`, `transformateur` → 2 each).
- `NEEDS_REVIEW` clusters (10): the broad-topic ones — Luminaires ×2,
  Luminaire ×3, Produits ×2, Éclairage, Lampe — plus one containing a
  Phase 4 `NEEDS_REVIEW` keyword (Connecteur fil électrique).
- `_quality_check_clusters(25)` → `{'clusters_checked': 83, 'passed':
  True, 'issues': []}` (no empty cluster, no unnamed cluster, no keyword
  assigned twice, no orphan classifiable keyword, candidate primary
  always inside its own cluster).

## Real limitations found

- **Singular/plural near-duplicates were not merged or flagged:**
  `CL-0012 Ampoule` (15 kw) vs `CL-0013 Ampoules` (5 kw), and
  `Transformateurs LED` vs `Transformateur` remain separate
  `AUTO_CLUSTERED` clusters. Reviewers should treat these as merge
  candidates in Phase 6/8 review.
- Runs 23 and 24 are empty leftovers from iteration during
  development (recorded `SUCCESS` up-front, 0 clusters); run 25 is the
  complete run. `_record_run` writing `SUCCESS` before work completes is
  a pre-existing Phase 3 pattern, not changed here.
- Search-volume aggregates are all null (Keyword Planner still blocked).

## Bug fixed during the phase

The trailing `row_count` bookkeeping update raised out of an otherwise
fully successful run on a DB blip; made fail-soft (the clusters are
already committed by that point).

## Verification note

Accented characters print as `�` in Git Bash on this machine (console
codepage). Confirmed in Phase 3 via code-point inspection (`0xe9`) that
stored data is correct; not data corruption.

## Security

No secrets in code, output, or this record. No `.env` change.
