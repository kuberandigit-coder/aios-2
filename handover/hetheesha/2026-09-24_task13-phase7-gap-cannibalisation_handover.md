# Handover — Task 13 (Hetheesha) Phase 7: Keyword Gaps + Cannibalisation Analysis

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status / closure:** Phase 7 Gap & Cannibalisation Analysis Completed — UI
Pending (Task 13 itself is NOT complete; Phases 8-10 not started)

## What was completed

An analysis over the stored Phase 3-6 data that produces (a) keyword/page
GAPS, (b) potential CANNIBALISATION cases and (c) MAPPING CONFLICT groups, per
reproducible analysis run. Latest authoritative run: **30** (built from mapping
run 27 / cluster run 25). See
[[2026-09-24_task13-phase7-gap-cannibalisation_evidence]] and
[[2026-09-24_task13-phase7-gap-cannibalisation_validation]] (result: PARTIAL).

## Where the code lives

- `backend/app/hetheesha_task13.py` (dm-dashboard, `dev-work`, not deployed):
  `_analyze_mappings()` (pure decision logic), `_gap_priority()`,
  `_cannibalisation_severity()`, `_derive_mapping_conflicts()`,
  `run_gap_analysis()`, `_gap_quality_issues()` /
  `_quality_check_gap_analysis()`, plus the endpoints below.
- `backend/tests/test_hetheesha_task13_gap_analysis.py` — 36 fixture tests.

## Logic

- **Gaps** come from Phase 6 statuses: `NO_SUITABLE_URL` → a gap typed by
  intent (`TRANSACTIONAL_PAGE_GAP` / `INFORMATIONAL_CONTENT_GAP` /
  `COMMERCIAL_CONTENT_GAP`); `NEEDS_REVIEW` → `MAPPING_REVIEW_REQUIRED`
  (suppressed when a cannibalisation case already exists for that keyword, so
  gap and cannibalisation stay separate). `CONFLICT` mappings are never gaps.
  AUTO_MAPPED/APPROVED with the selected URL at GSC position <= 3 →
  `NO_ACTION` record.
- **Priority** = only the five approved rules (HIGH ×2, MEDIUM, LOW, NO
  ACTION). Anything that needs volume is `UNDETERMINED` while Keyword Planner
  is blocked; `NOT_RATED` = a case no approved rule covers. Never invented.
- **Cannibalisation** = >= 2 distinct LEDSone URLs with GSC impressions for the
  cluster's primary keyword (one case per keyword; URL A/B = top two by
  impressions, ALL URLs kept in `all_urls`). Priority HIGH by the approved rule;
  severity by a documented heuristic (constants `_CANNIB_*` in code, NOT an
  approved business rule). Brand queries are NEEDS_REVIEW.
- **Conflicts** = Phase 6's recorded conflicts de-duplicated per group + tied
  NEEDS_REVIEW candidates. Never resolved automatically.
- **Volume** = derived aggregate of Google Keyword Planner monthly searches
  across a cluster's keywords (may include overlapping demand; not unique
  searchers). `null` + note while blocked.

## Data structure (app DB)

`hetheesha_kw13_gaps` (GAP-####, unique per run+cluster),
`hetheesha_kw13_cannibalisation_cases` (CAN-####, unique per run+keyword+
unordered URL pair, `CHECK url_a <> url_b`), `hetheesha_kw13_analysis_conflicts`
(CFL-####, unique per run+type+key). Analysis runs are
`hetheesha_kw13_research_runs` rows (`run_type =
gap_cannibalisation_analysis`) with all counts + dataset version in `params`.
Runs 28, 29 and 30 exist (development history); use the latest.

## API (all under `/api/hetheesha/task13/gap-analysis/`)

`POST /run` · `GET /runs` · `GET /quality-check` · `GET /gaps` (+priority,
gap_type, intent, record_kind filters) · `GET /gaps/{id}` · `GET
/cannibalisation` (+severity, status) · `GET /cannibalisation/{id}` · `GET
/mapping-conflicts`. Shaped for Phase 8: Keyword, Volume, Intent, Cluster,
Existing URL, Gap Type, Priority, Reason / Keyword, Cluster, URL A, URL B, GSC
evidence, Severity, Status, Reason. No auth beyond the existing router (frontend
gating via the task registry in Phase 8).

## Real results (run 30)

36 gaps (19 informational MEDIUM-provisional, 16 review-required UNDETERMINED,
1 transactional UNDETERMINED), 0 HIGH, 0 LOW, 17 UNDETERMINED for missing
volume, 0 NO_ACTION, 9 cannibalisation cases (5 HIGH severity, 2 MEDIUM, 1 LOW,
1 brand NEEDS_REVIEW), 18 mapping-conflict groups.

## Known limitations / things a human must know

1. **Volume rules cannot be evaluated** until Keyword Planner works: needs a
   Google Ads OAuth credential (external, unchanged since Phase 1). Re-run
   `POST /run` afterwards; HIGH/LOW will then populate automatically.
2. **12 of 19 informational gaps are questionable**: keywords seeded only from
   Shopify collection titles ("Home page", "Horloge", "Tapis de sol", "Rideau de
   douche", "Clients achètent"…) with no GSC evidence, labelled INFORMATIONAL
   by Phase 4. Flagged `QUESTIONABLE_KEYWORD_ORIGIN`. Recommend pruning
   non-lighting/system collection titles from the seed set (Phase 3) and
   re-running Phases 4-7 before the UI phase.
3. **Informational gaps are CANDIDATES**, not confirmed: the FR inventory has no
   blogs (token lacks `read_content`); 2 gaps also have a live GSC URL outside
   the inventory (CL-0061, CL-0083).
4. Cannibalisation evidence uses only the PRIMARY keyword's stored GSC window
   (Phase 3: trailing 30 days); "closely equivalent queries" are not merged
   (no deterministic justification). The spec does not define how many
   impressions count as "ranking", so the HIGH rule is applied to any >= 2 URLs
   with impressions.
5. 12 of the conflicts stem from un-merged Phase 5 singular/plural clusters
   (Ampoule/Ampoules etc.) — merging them upstream removes most.
6. Earlier runs 28/29 lack the `QUESTIONABLE_KEYWORD_ORIGIN` flag by design
   (history is never rewritten).

## Incidental change

`ensure_schema()` now runs once per process (was 8-10 s per endpoint call).

## Phase 8 starting point

Build the Task 13 UI tabs (Overview, Keyword Research, Clusters, URL Mapping,
Gaps, Cannibalisation, Approved Map) against these endpoints, registered via the
existing UAM/taskRegistry for Hetheesha. Show volume as "unavailable" not 0;
show `priority_provisional` and `verification` so reviewers see which gaps are
candidates; keep the human PATCH for mapping approval (Phase 9).

## Not done / not claimed

No deployment, no Shopify writes, no UI, no automatic fixes, no page/blog
creation. Task 13 is not closed.
