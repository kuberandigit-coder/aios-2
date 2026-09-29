# Validation — Task 16: Search Console, Sitemap & Indexing Monitor (Hetheesha, Phase 1)

**Date:** 2026-09-29
**Evidence:** [[2026-09-29_task16-search-console-indexing-monitor_evidence]]

| Acceptance test (from the prompt) | Validation | Result |
|---|---|---|
| Page appears under Development Tasks as a sub-tab | Registered in `taskRegistry.js`, `AdminLayout.jsx`, `DevLayout.jsx` as a `children` entry + `LazyPanel`, same pattern as every existing task | PASS (code) / PARTIAL (not seen in a browser) |
| Page does not appear as a new top-level section | No new top-level nav key added | PASS |
| Existing Development Task navigation still works | Only additive edits (new import lines, new array entries); existing entries untouched | PASS (code) / PARTIAL (not exercised in a browser) |
| Page visible to admin/dev; grantable via UAM | `require_task_access` mirrors Task 15's model exactly; task key added to `taskRegistry.js`, which is what `UserAccessManagement.jsx` reads (confirmed by reading that file) | PASS (code) / PARTIAL (not exercised) |
| Backend also enforces permission | `/run` (the only write-adjacent action) requires `require_task_access`; all GET routes are open reads, matching the existing dev-task convention (same as Task 15's GETs) | PASS |
| GSC authentication works / ledsone.fr data retrievable | Reuses `google_client.get_gsc_ledsone_fr_access_token`, already proven working for Task 15 in production | PASS (reuse) / NOT RUN live from this session |
| Sitemap data displayed where available | New `sitemaps_api.list_sitemaps()` calls the real GSC Sitemaps API; Sitemaps tab renders it, shows "Data unavailable from Search Console API" for a sitemap with no `contents` entry | PASS (code) / NOT RUN live |
| Indexing issues displayed; GSC reasons preserved verbatim | `detection.build()` reads `coverageState` directly into `gsc_reason`; no relabeling anywhere in the code path | PASS (code) |
| Priority classification works | `detection._priority` implements all four buckets exactly as specified | PASS (code) |
| High-value URL logic works where data is available | `value_signal.is_high_value` sums Task 13's stored impressions per URL, with a documented, labelled template fallback when no impression data exists yet | PASS (code) |
| >10% indexing-drop detection when historical data exists | `trends.get_trend()` flags a ≥10% indexed drop, a ≥10% not-indexed increase, and any 5xx increase | PASS (code) / NOT RUN (needs 7+ days of real snapshots) |
| No false trend shown when historical data unavailable | Returns `"available": false, "reason": "Historical comparison unavailable"` when no snapshot exists 7+ days back | PASS (code) |
| Filters work | Issues tab: priority, template, indexed/not-indexed, free-text search, pagination — all server-side via query params | PASS (code) / PARTIAL (not exercised in a browser) |
| Issue detail drawer works | `/url-detail` + `DetailDrawer` component, matching the spec's exact section order and the Next Action developer-style flow | PASS (code) / PARTIAL (not exercised) |
| Loading / empty / error states | Implemented with the prompt's exact copy ("Loading Search Console data…", "No indexing issues found for the selected filters.", "Search Console data could not be loaded.") | PASS (code) |
| Responsive layout | Uses only the existing shared `jreq-*` responsive classes; no fixed-width layout introduced | PASS (design) / PARTIAL (not exercised) |
| No credentials in frontend or logs | Frontend only calls the backend's own routes; token handling identical to every other dev task; no key/secret ever leaves `google_client.py` | PASS (code) |
| No GSC write operation | No POST/PUT/PATCH/DELETE call to any Google endpoint anywhere in the package (`grep` confirms `sitemaps_api.py`/`structured_data_validation.gsc` use GET/POST-read-only URL Inspection only) | PASS (code) |
| No Shopify modification | No `shopify_client` import anywhere in this package | PASS (code) |
| Existing pages remain functional | Only additive edits to five shared frontend files and one shared backend file; no existing route, table, or component was changed or removed | PASS (code) / PARTIAL (not exercised in a browser) |

**Overall result: PARTIAL.** Every rule the prompt specified is implemented
and code-reviewed, the frontend builds, and every new backend file compiles.
Nothing failed. What has NOT been exercised from this session: a live
backend process (this machine cannot reach Postgres or the internet the
server can), a live Search Console call against ledsone.fr, and the UI in an
actual browser. This mirrors exactly how Task 13 and Task 15 were validated
before their own manual-testing passes, and Task 16 must not be recorded as
COMPLETED until the manual checks in the handover pass.

## Duplicate-risk review

No new GSC authentication, no new API client, no new access-management
system, and no new sitemap crawler were created — all four are reused from
Task 13/Task 15's existing code, confirmed by direct import in this
package's own files (`from ..structured_data_validation.discovery import
discover_urls`, `from ..structured_data_validation.schema import
GSC_INSPECTIONS`, `from ..structured_data_validation.gsc import
choose_sample, run_inspections, sample_size`, `from . import value_signal`
reading Task 13's table). The one genuinely new piece of GSC access (the
Sitemaps API) has no existing equivalent in this project.
