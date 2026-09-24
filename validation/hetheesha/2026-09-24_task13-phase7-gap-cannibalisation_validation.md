# Validation — Task 13 (Hetheesha) Phase 7: Keyword Gaps + Cannibalisation Analysis

**Date:** 2026-09-24
**Scope:** analysis only (no fixes, Shopify writes, page creation, UI).
Evidence: [[2026-09-24_task13-phase7-gap-cannibalisation_evidence]]

| Check | Result | Evidence |
|---|---|---|
| Approved priority rules applied exactly, none invented | PASS | `_gap_priority` / tests for 600, 599, 100, 99 boundaries; rules documented in code and evidence |
| HIGH transactional gap (>=600) path works | PASS (fixture) | FIXTURE volume 3,600 → HIGH; real data cannot exercise it |
| MEDIUM informational gap | PASS | 19 real MEDIUM (all provisional) + fixture with known volume |
| LOW low-volume gap | PASS (fixture) | FIXTURE volume 40 → LOW, takes precedence over HIGH/MEDIUM |
| NO ACTION mapped + Top 3 | PASS (fixture) | Fixture position 2.4 → NO_ACTION; real data has 0 (best real position 12.28) |
| Same query → two GSC URLs (cannibalisation) | PASS | 9 real cases + fixture; per-URL GSC metrics source-labelled |
| Same primary keyword → two mapped URLs | PASS | Fixture: 1 conflict group `duplicate_primary_keyword_across_clusters` |
| No suitable URL | PASS | 20 Phase 6 NO_SUITABLE_URL → 20 gaps (19 informational + 1 transactional) |
| One URL only → no cannibalisation | PASS | Fixture; slash/case variants collapse to one URL |
| URL A = URL B prevention | PASS | Schema `CHECK (url_a <> url_b)` + unique unordered-pair index + quality check |
| Missing GSC data | PASS | Fixture: no case, no NO_ACTION, counted as `mapped_no_rule_outcome` |
| Missing search volume | PASS | Real: 17 UNDETERMINED (volume `null` + note, never 0, never GSC-substituted) |
| Partial volume treated as lower bound | PASS | Fixture: can prove >= 600, cannot prove < 100 |
| Mapping conflicts surfaced, not resolved | PASS | 18 real groups; all MAPPING_CONFLICT/NEEDS_REVIEW; RESOLVED only with APPROVED mapping (fixture) |
| Gap and cannibalisation kept separate | PASS | CL-0059 has a case and no gap; quality check flags the reverse |
| Duplicate detection (gap / case pair / conflict) | PASS | Unique constraints + `_gap_quality_issues` fixtures |
| Fabricated URL / keyword / GSC-sourced volume rejected | PASS | Quality-check fixtures; live check: 0 selected URLs outside inventory |
| Historical runs preserved | PASS | Run 28 byte-identical after runs 29 and 30; historical count check in quality check |
| Reproducible / deterministic, input not mutated | PASS | Fixture test |
| No Shopify write / no redirect / no external fetch in analysis path | PASS | Code-inspection test + no `graphql`/`requests` in the analysis functions |
| Secrets protected | PASS | No secret in code/output/AIOS; `.env` untouched |
| Phase 3-6 regression | PASS | `_quality_check_clusters(25)` and `_quality_check_mappings(27)` True; Phase 6 tests 24/24; seed dataset still 144 fully classified |
| Live quality check on final run 30 | PASS | `passed: True, issues: []` (36 gaps, 9 cases, 18 conflicts) |
| API contract | PASS | 8 routes registered; list/detail/filter/404 exercised on real data |
| **Priority for volume-dependent rules on REAL data** | **PARTIAL** | Keyword Planner blocked → HIGH/LOW cannot be evaluated; 17 gaps UNDETERMINED, 19 MEDIUM provisional |
| **Informational gaps confirmed as real gaps** | **PARTIAL** | Inventory has no blogs (FR token lacks `read_content`); 12 of 19 are collection-title seeds flagged `QUESTIONABLE_KEYWORD_ORIGIN` |
| Cannibalisation severity thresholds | PARTIAL | Spec gives none; documented heuristic constants chosen here, not an approved rule |

**Overall result: PARTIAL.** Every implemented behaviour is verified (36/36
fixture tests, live quality check, regression, history preservation). PARTIAL —
not PASS — because required inputs remain unavailable: the volume-based rules
cannot be evaluated on real data (Google Keyword Planner blocked), and the
informational-gap evidence is limited by the missing blog inventory and by
upstream seed quality. Per the task's own rule, PASS is not claimed while a
required source is unavailable.

## Tests

`backend/tests/test_hetheesha_task13_gap_analysis.py` — 36 tests, all
in-memory FIXTURES (host `test-fixture.invalid`, fixture volumes are NOT real
data) plus 2 clearly-labelled READ-ONLY regression tests that only SELECT from
stored production runs. pytest is not installed in the venv; run with
`python tests/test_hetheesha_task13_gap_analysis.py`.

## Duplicate-risk review

- **Gap/cannibalisation services:** none existed for Task 13 or the wider
  dm-dashboard (the only "gap" capability, Sajeepan utm_term gap audit, is an
  unrelated Ads tool). New functions live in the existing
  `hetheesha_task13.py`; no parallel module.
- **Tables:** 3 new (`hetheesha_kw13_gaps`, `…_cannibalisation_cases`,
  `…_analysis_conflicts`). Phase 6 `url_mappings.potential_mapping_conflict`
  already held conflict *signals* per mapping row; the new conflicts table
  stores de-duplicated conflict GROUPS per analysis run for reproducibility
  (not a second copy of the same data). Analysis-run bookkeeping reuses
  `hetheesha_kw13_research_runs` (no new run table).
- **API routes:** all under the existing `/api/hetheesha/task13/` router in the
  same file; no second router.
- **Capability records:** searched `capability/` for gap/cannibalisation/keyword
  mapping — no matching capability for Task 13; none created (nothing reusable
  beyond the task itself).
- **Documentation:** Phase 7 evidence/validation/handover follow the existing
  `2026-09-24_task13-phaseN-<slug>_<type>.md` naming; the source map is
  updated in place, not duplicated.

## Deployment

Not deployed. No Vercel/production deployment claimed.
