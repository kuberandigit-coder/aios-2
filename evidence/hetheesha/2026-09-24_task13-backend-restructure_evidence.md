# Evidence — Task 13 Backend Restructure + Table Rename

**Date:** 2026-09-24
**Scope:** Pure restructure/rename of the already-complete Phases 1-7
backend and Phase 8 frontend base path. No logic, query, status, threshold
or response-shape change. No new feature work.

## What changed

**Code:** moved from the single file `backend/app/hetheesha_task13.py`
(~3,900 lines) into `backend/app/dev_tasks/french_keyword_research/`
(matching the existing dev_tasks package convention — same shape as
`alt_text_keywords/`, `kamsi_blog_title_finder/`, etc.), split by phase:

| File | Lines |
|---|---|
| `__init__.py` | 60 |
| `schema.py` | 515 |
| `keyword_planner.py` | 148 |
| `search_console.py` | 59 |
| `shopify_inventory.py` | 131 |
| `seed_keywords.py` | 375 |
| `classification.py` | 386 |
| `clustering.py` | 406 |
| `url_mapping.py` | 605 |
| `gap_analysis.py` | 686 |
| `router.py` | 748 |
| **Total** | **4,119** |

(Total is higher than the original 3,900 because each module now has its
own header docstring/imports instead of one shared file-level header.)

Wired into `backend/app/dev_tasks/__init__.py`'s aggregate router (same
pattern as every other dev task); the old direct import + include_router
lines for `hetheesha_task13` were removed from `backend/app/main.py`.
Route prefix changed `/api/hetheesha/task13` → `/api/dev/french-keyword-research`
(31 routes, confirmed 1:1 identical sub-paths via `app.routes` before/after).
No username, "test", or "task13" remains anywhere in the new package's
file/module/route names (repo-wide grep confirmed clean except the
intentional legacy-rename lookup table in `schema.py`, which must
reference the old table names to find and rename them).

The two fixture-check test files (`backend/tests/test_hetheesha_task13_*.py`)
were already deleted in an earlier, separate commit (`a8481d2`) at the
user's explicit request — not recreated here.

Phase 8 frontend (`frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.jsx`):
`BASE` constant updated to the new API prefix, comments fixed, the
internal data-fetching hook renamed `useTask13Data` → `useFrenchKeywordResearchData`.

## Database table rename (live data)

All ten `hetheesha_kw13_*` tables renamed to `french_keyword_research_*`
via `ALTER TABLE ... RENAME TO ...` (not drop/recreate), executed as an
idempotent legacy-rename step in `schema.py`'s `ensure_schema()`, running
**before** any `CREATE TABLE IF NOT EXISTS` — this ordering is what
prevents empty duplicate new-named tables from being created while real
data sits under the old names.

| Old table | New table | Row count | Before/after id-list md5 |
|---|---|---|---|
| hetheesha_kw13_research_runs | french_keyword_research_runs | 30 | `24c954d2...` MATCH |
| hetheesha_kw13_seed_keywords | french_keyword_research_seed_keywords | 144 | `5faab0d5...` MATCH |
| hetheesha_kw13_keyword_metrics | french_keyword_research_keyword_metrics | 0 | `d41d8cd9...` MATCH |
| hetheesha_kw13_shopify_page_inventory | french_keyword_research_shopify_page_inventory | 1,178 | `d2e9ce33...` MATCH |
| hetheesha_kw13_clusters | french_keyword_research_clusters | 83 | `edd40100...` MATCH |
| hetheesha_kw13_cluster_keywords | french_keyword_research_cluster_keywords | 144 | `5faab0d5...` MATCH |
| hetheesha_kw13_url_mappings | french_keyword_research_url_mappings | 166 | `7cf91807...` MATCH |
| hetheesha_kw13_gaps | french_keyword_research_gaps | 108 | `a4cda6b8...` MATCH |
| hetheesha_kw13_cannibalisation_cases | french_keyword_research_cannibalisation_cases | 27 | `522e30cf...` MATCH |
| hetheesha_kw13_analysis_conflicts | french_keyword_research_analysis_conflicts | 54 | `f588ebd4...` MATCH |

All 10 row counts and ordered-id-list md5 hashes matched exactly
before vs. after — zero data loss, zero row change. Confirmed no
`hetheesha_kw13_*`-named object remains in the `public` schema and no
empty duplicate tables were created. (Four unrelated pre-existing tables
— `hetheesha_fix_tracker`, `hetheesha_fix_tracker_r2`, `hetheesha_ai_chat`,
`hetheesha_product_snapshot` — belong to other Hetheesha tasks and were
correctly left untouched.)

The existing `run_type` CHECK constraint on the research-runs table was
extended in place (not duplicated) — same convention as every prior phase.

## Verification performed

- `from app.main import app` imports cleanly (both before deleting the old
  file and after — confirmed at each step).
- Route list: 0 routes under the old `/api/hetheesha/task13` prefix, 31
  routes under the new `/api/dev/french-keyword-research` prefix.
- Quality-check functions re-run against real data through the new table
  names, results identical to pre-restructure:
  - `_quality_check_clusters(25)` → 83 clusters checked, passed.
  - `_quality_check_mappings(27)` → 83 mappings checked, passed.
  - `_quality_check_gap_analysis(30)` → 36 gaps / 9 cases / 18 conflicts
    checked, passed.
- `npx vite build` in `frontend/` passes.

Feature/browser testing was NOT performed (deferred per explicit user
instruction) — this is a structural verification only, not a functional
re-test of the business logic itself (which was already verified in
Phases 1-7's own evidence).

## Rollback (not applied — for reference only)

```sql
ALTER TABLE public.french_keyword_research_runs RENAME TO hetheesha_kw13_research_runs;
ALTER TABLE public.french_keyword_research_seed_keywords RENAME TO hetheesha_kw13_seed_keywords;
ALTER TABLE public.french_keyword_research_keyword_metrics RENAME TO hetheesha_kw13_keyword_metrics;
ALTER TABLE public.french_keyword_research_shopify_page_inventory RENAME TO hetheesha_kw13_shopify_page_inventory;
ALTER TABLE public.french_keyword_research_clusters RENAME TO hetheesha_kw13_clusters;
ALTER TABLE public.french_keyword_research_cluster_keywords RENAME TO hetheesha_kw13_cluster_keywords;
ALTER TABLE public.french_keyword_research_url_mappings RENAME TO hetheesha_kw13_url_mappings;
ALTER TABLE public.french_keyword_research_gaps RENAME TO hetheesha_kw13_gaps;
ALTER TABLE public.french_keyword_research_cannibalisation_cases RENAME TO hetheesha_kw13_cannibalisation_cases;
ALTER TABLE public.french_keyword_research_analysis_conflicts RENAME TO hetheesha_kw13_analysis_conflicts;
```

## Security

No secrets touched, exposed, or modified. `.env` untouched. No Shopify
writes. Not deployed.
