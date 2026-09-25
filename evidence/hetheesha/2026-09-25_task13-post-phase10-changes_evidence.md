# Evidence — Task 13 (Hetheesha): changes after Phase 10 and server results

**Date:** 2026-09-25
**Related:** [[2026-09-25_task13-phase10-final-validation_evidence]],
[[2026-09-25_task13-phase10-final-handover]]

All commits are on `dev-work` (dm-dashboard). Nothing was pushed to `main`.
The results below were read from the live database after the user deployed
and ran the jobs on the Contabo server.

## What changed, and why

| Commit | Change | Reason |
|---|---|---|
| `b8156b7` | Seed dataset widened from Search Console: 180 days, top 2,000 queries, ranked by total impressions per query. Fixed the run-type constraint clash and made the row-count update fail-soft. | The original 144 keywords came from a 30-day / top-150 cap. 7,054 distinct queries exist in 180 days. |
| `117136e` | The full pipeline runs on the server as a Sync Monitor job "Dev — French Keyword Research" (weekly, Run Now, pause). Old manual runner script removed. | Classification takes about an hour; it should not be run by hand. |
| `960619d` | Removed the Monthly Volume, Google Ads Competition and CPC columns from every tab. | Google Keyword Planner is not configured; the columns were always "Unavailable". |
| `fff3b7b` | Keyword list loads all 2,054 keywords with a real total and a compact Search Console summary (2.7 MB instead of about 16 MB). | The page requested at most 500 and the total card showed the last analysis run's count. |
| `44db39a` | The Sync Monitor's first number column shows keywords covered (2,054) instead of the cluster count. | "470" was read as "only 470 keywords ran". |
| `6c1038b` | Shopify refresh added as the first pipeline step; blog article reading written. | Token now has `read_content`. |
| `31d961c` | Opt-in `resume_if_interrupted` on the shared scheduler, enabled for this job only. | A deploy restart killed a running job and left it stopped. |
| `184b323` | Clusters tab reads the newest run that has clusters; Overview run list shows only completed runs. | A run in progress (or cut off) logs an empty clustering entry first, so the tab showed "No clusters". |
| `1979d8a` | Blog read fixed (asked for a non-existent Article field; now uses the article id) and moved into its own Sync Monitor job "Dev — French Keyword Research: Blog Articles" (daily, resumes after restart, fails visibly on error). | The first blog read failed with `Field 'legacyResourceId' doesn't exist on type 'Article'`. |

## Server results (read live, 2026-09-25)

| Item | Result |
|---|---|
| Main job, run started 06:42 | Success, 758 s, 2,054 keywords covered |
| Keywords | 2,054; 2,026 classified; 28 classification errors; about 2,008 with Search Console data |
| Blog job (two runs, 07:02) | Success, about 1 s each, **71 published articles stored** |
| Page inventory | 1,118 products, 65 collections, **71 blog articles** |
| Latest complete clusters | run 684: 467 clusters |
| Latest mappings | run 685: NEEDS_REVIEW 175, CONFLICT 158, NO_SUITABLE_URL 106, AUTO_MAPPED 28 |
| Latest analysis | run 686: 256 gaps, 161 potential cannibalisation cases |

**Important:** the mappings, gaps and cannibalisation above were built at 06:42-06:54,
BEFORE the 71 blog articles were stored (07:02). They do not yet use the blog
pages. The main job must be run again for informational keywords to map to blogs.
That re-run had not happened when these records were written.

## Server-side actions by the user (safe references only)

- The French Shopify Admin API token was replaced with one that has
  `read_content`; set as `SHOPIFY_FR_ADMIN_TOKEN` in the server's `.env`
  (configured server-side, value not recorded).
- Deployed to the Contabo server; the sync restarts after a deploy.

## Not verified

- Informational keywords mapping to the 71 blog articles (needs the main job re-run).
- The Phase 9 review workflow, unauthorized-caller responses and the dashboard
  in a browser (manual testing by the user still pending, per the Phase 10 handover).
- The auto-resume after a real restart (decision logic tested with simulated
  records; no live restart was observed).
