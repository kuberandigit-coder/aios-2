# Validation — Internal Linking Suggestion Engine — Page Creation + Step 01 Content Index

Date: 2026-09-18

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | New page appears under Development Tasks | PASS | `AdminLayout.jsx`/`DevLayout.jsx` sidebar `children` include `dev-task-internal-linking` |
| 2 | Dilaksi can access it | PARTIAL | Registered as `tools.DevInternalLinkingSuggestionEngine`; access is granted via the existing UAM admin page (`UserAccessManagement.jsx`) the same way every sibling dev task is — the actual grant toggle is a user action in the live app, not something this session can click. Mechanism confirmed working for identical existing tasks. |
| 3 | UAM works correctly | PASS | Reused existing generic `access_grants` table/endpoints (`backend/app/access_grants.py`) — zero changes made to UAM logic |
| 4 | Unauthorized users cannot access it | PASS (by construction) | Same UAM gate as every other tool; no new/weaker gate introduced |
| 5 | Route works | PASS | Same `AdminLayout`/`DevLayout` tab-panel routing as siblings, verified via `vite build` success |
| 6 | Page loads without errors | PARTIAL | Frontend build succeeds; not yet clicked in a live browser against the deployed server (no server access from this machine this session) |
| 7 | Step 01 loads real data | PASS (design) / PARTIAL (live-unverified) | `GET /content-index` reads only from Postgres; `POST /content-index/refresh` calls live Shopify GraphQL — code path is real, not mocked; not yet exercised against the live server in this session |
| 8 | Blog pages indexed where an approved source provides them | PASS | No approved source exists (see evidence doc's Data Source Audit) — `fetch_blog_pages()` correctly returns `[]`, UI shows 0 with an explicit limitation note, nothing fabricated |
| 9 | Product pages indexed from existing Shopify integration | PASS | `content_fetch.fetch_products()` uses `shopify_client.graphql(store="ledsone_uk", ...)`, the same client every other dev task uses |
| 10 | Collection pages indexed from existing Shopify integration | PASS | `content_fetch.fetch_collections()`, same client |
| 11 | No duplicate pages created | PASS | Grepped `taskRegistry.js`/`AdminLayout.jsx`/`DevLayout.jsx` before adding — no existing "Internal Linking" entry found |
| 12 | URLs handled consistently | PASS | `normalize_url()` lowercases scheme/host, strips trailing slash/fragment, preserves query — same approach as `gsc_404_monitor.enrich.normalize_url`; original URL always stored separately |
| 13 | Missing content is handled safely | PASS | `content_available` is `FALSE` and `content_text`/`content_html` are `NULL` when Shopify's `descriptionHtml` is empty — never a fabricated placeholder |
| 14 | Missing keyword data is not fabricated | PASS | `target_keywords` is always `NULL` (no reliable existing keyword source is wired to product/collection/blog pages) — UI shows "Not available" |
| 15 | No Shopify write operation occurs | PASS | Only `Query` GraphQL operations issued (`_PRODUCTS_QUERY`, `_COLLECTIONS_QUERY`) — no mutation exists anywhere in this package |
| 16 | No credentials exposed | PASS | Shopify token stays server-side in `shopify_client.py` (pre-existing); nothing new added to frontend or AIOS |
| 17 | Existing pages continue to work | PASS (by inspection) | All edits to shared files (`dev_tasks/__init__.py`, `taskRegistry.js`, `AdminLayout.jsx`, `DevLayout.jsx`) were pure additions (new import/route/entry) — no existing line was removed or altered; `vite build` succeeded for the whole app |
| 18 | Steps 02–05 remain inactive/unimplemented | PASS | Frontend renders them as `Locked — Coming Soon` pills, `active: false`; no backend route exists for any of them |
| 19 | No unrelated files modified unnecessarily | PASS | Diff limited to: 1 new backend package (4 files), 1 edited backend file, 1 new frontend file, 3 edited frontend files (registry + 2 layouts) |

## Overall: PARTIAL

Everything within this session's control (code correctness, scope compliance, no fabrication, no
duplication, non-regression by inspection, compile/build success) is PASS. Marked PARTIAL overall only
because: (a) this machine has no live server/browser access to click through the deployed page end-to-end
against real production Shopify data, and (b) the actual UAM grant-to-Dilaksi toggle is a live admin-UI
action for the user to perform, not something this session executes. Both are standing, known limitations
of this environment (see project memory: no SSH access to production server), not defects in the
implementation.

## UPDATE (2026-09-18, later) — Local verification + Blog Pages re-checked

| # | Check | Result | Evidence |
|---|---|---|---|
| 6 (re-check) | Page loads without errors | PASS | Backend/frontend now running locally (port 8199 / 5199); `GET /content-index` confirmed returning real stored data via curl and via FastAPI TestClient |
| 7 (re-check) | Step 01 loads real data | PASS | Confirmed live locally: `internal_linking_content_index` already contains real Collection rows (e.g. "15%", "15-off-1") from a prior refresh; `GET /content-index` reads them correctly |
| 8 (re-check) | Blog pages indexed where an approved source provides them | PARTIAL | User confirmed via Shopify Admin screenshot that blog posts genuinely exist. Live re-check of the `blogs` GraphQL field on 2026-09-18 confirmed `ACCESS_DENIED` still held at that moment — the earlier 2026-09-17 finding was current, not stale. `fetch_blog_pages()` has since been implemented for real (was a documented no-op) and is ready, but the `read_content` scope grant + token reissue was still in progress at last check, so a successful live blog fetch has NOT yet been observed. Re-verify once the new token is in `backend/.env`. |
| 15 (re-check) | No Shopify write operation occurs | PASS | `fetch_blog_pages()` uses only `blogs`/`articles` `Query` fields, same as products/collections — no mutation added |
| 16 (re-check) | No credentials exposed | PASS | Neither the OAuth helper script's Client Secret nor the reissued Shopify Admin API token were pasted into chat or recorded in any AIOS file — user was instructed to edit `backend/.env` directly |

### New finding this update: two local-environment bugs, not app-logic bugs
- Local backend returned HTTP 500 on `GET /content-index` due to a Windows-only `cp1252` console-encoding
  crash when logging Unicode characters present in real Shopify titles/descriptions. Confirmed NOT present
  on the deployed server (Linux, UTF-8 default locale) — user confirmed "the deployed system all working."
  Fixed locally via `PYTHONIOENCODING=utf-8`. No code change was needed or made to the application itself.
- `uvicorn --reload` watching its own redirected log file caused an intermittent restart loop while testing
  locally, affecting ALL pages transiently, not specific to this task. Fixed by dropping `--reload` for
  local testing.

Both are session/environment findings, not regressions introduced by this task's code — recorded here per
the "record honestly" validation standard rather than omitted.

## UPDATE (2026-09-18, later) — Blog Pages check now PASS

| # | Check | Result | Evidence |
|---|---|---|---|
| 8 (final) | Blog pages indexed where an approved source provides them | **PASS** | `read_content` scope confirmed active on the reissued token; `fetch_blog_pages()` fixed (outer `blogs` pagination + correct Article fields, both confirmed via live schema introspection) and verified end-to-end against production: 159 real blog articles indexed. Pushed to `dev-work` (`128fa03`). |

Overall status for this task item moves from PARTIAL to PASS. The task's overall status remains PARTIAL
only for the two items unrelated to this fix: live browser click-through and the UAM grant-to-Dilaksi
toggle, both still pending user action after deploy.

## UPDATE (2026-09-18, later) — Step 02 validation

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Step 01 still works | PASS (by inspection) | No Step 01 file was modified except adding a tab switcher in the frontend; `content-index`/`refresh` endpoints and their code are untouched |
| 2 | Step 02 loads Content Index data | PASS (code) | `link_opportunities._fetch_index_pages()` reads `internal_linking_content_index` directly — no new fetch |
| 3-5 | Blog/Product/Collection pages analyzed | PASS (code) | `_fetch_index_pages()` has no page_type filter — all three types are both eligible sources and targets |
| 6 | Relevant phrases can produce opportunities | PARTIAL | Logic implemented and code-reviewed; not observed producing real output in this session (see below) |
| 7-8 | Existing links detected and excluded | PASS (code) | `extract_link_targets()` + the `already_linked` check in `scan_opportunities()`; excluded from `opportunitiesAfterDeduplication` counts (still stored with `existing_link=True` for transparency/filtering) |
| 9 | Self-links excluded | PASS (code) | `(target["page_type"], target["source_id"]) == src_key` check, Step 10 |
| 10 | Duplicate opportunities handled | PASS (code) | Dedup by `(source, target, anchor.lower())` with `occurrence_count` |
| 11 | Invalid targets excluded | PASS (code) | Targets only come from the Content Index itself — no external/invented targets possible |
| 12 | Relevance scoring is consistent | PASS (code) | Fixed lookup table (`{"exact_title": 90, "product_type": 60}`), deterministic, documented in the module docstring |
| 13 | Reasons generated correctly | PASS (code) | Templated `_reason_for()`, names the actual anchor/target/match type each time — no generic "AI thinks" text |
| 14 | Context displayed correctly | PASS (code) | `context_snippet` (±60 chars around the match) stored and shown in the frontend detail modal |
| 15-16 | No Shopify data/content modified | PASS | `grep`-confirmed no `shopify_client` import anywhere in `link_opportunities.py`; only DB reads/writes |
| 17-18 | Filters and search work | PASS (code) | `filteredOpportunities` memo in the frontend covers source/target type, confidence bucket, link status, and free-text search |
| 19 | Empty/error states work | PASS (code) | "No scan has been run yet" / "No opportunities match filters" / `jreq-error` block, same pattern as Step 01 |
| 20 | UAM remains functional | PASS | No UAM/access-grant code touched |
| 21 | Existing dashboard functionality not broken | PASS (by inspection) | Change is additive to one file + one new backend module; `vite build` succeeded for the whole app |
| 22 | Steps 03-05 remain unimplemented | PASS | No endpoints, no schema, no frontend code for link-density/priority/handoff |

### Overall Step 02 status: PARTIAL

Everything achievable through code review, compile/build checks, and grep-based verification is PASS. Marked
PARTIAL, not PASS, because **a live end-to-end scan run with real output numbers was not observed in this
session** — an earlier version (giant regex) was confirmed too slow against the real 5,938-row production
index; the rewritten tokenized version was pushed to `dev-work` (`952dbe2`) but the user stopped further
local testing before a completed timed run could be captured, opting to test live on the deployed server
instead. This is an honest, deliberate PARTIAL, not a hidden failure — re-verify item #6 (and overall
timing) once the user runs "Find Link Opportunities" live and reports the result.

## UPDATE (2026-09-18, later) — Step 03 validation

| # | Check | Result | Evidence |
|---|---|---|---|
| 1-2 | Step 01/Step 02 still work | PASS (by inspection) | No Step 01/02 file was modified except the shared `extract_link_targets` bug fix (behavior-improving, not breaking — only changes external-link handling) and a frontend tab addition |
| 3 | Step 03 loads correctly | PASS (code) | `GET /density` reads the new table; frontend tab wired |
| 4-5 | Internal links counted correctly / external excluded | PASS (code, bug fixed) | `extract_link_occurrences()` now checks host against `{ledsone.co.uk, www.ledsone.co.uk}` before treating any absolute URL as internal — verified via code review of the exact fix |
| 6 | Self-links handled correctly | PASS (code) | Compared against `(page_type, handle)` of the page itself, tracked in `self_link_count`, excluded from `total_internal_links` |
| 7 | Total link occurrences correct | PASS (code) | `extract_link_occurrences` explicitly returns a list (not a set) — duplicates preserved |
| 8 | Unique target count correct | PASS (code) | Computed via a Python `set` over occurrences |
| 9-11 | Product/Collection/Blog links identified | PASS (code) | Same typed tuples as Step 02's link parser |
| 12 | Duplicate link occurrences handled correctly | PASS (code) | Total vs unique are two separate, correctly-distinguished counts (task section 8) |
| 13-14 | Density status uses correct configured rules / no arbitrary threshold undocumented | PASS | `density_rules.py`'s docstring documents the full audit (no existing rule found) and labels the default explicitly as project config, not fact; every row stores its own `threshold_min/max/source` |
| 15 | Cornerstone data used only when supported | PASS | `cornerstone_status` is hardcoded `"Not Available"` — never guessed |
| 16 | Missing/unknown configuration handled safely | PASS | No configuration lookup can fail silently — constants are Python-level, always present |
| 17 | No fake data | PASS | All KPIs and rows come from `schema.density_summary()`/`list_density()`, reading only real calculated rows |
| 18-19 | Filters and search work | PASS (code) | `filteredDensity` memo covers type, status, and free-text search |
| 20 | Page detail works | PASS (code) | Detail modal renders the exact threshold values and status reasoning per page |
| 21-22 | No Shopify content modified / no automatic links inserted | PASS | Grep-confirmed no `shopify_client` import anywhere in `link_density.py`/`density_rules.py` |
| 23 | UAM continues to work | PASS | No UAM code touched |
| 24 | Existing dashboard functionality not broken | PASS (by inspection) | `vite build` succeeded for the whole app |
| 25-26 | Steps 04/05 remain unimplemented | PASS | No endpoints, schema, or frontend code for suggestion generation or handoff |

### Overall Step 03 status: PARTIAL

Same honest reasoning as Step 02: everything achievable through code review, compile/build checks, and
grep-based verification is PASS, but **no live end-to-end calculation run against the real 5,938-row
production Content Index was performed in this session** — pushed to `dev-work` (`5a5d58b`) for the user
to test live. Re-verify once the user runs "Calculate Link Density" and reports the result.
