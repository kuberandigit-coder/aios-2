# Validation — Task 13 (Hetheesha) Phase 5: Keyword Clustering

**Date:** 2026-09-24
**Scope:** clustering only (no URL mapping/gap/cannibalisation/UI).
Evidence: [[2026-09-24_task13-phase5-keyword-clustering_evidence]]

| Check | Result | Evidence |
|---|---|---|
| Uses the existing Task 13 dataset, no second keyword table | PASS | Reads `hetheesha_kw13_seed_keywords`; only 2 new cluster tables added |
| Same core_topic + same intent → same cluster | PASS | e.g. CL-0051 Abat jour (7 kw), CL-0041 Suspension (9 kw) |
| Same topic, different intent → separate | PASS | 12 topics split across intents in the real data (suspension→3, luminaire→3, abat jour→2…) |
| Different product types → separate | PASS | Ampoule / Suspension / Abat jour / Câble / Transformateur are distinct clusters |
| Multiple modifiers stay in one cluster | PASS | CL-0012 Ampoule holds LED/B22/E14/baïonnette variants together |
| Ambiguous broad keyword → NEEDS_REVIEW | PASS | 10 clusters flagged (luminaire, éclairage, produits, lampe…) |
| One keyword → one cluster | PASS | 144 memberships for 144 keywords; quality check found no duplicates |
| No orphan / nothing dropped | PASS | 144 in = 144 clustered |
| Candidate primary exists in its cluster, not fabricated | PASS | Quality check: 0 `CANDIDATE_PRIMARY_NOT_IN_CLUSTER` |
| No empty / unnamed cluster | PASS | Quality check: 0 issues across 83 clusters |
| Volume aggregate documented as derived, not fabricated | PASS | Stored note; value null while Keyword Planner blocked |
| No URL mapping / primary-URL decision created | PASS | Only per-keyword candidate URLs (Phase 3) referenced; no cluster→URL field |
| LLM only for ambiguous merge, no new LLM service | PASS | Reuses Phase 4 chain; deterministic grouping does the clustering |
| Phase 3/4 fields untouched | PASS | Cluster tables are separate; seed rows not modified |
| Prior runs preserved | PASS | Runs 23/24/25 all retained |
| Secrets protected / no Shopify write / no deploy | PASS | No `.env` change; commit to `dev-work` only |
| Existing app still starts | PASS | `from app.main import app` → `IMPORT OK` |
| Singular/plural near-duplicate handling | PARTIAL | Ampoule/Ampoules and Transformateur(s) not merged nor flagged — documented limitation |
| Automated test suite | PARTIAL | Verification was live against the real dataset plus the in-code `_quality_check_clusters`; no separate fixture-based test file was written |

**Overall result: PASS with documented limitations.** All required
clustering behaviours were verified live on real data. The two PARTIAL
items are honest gaps (near-duplicate handling, no standalone fixture
test file), not failures of the phase's core requirements; the Keyword
Planner blocker from Phases 1-3 remains external and unchanged.
