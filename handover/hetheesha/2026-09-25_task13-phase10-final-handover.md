# Final Handover — Task 13: French Keyword Research & Page Mapping (ledsone.fr)

**Owner:** Hetheesha  **Reviewer:** Kuberan
**Date:** 2026-09-25
**Status:** Implementation Complete — Manual Verification Pending.
Task 13 is NOT recorded as COMPLETED yet: the review workflow, authorization
failures and the UI still need the manual checks below, and the work is not
deployed. No closure record was created for that reason.

## What was built

A Development Task that researches French search keywords for ledsone.fr and
turns them into a reviewed keyword-to-page map:
real keywords -> intent and modifiers -> topic clusters -> a suggested page per
cluster -> gaps and potential cannibalisation -> human review -> Approved
Keyword Map. It is read-only toward Shopify: approving records a decision only.

## Where it is

- Page: Development Tasks -> French Keyword Research & Page Mapping
  (task key `tools.DevFrenchKeywordResearch`), seven tabs. File:
  `frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.jsx` (+ `.css`).
- Backend: `backend/app/dev_tasks/french_keyword_research/` (schema, search_console,
  shopify_inventory, seed_keywords, classification, clustering, url_mapping,
  gap_analysis, review, authorization, pipeline, scheduler, router).
  API prefix `/api/dev/french-keyword-research` (41 routes).
- Database (app DB): `french_keyword_research_*` — runs, seed_keywords,
  shopify_page_inventory, clusters, cluster_keywords, url_mappings, gaps,
  cannibalisation_cases, analysis_conflicts, keyword_metrics (empty, unused),
  pipeline_snapshot, review_state, review_history.
- Server job: Sync Monitor entry "Dev — French Keyword Research" (weekly; Run
  Now available). Runs the pipeline steps in order; classification is
  incremental.

## Data sources (actual)

| Source | Use |
|---|---|
| Google Search Console (`google_search_console.query_page`, business DB, read-only) | Seed queries and clicks / impressions / CTR / position, last 180 days |
| Shopify Admin API, ledsone.fr (stored page inventory) | Products and collections, URLs, status |
| Local LLM (Qwen3-Next, Gemini fallback) | Intent, modifiers, core topic, near-duplicate cluster tie-breaks — derived, validated |
| PostgreSQL (app DB) | Persistence and derived analysis |
| Human reviewer | Final approval |

**Google Keyword Planner was not implemented and is not a dependency.** It was
dropped by decision on 2026-09-25. The volume, Google Ads competition and CPC
columns were removed from the dashboard. Dormant code remains in the package
(`keyword_planner.py`, three endpoints, one job step, an empty table); it does
nothing useful and could be removed later.

## Important logic

- One primary keyword -> one approved URL, enforced by a database unique index
  and by a server-side check on approve.
- Review decisions are stored separately, keyed by the normalized primary
  keyword, so weekly re-runs (which recreate clusters and mappings) do not lose
  approvals.
- Every write endpoint checks the login token and requires admin/dev or the
  task's access grant. Reviewer name and time come from the token.
- Priority rules that depend on monthly search volume cannot be evaluated, so
  those gaps show "Undetermined". Intent boundaries keep transactional,
  commercial and informational keywords in separate clusters.
- Cannibalisation is always worded "potential"; candidate primary keywords are
  never presented as approved.

## Current status (live, 2026-09-24 run)

2,054 keywords; 2,026 classified (28 errors); 470 clusters; 470 mappings
(NEEDS_REVIEW 177, CONFLICT 161, NO_SUITABLE_URL 106, AUTO_MAPPED 26,
approved 0); 258 gaps; 162 potential cannibalisation cases; 164 mapping
conflicts. Hetheesha has the access grant.

## Known issues / limitations

1. **Conflict volume.** The GSC-based conflict rule has no minimum threshold,
   so 161 conflicts and 162 cannibalisation cases are probably inflated. A
   minimum impressions / share threshold should be agreed.
2. **Blog and article pages** are missing from the page inventory because the
   French Shopify token lacks `read_content`; informational keywords mostly show
   "no suitable URL". Search Console shows 68 blog URLs as a possible stopgap.
3. **Weekly job** does not refresh the Shopify page list or add new Search
   Console queries; it works on the current snapshot.
4. **Near-duplicate clusters** (singular / plural, for example Ampoule and
   Ampoules) may still be separate.
5. **Candidate URL matching** is simple text matching; only some keywords have
   candidates.
6. **28 classification errors** are left out of clustering until re-run.
7. Some seed keywords come from collection titles that are not real searches.
8. The keyword tab needs about 3 seconds to load 2,054 keywords (2.7 MB).
9. A backend restart during a pipeline run interrupts it; it restarts and keeps
   its classification progress.

## Manual checks remaining (for you)

1. Open the page as Hetheesha and as a user without access; confirm access
   follows the grants.
2. Refresh Data; check Overview, Keyword Research (2,054), Clusters (470),
   URL Mapping, Gaps, Cannibalisation.
3. In Approved Map -> Pending Review: open an item, edit, and try Approve,
   Reject (note required) and Needs Edit (note required); confirm dialogs and
   error messages.
4. Approve one mapping, then try to approve another with the same primary
   keyword — it must be refused. Try a URL that is not in the inventory — refused.
5. Confirm the Approved tab lists only approved rows, with reviewer and date.
6. Confirm the review history for an item.
7. Delete or keep your test decisions afterwards (review tables were empty at
   handover).
8. Confirm the other Development Tasks and staff pages still open normally.

## Not done

Production deployment. No Shopify content or SEO change of any kind.
