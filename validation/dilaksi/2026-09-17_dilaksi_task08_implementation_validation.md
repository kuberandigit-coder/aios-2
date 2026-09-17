# Validation — Dilaksi Task 08 Implementation (Broken Link / 404 Monitor)

Date: 2026-09-17

Legend: PASS = actually verified live/real. PARTIAL = verified in part or by code inspection only, real gap remains. FAIL = did not work.

| # | Area | Result | Notes |
|---|------|--------|-------|
| T01 | Backend files compile (`py_compile`) | PASS | All 5 new + 1 modified file compiled clean |
| T02 | Frontend builds (`npx vite build`) | PASS | `✓ built in 1.86s`, only pre-existing dynamic-import warnings shared by every dev task |
| T03 | Full FastAPI app imports with new router | PASS | 401 total routes, 9 new `/api/dev/broken-link-monitor/*` routes present, no collision |
| T04 | Screaming Frog CLI reused, not reinstalled/reconfigured | PASS | Same `CLI_PATH` v22.2 confirmed earlier same day, no install/config action taken |
| T05 | Controlled/bounded crawl only, no unrestricted full-site crawl | PASS | List-mode only, 25-URL hard cap enforced in `router.py`'s `start_crawl_endpoint`, no `--max-urls`-style flag exists so list mode is the deliberate bound |
| T06 | Crawl detects real 404 | PASS | Live 2-URL crawl against `https://ledsone.co.uk/` correctly classified a deliberately non-existent product URL as 404 |
| T07 | Crawl ID / start / completion / status / error tracked | PASS | Verified via `schema.get_crawl_history()` after a real crawl — all fields populated correctly |
| T08 | Duplicate simultaneous crawls prevented | PARTIAL | Lock/state pattern mirrors meta_audit's proven `_AUDIT_LOCK`/`_AUDIT_STATE` design exactly and was code-reviewed, but concurrent-request race was not live-tested (would need two simultaneous HTTP calls against a running server) |
| T09 | Broken link fields captured (source, broken URL, status, internal/external, type, first/last seen, crawl ID) | PASS | Verified in real DB rows via `schema.get_issue()` |
| T10 | GSC reuse (no new integration), "No GSC data" honesty | PASS | Live call via `google_client.query_gsc()`, real data returned (12,076 pages); code path for missing data returns `None`, never fabricated |
| T11 | GA4 reuse (no new integration), "No GA4 data" honesty | PASS | Live call via `google_client.fetch_ga4_report()`, real data returned (4,945 paths) |
| T12 | Shopify context reuse, read-only | PASS | Live `graphql()` call correctly identified a removed product; no write call exists anywhere in `enrich.py` |
| T13 | Redirect suggestion only with evidence, never invented | PASS | `suggest_redirect()` returns "No redirect suggestion" for anything without a close handle match; logic reviewed and unit-tested |
| T14 | Priority rules match spec, reused threshold not invented | PASS | Reuses `HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT = 50` from meta_audit; documented substitution of GSC/GA4 for "backlinks" (no Majestic/Ahrefs integration exists in this codebase) |
| T15 | UI: KPIs, crawl status block, table columns, filters, sorting, detail view per spec | PARTIAL | Built exactly to spec using the meta_audit jreq-* template and confirmed to build cleanly; **not** click-tested in a real browser (no live dev-server UI walkthrough was performed in this session) |
| T16 | Review/dev workflow states match spec exactly | PASS | `REVIEW_STATUSES = DEV_STATUSES = ["New", "Reviewed", "Approved", "In Development", "Ready for Validation", "Resolved", "Rejected", "No Action"]`, verified live via `update_review_status`/`update_dev_status` including invalid-status rejection |
| T17 | UAM: taskRegistry entry, grant-gated not staff_key-gated | PASS | `tools.DevBrokenLinkMonitor`, `kind: 'tool'`, no `ownerStaffKey` — identical shape to the Meta Title & Description Audit entry it mirrors |
| T18 | UAM: Dilaksi/granted user sees+opens it | PARTIAL | Mechanism is identical (by code) to every existing granted tool, routed generically through `GrantedTaskView.jsx` by `taskKey` — not live-tested with an actual logged-in Dilaksi session |
| T19 | UAM: unauthorized user cannot see/open without grant | PARTIAL | Same generic mechanism as T18 — not live-tested |
| T20 | UAM: admin/dev sidebar access works | PASS | Sidebar entries added identically in both `AdminLayout.jsx` and `DevLayout.jsx`, which are unconditionally rendered for admin/dev roles (no grant gate on those layouts, matching every other Development Task) |
| T21 | Direct URL access protection is consistent with existing tasks (honest caveat) | PASS (honest) | Confirmed by code inspection: as with every other data endpoint in this app, the new `/api/dev/broken-link-monitor/*` endpoints do **not** enforce JWT/grant checks server-side — isolation is a frontend-routing/grant concern only, exactly matching this app's existing, already-known auth model. This is not a new weakness introduced by this task; it is consistent with the rest of the codebase, and is stated here honestly rather than claimed as stronger than it is. |
| T22 | Page refresh doesn't bypass frontend grant check | PARTIAL | Grant-check logic itself is unmodified and reused as-is (`useGrantedTasks.js`) — not independently live browser-tested for this specific new task |
| T23 | Existing tasks/dashboards unaffected | PASS | `ensure_dev_task_schemas()` run for all 6 dev tasks together with no error; full app import shows 401 routes with no collisions; git diff confined to additive sidebar/import lines plus one new subpackage |
| T24 | No secrets exposed (Shopify token, GSC/GA4 creds, DB password, Screaming Frog licence, private keys) | PASS | Reviewed all new files — no credential is read, logged, or returned anywhere; all secrets stay inside the existing `google_client.py`/`shopify_client.py`/`db.py` modules exactly as before |
| T25 | Database: new tables only, respects `get_conn()` pool, no full-scan-per-page-load | PASS | Only 2 new tables created; dashboard reads via `schema.get_issues()`/`get_summary()` (stored snapshot reads, not live rescans); confirmed via live query against production Postgres |

## Overall

**PARTIAL.** Backend logic, database persistence, and all real external
integrations (Screaming Frog CLI, GA4, GSC, Shopify) are verified live
and working end to end against production systems. The genuine gaps are
all on the "click through it in a real browser" and "log in as an
actual granted/unauthorized user" side (T08, T15, T18, T19, T22) — none
of these were run in this session because no live frontend dev server +
browser + real user session was exercised. This is stated honestly
rather than claimed as a full PASS.
