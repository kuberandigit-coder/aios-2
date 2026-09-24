# Evidence — Task 13 (Hetheesha) Phase 7: Keyword Gaps + Cannibalisation Analysis

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase6-url-mapping_evidence]],
[[2026-09-24_task13-french-keyword-research-source-map]]

## Scope

Analysis only. Identifies keyword/page GAPS, potential CANNIBALISATION and
MAPPING CONFLICTS from stored Phase 3-6 data. NOT done (out of scope):
automatic fixes, redirects, canonical/metadata/content changes, Shopify
writes, page or blog creation, dashboard UI (Phase 8), Task 13 closure.
No Shopify or Keyword Planner call is made by the analysis.

## Files changed (dm-dashboard, `dev-work`, uncommitted at time of writing)

- `backend/app/hetheesha_task13.py` — extended in place (Phase 7 section,
  3 new tables in `ensure_schema()`, 8 endpoints).
- `backend/tests/test_hetheesha_task13_gap_analysis.py` — new, 36
  fixture-labelled tests.

## Approved priority rules (original Task 13 requirement — no others invented)

| Priority | Rule |
|---|---|
| HIGH | transactional cluster AND monthly search volume >= 600 AND no mapped page |
| HIGH | two ledsone.fr URLs rank for the same primary keyword |
| MEDIUM | informational cluster with no guide/blog page |
| LOW | cluster volume < 100 |
| NO ACTION | keyword already mapped AND mapped page ranks Top 3 |

Two overlaps the spec does not spell out, documented in code: LOW takes
precedence when volume is KNOWN and < 100; a volume built from only some of a
cluster's keywords is a lower bound (it can prove >= 600, never < 100).

## Critical honesty constraint: search volume is unavailable

"Monthly search volume" exists only in Google Keyword Planner, which is still
BLOCKED (no `GOOGLE_ADS_*` credential; `hetheesha_kw13_keyword_metrics` has 0
rows). GSC impressions are a different metric from a different source and are
NEVER substituted. Volume-dependent rules are therefore stored as
`UNDETERMINED` (not guessed). The same analysis re-run applies the >=600 / <100
thresholds automatically once real volumes exist — proven with a clearly
labelled FIXTURE volume (3,600 → HIGH; 40 → LOW), never with real rows.
Volume is returned as `null` + an explicit note, never `0`.

## Analysis run design

Each run is a `research_runs` row (`run_type = gap_cannibalisation_analysis`)
whose params store the mapping run, cluster run and all counts; every result
row carries that `analysis_run_id` and uniqueness is per run, so history is
never overwritten. New tables: `hetheesha_kw13_gaps` (unique per
run+cluster), `hetheesha_kw13_cannibalisation_cases` (unique per
run+keyword+UNORDERED url pair, plus `CHECK url_a <> url_b`),
`hetheesha_kw13_analysis_conflicts` (unique per run+type+key).

## Live results (real data; final run 30, from mapping run 27 / cluster run 25)

| Measure | Count |
|---|---|
| Keywords / clusters / auto-mapped URLs | 144 / 83 / 26 |
| Gaps (record_kind GAP) | **36** |
| — INFORMATIONAL_CONTENT_GAP | 19 (all MEDIUM, all *provisional*) |
| — MAPPING_REVIEW_REQUIRED | 16 (all UNDETERMINED) |
| — TRANSACTIONAL_PAGE_GAP | 1 (UNDETERMINED) |
| HIGH gaps | **0** (needs volume >= 600 — cannot be evaluated) |
| LOW gaps | 0 (needs volume < 100 — cannot be evaluated) |
| Gaps with priority UNDETERMINED for missing volume | **17** |
| NO_ACTION records | **0** (genuine, see below) |
| Potential cannibalisation cases | 9 |
| Mapping-conflict groups | 18 |

All 36 gaps are "volume-provisional or undetermined": the 19 MEDIUM ones would
become LOW if a real volume < 100 arrives.

**NO_ACTION = 0 is genuine.** Only 5 of the 26 AUTO_MAPPED keywords have any GSC
data for their selected URL on the primary keyword; the best average position is
12.28 (`rosace plafond moderne`, CL-0076), so none is Top 3. 21 mapped keywords
have no GSC data for that URL at all.

### Gap examples (real)

- `GAP-0024` / CL-0061 "quelle hauteur suspension cuisine" — INFORMATIONAL,
  MEDIUM (provisional), verification `GSC_SHOWS_LIVE_URL_OUTSIDE_INVENTORY`:
  Search Console shows a live blog URL
  (`/blogs/news/comment-choisir-la-suspension-parfaite-pour-votre-table-a-manger`)
  the inventory cannot see (FR token lacks `read_content`) — a gap CANDIDATE,
  not a confirmed gap.
- `GAP-0036` / CL-0083 "ledysone" — TRANSACTIONAL_PAGE_GAP, UNDETERMINED (brand
  typo; GSC shows the homepage, which is outside the inventory).
- `GAP-0004` / CL-0018 "Luminaires tendance" — MAPPING_REVIEW_REQUIRED,
  UNDETERMINED; `selected_url` is Phase 6's leading UNCONFIRMED candidate.

### DATA-QUALITY FINDING (upstream, reported not hidden)

**12 of the 19 informational gaps are not search queries.** Their primary
keyword came ONLY from a Shopify collection title (source `shopify_collection`,
0 GSC rows) that Phase 4 labelled INFORMATIONAL: "Home page", "Éclairage de
tuyaux", "Transformateur de courant constant", "Ajustement facile", "Rideau de
douche", "Horloge", "Tapis de sol", "Éclairage des conduits", "Crochets et
Anneaux", "Lumières de conduit", "Clients achètent", "Conduit Métallique". Only 7
come from real GSC queries (e.g. "quelle hauteur suspension cuisine", "ip45",
"connecteur electrique"). Phase 7 keeps the approved MEDIUM rule (never silently
drops a gap) but flags these 12 with verification `QUESTIONABLE_KEYWORD_ORIGIN`
and an explicit caveat. Root cause is Phase 3 seeding every collection title
(including non-lighting ones and Shopify's built-in "Home page" collection) plus
Phase 4 classification — recommend pruning these seeds before Phase 8.

### Cannibalisation cases (real, 9 — all from GSC)

Per-URL clicks/impressions/position stored with `source: google_search_console`.
Wording is always "potential cannibalisation based on multiple URLs receiving
visibility for the same query"; a case never says which URL is correct.

| Case | Cluster | Keyword | URLs | Severity | Status |
|---|---|---|---|---|---|
| CAN-…01 | CL-0041 | suspension araignee | 10 (product 378 impr vs collection 277) | HIGH | POTENTIAL |
| CAN-…02 | CL-0051 | abat jour metal | 2 (collection 798 vs blog 282) | HIGH | POTENTIAL |
| CAN-…03 | CL-0054 | lustre araignée | 3 | HIGH | POTENTIAL |
| CAN-…04 | CL-0059 | lampe araignée | 4 (mapping NEEDS_REVIEW) | MEDIUM | POTENTIAL |
| CAN-…05 | CL-0068 | rosace plafond | 2 (collection 261 vs blog 55) | HIGH | POTENTIAL |
| CAN-…06 | CL-0072 | lustre tendance 2026 | 2 | HIGH | POTENTIAL |
| CAN-…07 | CL-0075 | crochet suspension plafond | 3 | MEDIUM | POTENTIAL |
| CAN-…08 | CL-0077 | ledsone (brand) | 14 | NEEDS_REVIEW | NEEDS_REVIEW |
| CAN-…09 | CL-0082 | rosace plafond luminaire | 2 (26 vs 5 impr) | LOW | POTENTIAL |

(Display ids are per run, e.g. run 29 → CAN-0010…; counts identical across runs.)

Priority for every case is HIGH by the approved rule "two ledsone.fr URLs rank
for the same primary keyword", applied literally. **Severity is a separate,
DOCUMENTED HEURISTIC** (the spec gives no numbers): a URL has meaningful
visibility at >= 20 impressions AND >= 10% of the keyword's LEDSone
impressions; HIGH = >= 2 meaningful URLs; MEDIUM = 1 meaningful + another URL
with >= 10 impressions; LOW = 1 meaningful, others < 10; NEEDS_REVIEW = weak
(< 20 total impressions), thinly spread, or a brand query. The brand query
"ledsone" (14 URLs incl. the homepage) is deliberately NEEDS_REVIEW: several
URLs for a brand name is expected. `RESOLVED` never appears (0 APPROVED
mappings exist). CL-0059 is the only cannibalisation cluster whose Phase 6
status was NEEDS_REVIEW; it carries a case and NOT a gap, keeping gap and
cannibalisation separate.

### Mapping conflicts (18 groups, none resolved)

8 `gsc_multiple_urls_for_primary_keyword` (same 8 as the cases minus CL-0059),
2 `no_single_primary_url_selected` (CL-0067 "suspension lustre", CL-0081
"ampoule bougie"), 6 `shared_primary_url_across_clusters_same_intent`
(mostly Phase 5 singular/plural leftovers: CL-0012/0013 → ampoules-b22,
CL-0016/0080 → cables, CL-0034/0053, CL-0023/0062, CL-0008/0057, CL-0009/0060),
2 `shared_primary_url_across_intents` (non-blocking → NEEDS_REVIEW:
CL-0004/0056 → applique-murale, CL-0025/0076 → rosaces-de-plafond).

## Validation evidence

- `_quality_check_gap_analysis(30)` → `passed: True, issues: []`
  (gaps 36, cases 9, conflicts 18, historical runs checked 3).
- Regression: `_quality_check_clusters(25)` True, `_quality_check_mappings(27)`
  True, Phase 6 fixture tests 24/24.
- Fixture tests: 36/36 (see validation record).
- History preserved: after a second real run (29), every row of run 28 was
  byte-identical (36 gaps / 9 cases / 18 conflicts, same display ids/priorities/
  reasons). Runs 28 and 29 predate the `QUESTIONABLE_KEYWORD_ORIGIN` flag and
  are intentionally NOT rewritten; run 30 is the authoritative one. Three
  near-identical runs (28/29/30) now exist as history from development.
- API (`/api/hetheesha/task13/gap-analysis/…`): 8 routes registered
  (POST run; GET runs, quality-check, gaps, gaps/{id}, cannibalisation,
  cannibalisation/{id}, mapping-conflicts); filters and a 404 verified.

## Incidental performance fix

`ensure_schema()` (called by every endpoint) cost 9.5 s and 8.1 s per call
against the remote DB (measured). It now runs once per process (0.0 s
afterwards; first call 9.2 s); the schema only changes when new code ships.
Affects all Task 13 endpoints (Phases 2-7), all faster.

## Security

No secrets in code, output or this record; `.env` untouched; no Shopify write;
no deployment.
