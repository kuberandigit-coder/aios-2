# AIOS Capabilities -- Master Reference

Consolidated 2026-10-08 from 22 separate dated capability files (see git history for the original per-file versions). Each section below is one reusable capability, in the order it was first documented (oldest first).

## Index

- [Capability — Vercel Serverless Function Consolidation (Query-Param Dispatch)](#capability--vercel-serverless-function-consolidation-query-param-dispatch)
- [Capability — New "DM" Google Ads Tab (Shop_DM_PMax-46_AguAsset / Our_Hreo)](#capability--new-dm-google-ads-tab-shop_dm_pmax-46_aguasset--our_hreo)
- [Capability — Hourly Snapshot Auto-Refresh Workflow (GitHub Actions)](#capability--hourly-snapshot-auto-refresh-workflow-github-actions)
- [Capability — IndexedDB Live-Data Persistence Pattern](#capability--indexeddb-live-data-persistence-pattern)
- [Capability — 3-Period Product Comparison (Jefri Requirement 3 / T-03)](#capability--3-period-product-comparison-jefri-requirement-3--t-03)
- [Capability — Kamsi Organic Sales Rule (Reusable Prompt)](#capability--kamsi-organic-sales-rule-reusable-prompt)
- [Capability — Shopify Access-Scope Error Diagnosis + Unbounded-Scan Timeout Guard](#capability--shopify-access-scope-error-diagnosis-+-unbounded-scan-timeout-guard)
- [Capability — utm_term Deep-Search Fix + Paid-Search Unclaimed-Gap Audit](#capability--utm_term-deep-search-fix-+-paid-search-unclaimed-gap-audit)
- [Capability — Sonya Google Ads Tab Monthly Snapshot Backfill (Jan-Jul)](#capability--sonya-google-ads-tab-monthly-snapshot-backfill-jan-jul)
- [Capability — Meta UK Tab + Cross-Tab Order Overlap Discovery Method](#capability--meta-uk-tab-+-cross-tab-order-overlap-discovery-method)
- [Capability — Standalone Order-Level Sales Page with Mutually-Exclusive Groups](#capability--standalone-order-level-sales-page-with-mutually-exclusive-groups)
- [Capability — Priority-Ordered Group Matching + Dual-Repo Deploy Hazard](#capability--priority-ordered-group-matching-+-dual-repo-deploy-hazard)
- [Capability — Feed Optimization (Thivajini, DM-2026-08-THIV01)](#capability--feed-optimization-thivajini-dm-2026-08-thiv01)
- [Capability — Search Term -> Product Mapping (Mahima, REQ-DM-2026-08-MAHI01)](#capability--search-term-->-product-mapping-mahima-req-dm-2026-08-mahi01)
- [Capability — Automation Keyword Finder (Sajeepan Requirement 5)](#capability--automation-keyword-finder-sajeepan-requirement-5)
- [Capability — Automated SEO Metadata Audit and Traffic-Based Prioritization](#capability--automated-seo-metadata-audit-and-traffic-based-prioritization)
- [Capability — Broken Link / 404 Monitor via Screaming Frog CLI](#capability--broken-link--404-monitor-via-screaming-frog-cli)
- [Capability — GSC 404 URL Monitor (via Search Console URL Inspection API)](#capability--gsc-404-url-monitor-via-search-console-url-inspection-api)
- [Capability — LEDSone Content Index (Step 01 of Internal Linking Suggestion Engine)](#capability--ledsone-content-index-step-01-of-internal-linking-suggestion-engine)
- [Capability — AI FAQ Schema (JSON-LD) Generation Pattern](#capability--ai-faq-schema-json-ld-generation-pattern)
- [Capability — Anti-repeat "Regenerate" pattern for local-LLM content generation](#capability--anti-repeat-regenerate-pattern-for-local-llm-content-generation)
- [Capability — Search Console Sitemap & Indexing Monitor Pattern](#capability--search-console-sitemap-&-indexing-monitor-pattern)

---

# Capability — Vercel Serverless Function Consolidation (Query-Param Dispatch)

**Date:** 2026-07-22
**Owner:** Kuberan
**Project:** `reports/digital-marketing-member-pages` (Vercel Hobby plan)
**Status:** Active, in continuous use

## Capability

Keep an unlimited number of logically-separate API endpoints running on Vercel's Hobby-plan
12-serverless-function cap by merging many original handler files into a small, fixed number of
base files (`api/sales.js`, `api/requirement.js`), each dispatching internally on a query
parameter (`?entity=...` or `?fn=...`) to an isolated, originally-independent handler — instead of
adding a new `.js` file (and therefore a new serverless function) for every new staff
requirement/report.

## What problem it solves

A push to the connected `Staff-requirements` GitHub repo failed to auto-deploy once the project
grew to 15 separate API files — Vercel's Hobby plan hard-caps serverless functions at 12. Every
staff requirement/report had historically been given its own new `.js` file, which is not
sustainable long-term on this plan.

## Originating task

`evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md` — merged 15 files
down to 2 (`sales.js`, `requirement.js`) the same day the 12-function cap first caused a failed
deploy.

## Technical implementation

1. Each source file independently declared identically-named top-level helpers
   (`STORE_DOMAIN`, `TOKEN`, `sleep`, `shopifyGraphQL`, `base64url`, `getAccessToken`, etc.) — a
   naive text concatenation throws `SyntaxError: Identifier has already been declared`.
2. Fix: wrap each original file's entire content in its own IIFE
   (`const xHandlerModule = (function() { ...entire original file...; return xHandler; })();`),
   isolating every top-level declaration into that closure's private scope, and rename its
   exported handler to a uniquely-named local function first.
3. Insert the wrapped module into the target base file, after its `require()` lines.
4. Add dispatch logic at the very top of the base file's own exported handler: a new query param
   routes to the matching wrapped handler; **no param falls through to the base file's own
   original logic unchanged** — this preserves every existing caller's URL with zero change.
5. For a large merge (4,600+ combined lines), write a small Node script to do steps 1-4
   mechanically rather than hand-editing.

## Dispatch convention established

- `api/sales.js` — `?entity=<name>` (e.g. `dilaksi`, `jackson`, `kamsi`, `sukirtha-uk`); no
  `entity` param preserves the original `?staff=...` behavior.
- `api/requirement.js` — `?fn=<name>` (e.g. `check-urls`, `kamsi-live`, `req2-req3`,
  `req4-ga4-seo`, `jefri-product-status`, `jefri-req3`, `sukirtha-r6`); no `fn` param preserves
  the original `?store=uk|de` behavior.
- New requirements since the original merge have **continued to be added as new `?fn=`/`?entity=`
  values inside these same 2 files**, not as new top-level `.js` files — confirmed by direct grep
  across 35 later task records (jefri req1-7, mahima req3/req5, dilaksi req2-4, Kamsi req4,
  thasitha req1/2/3/6, sukirtha R6, salesuk) that all reference this dispatch pattern.

## Validation performed at the originating task

`node --check` on both merged files; a local mock `req`/`res` dispatch test confirming every
entity/fn value reaches its own distinct logic (not a collision or wrong-handler route); live
post-deploy verification of representative routes returning HTTP 200 with correct data.

## Important business rule

**`vercel.json`'s `functions` block must be kept in sync** whenever a file is added/removed/
renamed — this was updated twice during the original consolidation as files were removed.

## Dependencies

Vercel Hobby plan's 12-function limit (the reason this pattern exists at all); the two base files
must stay the only two API entry points for this project unless the plan changes.

## Reuse

Any future staff requirement/report for this project should be added as a new dispatch value
inside the existing `sales.js`/`requirement.js`, never as a new top-level API file — this is the
standing convention, not a one-time fix. The IIFE-wrapping technique itself (isolate a whole file's
top-level scope, rename its handler, dispatch by query param) is also reusable for any other
Node/Vercel project facing the same per-file-function-count constraint.

## Evidence

`evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md`

## Where it is used (confirmed via grep, not exhaustive)

`evidence/jefri/2026-07-22_req2-search-terms-labels-evidence.md`,
`2026-07-24_req3-3period-comparison-evidence.md`, `2026-08-12_req5-cross-campaign-attribution-evidence.md`,
`2026-08-13_requirement-5-cross-repo-sync-bug-and-permanent-fix.md`,
`2026-08-14_req6-image-update-live-sales-tracker.md`, `2026-08-19_req7-bq-amazon-shopify-reconciliation.md`;
`evidence/mahima/2026-07-23_req3-search-terms-live-relocation.md`,
`2026-07-29_requirement-5-product-id-coverage-evidence.md`;
`evidence/dilaksi/2026-07-23_req3-live-attempt-reverted.md`, `2026-07-24_req2-indexeddb-persistence.md`,
`2026-08-24_dilaksi_req4_content_gap_evidence.md`;
`evidence/Kamsi/2026-07-23_kamsi-req4-live-summary-cards.md`;
`evidence/thasitha/2026-07-28_requirement-1-live-refresh-evidence.md`,
`2026-07-28_requirement-3-live-refresh-evidence.md`, `2026-07-29_requirement-2-live-refresh-evidence.md`,
`2026-08-10_requirement-6-keyword-seo-gap-discovery.md`;
`evidence/sukirtha/SUK-R6-field-mapping.md`, `SUK-R6-shopify-source-map.md`;
`evidence/salesuk/2026-08-24_tiktok-august-uk-first-session-check.md`.

## Limitations

This capability record was written retroactively (2026-10-08, AIOS full capability backfill) from
the originating evidence file plus a grep-based cross-reference of later usage — the 35 usage
references above were found by searching for the string `fn=`/`entity=` across existing evidence/
handover docs, not by individually re-reading each one in full. The pattern's continued correct
use in each of those tasks is therefore NOT individually re-verified by this record; it relies on
each task's own evidence/validation already having passed at the time.

---

# Capability — New "DM" Google Ads Tab (Shop_DM_PMax-46_AguAsset / Our_Hreo)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** New tab, staff name not yet confirmed against a real person (see Limitations)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (Jan-Jun backfilled, July live)

## Capability
Stand up a brand-new Google Ads staff attribution tab from a campaign identified as "unclaimed" by the paid-search gap audit, in the same afternoon it was discovered, using the established Sonya/Sajeepan/Theekshy tab template.

## What Was Implemented
New tab on `sales.html` for campaign `Shop_DM_PMax-46_AguAsset`/`Our_Hreo`, matching the existing tab pattern exactly: same backend dispatch shape in `api/sales.js`, same frontend structure, `dm`-prefixed globals. Jan/Feb/Mar-Jun snapshots generated same day; July live by design.

## Technical Knowledge
- Adding a new staff tab is now a templated, same-day operation: identify campaign → add backend handler block with campaign/term match → add frontend tab mirroring an existing one → backfill historical months via a bulk-refresh script → verify live for the current month.

## Important Rules / Logic
- Historical months get static snapshots (fast, no live Shopify scan); the current/live month is always fetched fresh — this convention is uniform across all Ads staff tabs (Sajeepan, Theekshy, Sonya, DM).

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `reports/digital-marketing-member-pages/api/data/dm-uk-ads-sales-2026-0{1-6}.json`

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `ca1ba6a`, `e3d2ef5`, `e507636`, `c812ee1` — not independently re-tested live in this sync.

## Reuse
Template for any future newly-discovered unclaimed campaign found via the gap-audit capability.

**New consumer (2026-10-07):** Blog HTML Automation's keyword-suggestion feature reads
`google_ads.campaign_search_term_data`/`google_ads.campaigns` directly (`inputs.py`, commit
`0f2330a`) — a read-only reuse of the same `google_ads` schema, no new write path. See
`source-map/2026-10-07_blog-html-automation-step1-audit_source_map.md`.

## Evidence
`evidence/digital-marketing-member-pages/2026-07-24_dm-google-ads-tab-and-backfill.md`

## Limitations
"DM" is used as a placeholder/short label matching the campaign name (`Shop_DM_PMax-46`) — not confirmed to be a real staff member's name or initials. Manual verification required before treating this as a permanent staff identity in the dashboard.

---

# Capability — Hourly Snapshot Auto-Refresh Workflow (GitHub Actions)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** All 14 sales-dashboard member tabs + Jefri/Mahima Postgres tabs
**Store/Project:** digital-marketing-member-pages (Vercel) / GitHub Actions
**Status:** Partial — built and committed same day, then found deleted (uncommitted) from the working tree by the time of this AIOS sync; disposition unresolved

## Capability
A scheduled job that regenerates all live-month sales snapshots and the Postgres-backed Jefri/Mahima snapshots every hour, then redeploys to Vercel production automatically, without a human needing to run `generate-snapshots.js` manually or remember to redeploy.

## What Was Implemented
`.github/workflows/hourly-sales-snapshot-refresh.yml`: cron-triggered hourly, runs `node api/scripts/generate-snapshots.js july` and `... postgres` (which call the deployed site's own API endpoints with `?refresh=1` — no separate Shopify/Postgres credentials needed in the workflow itself), commits the updated `api/data/*.json` files, and redeploys to Vercel prod.

## Technical Knowledge
- The snapshot-generation scripts are designed to call the *deployed* site's own API (not local credentials), which is what makes them safe to run from a CI runner with only `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` as secrets — the actual Shopify/Postgres auth stays server-side on Vercel.
- A near-identical workflow was added and then removed the previous day (2026-07-23, commit `f662096`) because it had been added to the wrong repo (`aios-2` instead of `Staff-requirements`). Today's version was again removed from the working tree (uncommitted) before this sync ran, with no commit message explaining why — this may be a repeat of the same wrong-repo issue, or something else entirely. **Not confirmed either way.**

## Important Rules / Logic
- Any snapshot-refresh CI workflow that regenerates and commits data files must live in the repo whose deployment it's supposed to keep in sync with — verify the target repo before adding, given this has gone wrong twice now.

## Files / Components
- `.github/workflows/hourly-sales-snapshot-refresh.yml` (status: not present in working tree as of 2026-07-24 sync time — see Limitations)
- `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js` (has an uncommitted addition of `jefri-req3`/`mahima-search-terms` Postgres targets as of this sync)

## Data Sources / Tools
GitHub Actions, Vercel CLI/API, the deployed site's own `/api/*?refresh=1` endpoints.

## Validation
Not independently re-verified — the workflow's own commit (`17dc616`) states its design but there is no evidence in this sync that it ever executed successfully before being removed from the working tree.

## Reuse
The `?refresh=1`-based, no-separate-credentials CI pattern is reusable for any other scheduled snapshot job, provided the wrong-repo mistake from 2026-07-23/24 is avoided.

## Evidence
`evidence/sales/2026-07-24_hourly-workflow-and-indexeddb-rollout.md`

## Limitations
As of this sync, the workflow file does not exist in the working tree — this capability is **not currently active**. Manual verification required before relying on it.

---

# Capability — IndexedDB Live-Data Persistence Pattern

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Kamsi (Req1/4/5/6), Dilaksi (Req2), Jefri (Req1/Req2), Mahima (Req1/Req2/Req3) — rolled out dashboard-wide to all 14 `sales.html` tabs
**Store/Project:** digital-marketing-member-pages (Vercel)
**Status:** Completed

## Capability
Any live-fetched dataset (Shopify GraphQL or Postgres-backed) on a member requirement page can survive a full page reload/navigation-away-and-back without refetching or falling back to a stale hardcoded/static snapshot.

## What Was Implemented
A shared client-side IndexedDB cache pattern (`idbOpen/idbGet/idbSet`, single `'kv'` object store per page, e.g. `kamsi_cache_db`, `dilaksi_cache_db`, `jefri_cache_db`, `mahima_cache_db`) that:
- Persists fetched rows/summary on a successful Refresh.
- Restores automatically on page load, showing a "(restored)"/"[restored]" chip.
- On Jefri specifically, compares the restored payload's `generatedAt` against any background freshness-check response so a stale hourly-snapshot fallback never silently overwrites a more recent restored result; a forced manual Refresh always wins regardless.
- Avoids a loading-spinner flash on restored data (guard: reset the loading/error UI only when `force` is true or nothing is already showing).

## Technical Knowledge
- sessionStorage/localStorage were tried first (Kamsi, same day) and abandoned — payloads of thousands of rows / multiple MB of JSON can silently exceed browser storage quota, throwing a `QuotaExceededError` that a naive `try/catch` swallows with no visible failure. IndexedDB has no such practical ceiling at this data size.
- The pattern originated on `sukirtha.html` (pre-existing, proven) and was ported without modification to each subsequent page — reuse over reinvention.
- `idbOpen/idbGet/idbSet` must be declared at top level (not inside a per-tab IIFE) when multiple script blocks on the same page need the shared cache (e.g. Kamsi Req1/5/6 block + separate Req4 block).

## Important Rules / Logic
- A forced Refresh (`?refresh=1` equivalent) always overwrites the cache, regardless of any timestamp comparison.
- Background/automatic freshness checks must never regress a more recently restored value — compare `generatedAt`/fetch timestamps before applying.
- Loading/error UI resets are conditional: only show them on a manual force-refresh or when there is genuinely nothing to display yet.

## Files / Components
- `reports/digital-marketing-member-pages/pages/kamsi.html`
- `reports/digital-marketing-member-pages/pages/dilaksi.html`
- `reports/digital-marketing-member-pages/pages/jefri.html`
- `reports/digital-marketing-member-pages/pages/mahima.html`
- `reports/digital-marketing-member-pages/pages/sales.html` (all 14 member tabs)
- `reports/digital-marketing-member-pages/pages/sukirtha.html` (original reference implementation, pre-dates today)

## Data Sources / Tools
Browser IndexedDB API (no external library). Backing data: Shopify Admin GraphQL (Kamsi/Dilaksi) and Postgres (Jefri/Mahima) via `api/requirement.js`.

## Validation
Reconstructed from commit messages/diffs across `6669fee`, `11fc7cc`, `845ff94`, `74be376`, `6fc1ebf`, `a1ee81d`, `17dc616` — not independently re-tested live in this sync.

## Reuse
This is now the standard pattern for any new live-fetch tab on this dashboard — apply directly rather than re-deriving sessionStorage/localStorage first.

## Evidence
- `evidence/Kamsi/2026-07-24_kamsi-req1-4-5-6-indexeddb-persistence.md`
- `evidence/dilaksi/2026-07-24_req2-indexeddb-persistence.md`
- `evidence/jefri/2026-07-24_req1-req2-indexeddb-persistence.md`
- `evidence/mahima/2026-07-24_req1-req3-indexeddb-persistence.md`
- `evidence/mahima/2026-07-24_req2-stock-management-indexeddb-persistence.md`
- `evidence/sales/2026-07-24_hourly-workflow-and-indexeddb-rollout.md`

## Limitations
IndexedDB is per-browser/per-device — does not sync a "restored" view across different machines or browsers for the same staff member. Not a substitute for the server-side snapshot/cache layer, which still exists independently.

---

# Capability — 3-Period Product Comparison (Jefri Requirement 3 / T-03)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Jefri Req3 (T-03)
**Store/Project:** digital-marketing-member-pages / Postgres (`google_ads.product_performance`)
**Status:** Completed

## Capability
Compare a product's Google Ads Conv. Value and ROAS across three fixed calendar-quarter windows (Previous 3M, Last 3M, Prior-Year 3M), classify a directional Improved/Same/Drop status, and rank products into a High/Mid performance tier by revenue-contribution percentile combined with a ROAS threshold.

## What Was Implemented
- A new Postgres query (`JEFRI_R3_QUERY`) with three period CTEs, a UNION of product IDs active in *any* period (not just the intersection), and a `ROW_NUMBER()`/`COUNT() OVER()` window function for percentile-based tiering.
- Reused Req1's SKU-resolution CTEs (`resolved_ids`/`child_fallback`/`resolved_listing`) verbatim rather than reimplementing.
- Pure classification functions: `jefriR3Roas()`, `jefriR3PctChange()`, `jefriR3Status()`, `jefriR3Tier()`.
- Same 60s in-memory cache + static-snapshot-fallback + `?refresh=1` pattern as Req1/Req2 (`jefriReq3Handler`).
- Frontend: grouped 2-row `<thead>` table, sort/search/filter, pagination, CSV + lightweight HTML-table-as-`.xls` export, IndexedDB persistence matching Req1/Req2.

## Technical Knowledge
- When a period predates a campaign's tracked history (here, Apr-Jun 2025 has 0 rows before 2025-05-12), that's a real, disclosed data gap — verified via `information_schema.columns` and manual row counts before writing any code, not silently absorbed into the output.
- A tier bucket returning 0 rows ("mid: 0") looked suspicious but was independently re-verified with a standalone query against the same percentile/ROAS thresholds — confirmed as correct real-data output, not a bug, before shipping.

## Important Rules / Logic
- Product set = UNION across all three periods (a product active in only one period is still included, with zeros for the others) — not an intersection.
- Tier is a percentile-of-revenue-rank + ROAS-threshold combination; Status is Conv. Value/ROAS trend-direction based with a defined precedence rule when the two metrics disagree (see the live evidence file for the exact precedence note).

## Files / Components
- `reports/digital-marketing-member-pages/api/requirement.js` (`jefriReq3Handler`, `JEFRI_R3_QUERY`)
- `reports/digital-marketing-member-pages/pages/jefri.html` (Requirement 3 tab)

## Data Sources / Tools
PostgreSQL: `google_ads.product_performance`, `listings.shopify_listings`.

## Validation
Live-tested same session: `GET /api/requirement?fn=jefri-req3&refresh=1` returned `summary:{"totalProducts":4791,"high":166,"mid":0,"improved":48,"same":2,"drop":74}`; top row spot-checked against a manual SQL re-run and matched exactly; deployed HTML confirmed via grep for `req3Tab`/`tabBtnReq3`/`fn=jefri-req3`. See `validation/jefri/2026-07-24_req3-3period-comparison-validation.md`.

## Reuse
The 3-period comparison pattern (UNION-of-periods + percentile-tier + trend-status) is reusable for any other staff member needing a similar multi-window product comparison.

## Evidence
`evidence/jefri/2026-07-24_req3-3period-comparison-evidence.md`

## Limitations
The Prior-Year 3M window has a genuine data gap for campaigns not yet tracked before 2025-05-12 — any product active only in that gap window will show incomplete history, by design, not a bug.

---

# Capability — Kamsi Organic Sales Rule (Reusable Prompt)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Kamsi
**Store/Project:** digital-marketing-member-pages (docs only, no code)
**Status:** Completed

## Capability
A reusable, written-down definition of the "organic sales" rule (direct + referral + no data + AI + unpaid search, excluding all paid ads) that can be pasted into future sessions/prompts instead of re-deriving or re-confirming it each time.

## What Was Implemented
Added `prompts/Kamsi/2026-07-24_kamsi_organic_sales_rule_prompt.md` — a standalone common-prompt document capturing the confirmed organic sales definition.

## Technical Knowledge
This matches the definition already recorded in this AIOS session's memory (`project_ledsone_organic_sales_definition`): Organic = direct + referral + no data + AI + unpaid search (excludes all paid ads).

## Important Rules / Logic
Any dashboard, tab, or report computing "organic sales" for ledsone.co.uk should apply this exact definition rather than an ad-hoc one.

## Files / Components
- `prompts/Kamsi/2026-07-24_kamsi_organic_sales_rule_prompt.md`

## Data Sources / Tools
N/A — documentation only.

## Validation
This file itself is the AIOS record; no separate evidence/validation/closure file was created since it is a docs-only prompt addition (matches the treatment of similar prompt-only commits in the 2026-07-23 log).

## Reuse
Paste directly into any future prompt needing the organic-sales definition, instead of re-deriving it.

## Evidence
`prompts/Kamsi/2026-07-24_kamsi_organic_sales_rule_prompt.md` (the file itself; commit `427aa49`)

## Limitations
None — this is a documentation-only capability.

---

# Capability — Shopify Access-Scope Error Diagnosis + Unbounded-Scan Timeout Guard

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Kamsi Req1
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed

## Capability
Diagnose and fix a Shopify Admin GraphQL "Access denied for X field" error by identifying and removing unused fields that require scopes the token doesn't have, and prevent full-catalog scans from hanging indefinitely with no user feedback.

## What Was Implemented
- Removed an unused `location {id name}` field from an inventory query that was requesting a scope (`read_locations`/`read_markets_home`) not granted to the UK token, even though the field's data was never consumed.
- Added a 10-minute in-memory server-side cache (bypassable with `?refresh=1`) to a handler that otherwise re-scanned the full 13,866-SKU catalog (~278 paginated GraphQL calls) plus a 90-day order history on every click.
- Added a client-side 290s `AbortController` timeout so a hung request surfaces a clear error instead of an infinite spinner.

## Technical Knowledge
- Shopify Admin GraphQL returns a field-level "Access denied" error (not a request-level 401/403) when a query includes a field requiring a scope the access token lacks — the rest of the query can still be valid. Diagnosis: check which requested fields are actually used downstream before assuming the whole endpoint needs new scopes.
- A hang with zero bytes returned after 100+s is confirmable directly via a bare curl call against the endpoint — a fast, cheap way to distinguish "slow" from "the client is blocking on an error/retry storm" before adding speculative fixes.
- Shopify applies per-page cost throttling (exponential backoff, up to 6 retries/page) on large paginated scans — this compounds badly with wide catalogs (13k+ SKUs) and no caching.

## Important Rules / Logic
- Any GraphQL field requested but not consumed by the response handler is a liability (extra scope requirement, extra payload) — audit and remove.
- Full-catalog/full-history scans on user-triggered buttons need both a server-side cache floor (so repeat clicks are cheap) and a client-side timeout ceiling (so failures are visible, not silent).

## Files / Components
- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/kamsi.html`

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk` (UK token).

## Validation
Reconstructed from commit messages `f6cd3ad`, `5e3408b` — not independently re-tested live in this sync.

## Reuse
Applicable to any other requirement page hitting a similar "Access denied for [field]" error, or any button-triggered full-catalog scan with no existing cache/timeout guard.

## Evidence
`evidence/Kamsi/2026-07-24_kamsi-req1-access-scope-hang-fixes.md`

## Limitations
The 10-minute cache means a genuinely fresh change on Shopify's side won't show up for up to 10 minutes without an explicit `?refresh=1`.

---

# Capability — utm_term Deep-Search Fix + Paid-Search Unclaimed-Gap Audit

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Sajeepan Google Ads tab; also surfaced the new DM tab
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed

## Capability
Detect and recover orders silently excluded from a staff member's Google Ads attribution tab because the existing campaign-name whitelist doesn't cover every real `utm_term` value actually seen on paid-search orders — and, more generally, detect entire campaigns with real paid-search order volume that no staff rule currently claims.

## What Was Implemented
1. A deep audit of every real `utm_term` on January UK orders (not filtered to already-classified orders first) — found 4 recurring, user-confirmed terms, 2 of which belonged to campaigns not in Sajeepan's existing 11-campaign whitelist (144 orders / £4,731+£12 net sales recovered).
2. Layered a `utm_term` match on top of (not replacing) the existing campaign-name rule — `matchedOn: 'campaign' | 'utm_term'` recorded per row for auditability.
3. A "paid-search unclaimed-gap audit" added to the `uk-total-debug` endpoint: finds campaigns with real order volume that don't match *any* staff member's current rule. This audit's finding (`Shop_DM_PMax-46_AguAsset`/`Our_Hreo`, 856 Jan orders / £19,378.72) directly led to the same-day creation of the new DM tab.

## Technical Knowledge
- Attribution rules built purely from a known campaign-name whitelist will silently miss orders whose `utm_term` reflects a real campaign not yet in that list — auditing actual `utm_term` values against confirmed-owner terms (not just re-checking existing matches) is the way to find these gaps.
- ValueTrack placeholders (e.g. the literal string `"{keyword}"`) can appear unsubstituted in real recorded `utm_term` data and must be matched as a literal string, not treated as a templating error.
- A "which real campaigns have volume but no matching staff rule" audit is a generalizable technique — it already found one previously-unknown campaign in one afternoon.

## Important Rules / Logic
- Match = campaign-name rule OR utm_term rule (union, not replacement) — a previously-correct rule is never narrowed, only supplemented.
- Recurring per-month regeneration failures (June needed 8 attempts) are a known Shopify-timeout pattern for specific months, not a code bug — retry, don't "fix" the query.

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/scripts/bulk-sajeepan-refresh.js`

## Data Sources / Tools
Shopify Admin GraphQL API order data, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `e65fa5e`, `062cb2a`, `b2c115c` — not independently re-tested live in this sync.

## Reuse
The unclaimed-gap audit technique should be run periodically (or whenever a new staff member/campaign is suspected) rather than only reactively — it is what found the DM campaign.

## Evidence
`evidence/sales/2026-07-24_sajeepan-utm-term-fix-and-gap-audit.md`

## Limitations
The audit is only as good as the confirmed-owner mapping fed into it — a real campaign with no confirmed owner will surface as "unclaimed" but still needs a human decision on who owns it (as happened with "DM").

---

# Capability — Sonya Google Ads Tab Monthly Snapshot Backfill (Jan-Jul)

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Sonya Google Ads tab
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (snapshots); bulk-refresh script uncommitted

## Capability
Regenerate a full Jan-Jul static-snapshot set for a staff member's Google Ads tab sequentially, with cooldowns, tolerating intermittent Shopify timeouts on individual months without blocking the whole batch.

## What Was Implemented
Refreshed Sonya's Jan, Feb-May, June, and July (live) snapshots across four separate commits the same afternoon. A new `bulk-sonya-refresh.js` script (mirroring the proven `bulk-sajeepan-refresh.js`) automates re-running all 7 months with per-month cooldowns and a 290s curl timeout per attempt.

## Technical Knowledge
- Certain months (June, for both Sajeepan and by pattern likely any staff member) are prone to repeated Shopify timeouts independent of code correctness — a strictly sequential retry-with-cooldown script (not concurrent) is the established fix, already proven on Sajeepan the same day.

## Important Rules / Logic
- Snapshot regeneration always targets the deployed API with `?refresh=1` — never bypasses the live attribution logic, only forces a fresh computation instead of serving the cached static file.

## Files / Components
- `reports/digital-marketing-member-pages/api/data/sonya-uk-ads-sales-2026-0{1-7}.json`
- `reports/digital-marketing-member-pages/scripts/bulk-sonya-refresh.js` (new, uncommitted as of this sync)

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk`.

## Validation
Reconstructed from commit messages `855a190`, `2802162`, `beeaf24`, `533711d` — not independently re-tested live in this sync.

## Reuse
`bulk-sonya-refresh.js` is directly reusable as a template for any future staff tab needing a full-year backfill.

## Evidence
`evidence/sonya/2026-07-24_sonya-monthly-snapshot-backfill.md`

## Limitations
`bulk-sonya-refresh.js` itself was not committed as of this sync — confirm with user before assuming it is part of the shipped codebase.

---

# Capability — Meta UK Tab + Cross-Tab Order Overlap Discovery Method

**Date:** 2026-07-27
**Owner:** Kuberan
**Staff/Requirement:** Meta UK (new tab), discovery affects Kamsi/Dilaksi/Sajeepan/Sonya/DM
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (Meta UK tab live); overlap issue documented, not yet resolved on the main dashboard

## Capability
Detect whether multiple staff dashboard tabs are silently double-counting the same underlying orders, by directly comparing order-name sets across each tab's raw JSON — not just eyeballing summary totals.

## What Was Implemented
Added a Meta UK tab (Social-channel orders not claimed by any existing Ads tab). While investigating it, ran a direct order-name intersection across 6 UK tabs' January data and found 48% of orders appear in 2+ tabs.

## Technical Knowledge
- Two tabs can each have a "correct" total sales number individually, yet still double-count real orders when their underlying definitions aren't mutually exclusive (product-scope vs. traffic-source-scope). Summary-level totals alone cannot catch this — only an order-ID-level set comparison across the raw data can.
- Reusable check: for any set of dashboard tabs claiming to report on "the same store," pull each tab's `all*Orders` array, build a `Map<orderName, [tabsThatMatched]>`, and flag any entry with more than one tab.

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js` (Meta UK handler, `socialAudit`/`paidSearchGapAudit`/`firstSessionSplit` on `ukTotalDebugHandler`)
- `reports/digital-marketing-member-pages/pages/sales.html`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), existing per-tab JSON snapshots in `api/data/`.

## Validation
Live-verified Meta UK tab; overlap finding independently reproduced via direct file comparison (not just a one-off claim).

## Reuse
Run the same order-name-set comparison before trusting any "combined total across tabs" figure on this dashboard — the answer directly motivated a whole new page (`salesuk.html`).

## Evidence
`evidence/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`

## Limitations
Meta UK tab has no static snapshot yet (live-fetch only, slow cold load). The overlap problem itself is not fixed on the main dashboard — only worked around via the new standalone page.

---

# Capability — Standalone Order-Level Sales Page with Mutually-Exclusive Groups

**Date:** 2026-07-27
**Owner:** Kuberan
**Staff/Requirement:** UK order-level review (DM-Ad, Meta groups so far)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (January live); Feb-Jul not yet built

## Capability
Build a second, fully independent dashboard page/backend from scratch when the existing one has a structural correctness problem (order double-counting) that shouldn't be silently patched into the tool people already trust.

## What Was Implemented
`api/salesuk.js` (new, zero shared code with `api/sales.js`) + `pages/salesuk.html`. A `GROUPS` array is checked in a fixed priority order; `assignGroup()` returns the first match, so no order can ever be assigned to two groups — exclusivity is a property of the code structure, not a rule someone has to remember to maintain. Order-level (not line-item-level) rows, full session history via an expandable panel, static-snapshot fast path (35s first-generation, ~2s after) mirroring the pattern already proven on `api/sales.js`.

## Technical Knowledge
- **Mutual exclusivity by construction**: when several "which staff/campaign owns this order" rules need to coexist without overlap, model them as an ordered list checked top-to-bottom with first-match-wins, rather than N independent boolean checks that each get evaluated in isolation (which is how the original per-staff tabs on `sales.html` ended up overlapping).
- **Order-level vs line-item-level rows**: reuse the same tax-inclusive-price fix and journey/session-building logic from `api/sales.js`, but aggregate to one row per order instead of one row per line item, when the requirement explicitly says "no product ID."
- Live full-month Shopify scans need BOTH a bigger GraphQL page size (100, not 50) AND a static-snapshot fast path — neither alone was enough to keep a cold page load under Vercel's function timeout for ~2,500-order months.

## Files / Components
- `reports/digital-marketing-member-pages/api/salesuk.js` (new)
- `reports/digital-marketing-member-pages/pages/salesuk.html` (new)
- `reports/digital-marketing-member-pages/home.html` (nav link, home.html only)
- `reports/digital-marketing-member-pages/vercel.json`
- `reports/digital-marketing-member-pages/api/data/salesuk-dm-ad-2026-01.json`, `salesuk-meta-2026-01.json`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), `SHOPIFY_UK_ADMIN_TOKEN`.

## Validation
Both groups live-verified with correct order counts/net sales; exclusivity verified by code review of `GROUPS`/`assignGroup()`, not just by spot-checking output.

## Reuse
Template for adding further groups to this same page (e.g. Direct, Organic Search, Referral, Email, "No Journey Data" — the remaining first-session buckets from the January split) — just append to `GROUPS` after the existing entries, never insert earlier without re-checking what it would now steal.

## Evidence
`evidence/salesuk/2026-07-27_standalone-order-level-page.md`

## Limitations
Only January is wired up (`SUPPORTED_MONTHS = ['2026-01']` in `api/salesuk.js`). Extending to Feb-Jul requires updating that list and generating new snapshots per month per group.

---

# Capability — Priority-Ordered Group Matching + Dual-Repo Deploy Hazard

**Date:** 2026-07-29
**Owner:** Kuberan
**Staff/Requirement:** salesuk.html (all groups)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed and live

## Capability
Two reusable pieces of technical knowledge from growing salesuk.html to 11 groups across 7 months:
1. How to build an attribution system where "no double-counting" is a property of the code, not a rule someone has to remember.
2. How to detect and defend against a second, independently-cron-deploying Git remote silently overwriting production.

## What Was Implemented
`GROUPS` array checked in a fixed priority order; `assignGroup()` returns the first match. Extended with **second-session** and **last-session lookthrough** (check later customer-journey sessions for a campaign when the first session has none) and both **permanent** and **month-scoped** matching rules living side-by-side in the same match function. A virtual "Not Assigned" group (not in `GROUPS`, computed as the logical complement) guarantees every order lands somewhere, visibly.

## Technical Knowledge
- **Mutual exclusivity by construction**: model competing ownership rules as an ordered list, first-match-wins, not N independent checks each evaluated in isolation — this is what actually prevented the double-counting bug that motivated the whole page.
- **Untraceable ≠ unassignable without checking**: before leaving an order in an unassigned pool, check every session in its journey (not just first) for a campaign — this recovered dozens of orders per month across Sonya/Sajeepan/DM-Ad that looked untraceable from the first session alone.
- **A live-looking data field can still be wrong**: `matchValue()` needing the same `journey` argument as `match()` is easy to miss when adding a new parameter to one but not the other — caused a silent mislabeling bug across every group simultaneously. Test by fetching real output, not just checking the match count.
- **Dual-deploy hazard**: if a Vercel project is git-linked to a repo with its own cron-triggered auto-deploy (here: `Staff-requirements`, hourly), any change made only to a *different* repo (here: `aios-2`) that also has push/CLI-deploy access to the same Vercel project will be silently reverted the next time the cron fires. Detection: a previously-working endpoint suddenly 404s with no code change of your own; check `vercel inspect <deployment> --logs` for `Cloning github.com/<other-repo>`. Fix: keep both repos synced after every change (a `git worktree` against the second remote works well for this).

## Files / Components
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `Staff-requirements` repo (second remote, `.github/workflows/hourly-july-snapshot-refresh.yml`)

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), `git worktree` for dual-repo sync, `vercel inspect --logs` for deploy-source diagnosis.

## Validation
Live-verified across all 11 groups, 7 months; dual-deploy hazard reproduced once (salesuk.js vanished from production), root-caused via deployment logs, and fixed by sync — confirmed stable across many subsequent deploys afterward.

## Reuse
Apply the same priority-ordered-array + Not-Assigned-complement pattern to any future multi-owner attribution problem on this dashboard. Always check `Staff-requirements` sync status before assuming a deploy "didn't work" on this specific Vercel project.

## Evidence
`evidence/salesuk/2026-07-27_to-29_full-buildout-and-cleanup.md`

## Limitations
Not-Assigned tab is read-only — no in-browser "assign this order" persistence yet (needs a GitHub token or an equivalent write path, deferred pending user decision).

---

# Capability — Feed Optimization (Thivajini, DM-2026-08-THIV01)

**Date:** 2026-08-20 to 2026-08-21
**Owner:** Kuberan
**Staff/Requirement:** Thivajini / DM-2026-08-THIV01
**Store/Project:** digital-marketing-member-pages / Postgres (`FEED_TRACKER_DB_URL`/`AUTH_DATABASE_URL`)
**Status:** Code complete, live usage unconfirmed (documented retroactively during 2026-09-16 AIOS recovery)

## Capability
A "Requirements Dashboard" for Thivajini (LEDSone FR / Google Ads) with a
feed-optimization/export workflow tracked in Postgres as a run/cycle, replacing
an existing pattern of creating tables at request-time inside API handlers.

## What Was Implemented
- 4 additive migrations across two days, `thivajini_feed_*` namespace.
- `lib/feed/` — 10 modules (cycle, columns, gate, notes, prompt, providers, repo, req5, session, sql, validate).
- `pages/thivajini.html` + `pages/thivajini/` UI.
- 6-file test suite, all passing.

## Technical Knowledge
Migration 001 explicitly documents fixing a named architectural defect
(`ARCHITECTURE.md` §10 finding 6) rather than adding to it — schema creation
moved out of request handlers into migrations.

## Files / Components
See `source-map/2026-08-20_thivajini-feed-optimization-source-map.md`.

## Data Sources / Tools
PostgreSQL (`FEED_TRACKER_DB_URL`/`AUTH_DATABASE_URL`).

## Validation
`node --test`: all 6 `tests/feed/*.test.js` files pass. See `validation/thivajini/2026-08-20_feed-optimization-validation.md`.

## Evidence
`evidence/thivajini/2026-08-20_feed-optimization-schema.md`

## Limitations
Live/production run history is unconfirmed.

---

# Capability — Search Term -> Product Mapping (Mahima, REQ-DM-2026-08-MAHI01)

**Date:** 2026-08-21
**Owner:** Kuberan
**Staff/Requirement:** Mahima / REQ-DM-2026-08-MAHI01
**Store/Project:** digital-marketing-member-pages / Postgres (`DILAIKSHAN_NEON_DB`)
**Status:** Code complete, live usage unconfirmed (documented retroactively during 2026-09-16 AIOS recovery)

## Capability
Lets Mahima map search terms to products and reopen any past mapping run as an
immutable snapshot — exactly what was seen at the time, unaffected by later
changes to live Ledsone data.

## What Was Implemented
- 1 additive migration, `mahima_stpm_*` namespace, no DB fallback chain.
- `lib/stpm/` — config, repo, router, rules.
- New tab/section on existing `pages/mahima.html`.
- Dedicated migration runner (`scripts/stpm-migrate.js`).
- 2-file test suite.

## Technical Knowledge
Reuses the same run/snapshot pattern as `thivajini_feed_*` deliberately (per
its own migration comments), while keeping a fully separate table namespace
and DB fallback rule.

## Files / Components
See `source-map/2026-08-21_mahima-stpm-source-map.md`.

## Data Sources / Tools
PostgreSQL (`DILAIKSHAN_NEON_DB`).

## Validation
`node --test`: `ui.test.js` passes; `stpm.test.js` blocked by missing `pg` in this worktree (confirmed environmental). See `validation/mahima/2026-08-21_search-term-product-mapping-validation.md`.

## Evidence
`evidence/mahima/2026-08-21_search-term-product-mapping-schema.md`

## Limitations
Live/production run history is unconfirmed.

---

# Capability — Automation Keyword Finder (Sajeepan Requirement 5)

**Date:** 2026-08-24
**Owner:** Kuberan
**Staff/Requirement:** Sajeepan / REQ-DM-2026-08-SAJE01
**Store/Project:** digital-marketing-member-pages / Postgres (`DILAIKSHAN_NEON_DB`)
**Status:** Code complete, live usage unconfirmed (documentation added retroactively during 2026-09-16 AIOS recovery)

## Capability
Given a product SKU, run a Google Lens visual search (via SerpAPI) to find visually
similar competitor listings, capture the results as structured evidence, route them
through a mandatory human review step, and use the reviewed ("INCLUDED") results to
derive keyword frequency/category insights, a Keyword Planner cache, validated
attributes, and final title/alt-text/Ads-keyword output — either on demand or as a
fully automatic weekly 50-product batch.

## What Was Implemented
- Postgres state machine (3 additive migrations) modeling a run's full lifecycle:
  `CREATED -> PREPARING -> SEARCHING_PRODUCTS -> BUILDING_RESULTS -> COMPLETED[_WITH_WARNINGS]/FAILED`,
  with per-product sub-state and an idempotency key so retries/double-clicks never
  double-spend paid SerpAPI credits.
- 20-module application layer (`lib/lens-keywords/`) covering the full pipeline:
  search, caching, quota tracking, human review, analysis, Keyword Planner
  integration, Google Ads output, AI-assisted title/alt-text/attribute generation,
  weekly automation, and export.
- Dedicated frontend tab (Requirement 5) mounted into the existing `sajeepan.html`
  dashboard without disturbing Requirements 1-4.
- A separate migration runner script and a 7-file automated test suite.

## Technical Knowledge
- Deliberately kept the Phase-1 (Lens search) state machine separate from the
  later analysis-phase state, because Stage 3 of the requirement is a human
  gate ("use only INCLUDED competitor results") — merging the two would let
  analysis start before a human has reviewed anything.
- Never stores a raw provider API response or a real API key value — only a
  named key slot and a normalized, allow-listed subset of fields
  (`normalize.js` / `SAFE_RESULT_FIELDS`).
- Weekly automation tracks cache-served vs. real API searches separately
  (`cached_searches_used` vs `searches_used`) so the UI can report honestly
  which work cost real credits.

## Important Rules / Logic
- Every automated Lens match is a candidate, never an auto-validated
  competitor — defaults to `NEEDS_REVIEW`.
- Migrations are additive-only (`IF NOT EXISTS`, no `DROP`/`TRUNCATE`) and
  scoped to the `google_lens_keyword_*` namespace — proven not to touch
  `thivajini_feed_*`, `mahima_stpm_*`, or any operational table.

## Files / Components
See `source-map/2026-08-24_sajeepan-lens-keywords-source-map.md` for the full file list.

## Data Sources / Tools
SerpAPI (Google Lens engine), PostgreSQL (`DILAIKSHAN_NEON_DB`).

## Validation
`node --test` on all 7 test files: 73/77 passed; 4 failed only due to a missing
`pg` dependency in the recovery worktree (not a code defect). See
`validation/sajeepan/2026-08-24_lens-keywords-automation-validation.md`.

## Reuse
The Postgres-run-as-state-machine + idempotency-key pattern is the same one
already used for `thivajini_feed_cycle` and `mahima_stpm_run` — reusable for
any future paid-API-backed batch feature that must survive Vercel Function
timeouts/retries without double-spending.

**New consumer (2026-10-07):** Blog HTML Automation's keyword-suggestion feature reads
`public.google_lens_keyword_planner_suggestion` directly (`_keyword_planner_suggestions()` in
`backend/app/dev_tasks/blog_html_automation/inputs.py`) — a read-only reuse of this table, no new
write path. See `source-map/2026-10-07_blog-html-automation-step1-audit_source_map.md`.

## Evidence
`evidence/sajeepan/2026-08-24_lens-keywords-automation-schema.md`

## Limitations
Live/production run history is unconfirmed — this capability record documents
what the code can do, not confirmed proof that it has been used.

---

# Capability — Automated SEO Metadata Audit and Traffic-Based Prioritization

**Date:** 2026-09-16 (created), **updated 2026-09-16 same day** (relocation + keyword-generation expansion)
**Owner:** Kuberan
**Staff/Requirement:** Originally built as Dilaksi Requirement 07; relocated same day to Development Tasks (internal dev tooling, not a Dilaksi-owned feature) — see the relocation closure record
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** Completed (implementation), merged to `main` — see closure records

## Capability
Given a live Shopify catalog and a GA4 property, automatically produce a
prioritized SEO metadata rewrite backlog: every page's current meta
title/description is checked for missing/duplicate/over-length issues,
cross-referenced with real (never fabricated) GA4 traffic, and ranked by
a documented, explicit priority rule set — without ever auto-generating
or publishing the replacement metadata itself (audit + prioritization
only, by design).

## What Was Implemented
1. Whole-catalog, metadata-only Shopify fetch (`products`/`collections`
   GraphQL, ACTIVE-only, `seo.title`/`seo.description`) — lighter and
   faster than any existing per-product-detail fetch in this codebase,
   since it pulls only the handful of fields this audit needs.
2. Missing / duplicate (cross-URL, blank-safe, self-comparison-safe) /
   length (exact >60 / >150 char) detection, pure Python, no AI.
3. GA4 traffic lookup by normalized URL path, with an explicit,
   never-silent "No GA4 data" state distinct from a real zero.
4. A new, explicit, query-overridable high-traffic threshold (this
   codebase had no existing numeric traffic-tier cutoff to reuse).
5. A small, fully documented 4-rule priority ladder (HIGH/MEDIUM/LOW/NO
   ACTION) that always resolves multi-issue pages to one highest
   applicable priority, never an undocumented score.
6. Non-blocking background-job pattern (matches this app's established
   convention) so a full-catalog scan never risks a proxy timeout, with
   a single-row JSONB snapshot for instant re-reads between runs.

## Technical Knowledge
- A metadata-only audit over an entire catalog should use its OWN
  lightweight Shopify query rather than reusing a heavier, per-product-
  detail fetch built for a different feature (variants/images/metafields
  add real latency at catalog scale for data never used here).
- "High traffic" is not a concept this codebase had standardized
  anywhere — any future feature needing a traffic tier should check for
  (and ideally converge on) this requirement's
  `HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT` pattern (explicit, query-
  overridable, always echoed in the API response) rather than inventing
  another one silently.
- Duplicate-metadata detection must explicitly exclude blank/null values
  from grouping and must exclude a page from its own duplicate list —
  both are easy off-by-one mistakes that silently invent false positives
  if skipped.

## Important Rules / Logic
- Priority rule order (highest wins): missing+high-traffic → HIGH;
  missing+low/no-GA4-data → MEDIUM; duplicate → MEDIUM; length-only →
  LOW; clean → NO ACTION.
- GA4 unavailability (service-account not configured, or a genuinely
  unmatched path) must degrade to an explicit "No GA4 data" state, never
  a fabricated zero or a silently-dropped row.
- This capability's scope hard-stops at the prioritized backlog — no
  replacement metadata generation, no Shopify writes, by explicit design
  (kept audit-only even though the codebase already has an AI-generation
  pattern elsewhere in this session's work, since that pattern belongs
  to a different, explicitly-scoped feature).

## Expansion (same day, after relocation) — Manual-Keyword AI Generation
Per explicit instruction, this audit-only capability was extended with a
SEPARATE, clearly-scoped generation step for the Missing Metadata tab
specifically (the original audit/backlog logic above is completely
unchanged and still never auto-generates or auto-publishes anything):
- User types/pastes one or more keywords (gathered manually, or via an
  agent using the Semrush MCP connector in a chat session — see
  source-map; this account's Semrush Standard API is Business-tier-only,
  confirmed live with a 403 Forbidden), clicks Generate.
- Backend always generates BOTH a title and description together (per
  explicit instruction — safe since nothing is written to Shopify) via
  the local LLM (self-hosted Qwen3-Next) with a Gemini fallback, using
  two fixed prompt templates. Generated titles are normalized to always
  end `" | LEDSone"` regardless of what separator the model used.
- Every successful generation is logged (`meta_audit_generation_log`:
  who, what, when, which keywords) with a delete action, and the
  keywords used are auto-saved for that product
  (`meta_audit_keyword_candidates`) so they're never re-typed.
- Real bugs found and fixed during this expansion: a character-count
  inflation bug from one model's response formatting, and a live
  Generate-button-does-nothing bug (found via browser DevTools network
  tab) — both documented in the evidence record.

## Files / Components
- `backend/app/dev_tasks/meta_audit/{router.py,schema.py,generate.py}` (moved + expanded from `backend/app/dilaksi_meta_audit.py`)
- `frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx` (moved from `frontend/src/dilaksi/pages/`)

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone_uk`), GA4 Data API (property
`408110563`, organic search only), this app's own Postgres, self-hosted
local LLM + Gemini fallback (generation step only), Semrush MCP
connector (interactive/chat-session-only, keyword research for the
generation step only — never the audit itself).

## Validation
Original audit: `validation/dilaksi/2026-09-16_dilaksi_req07_meta_title_description_audit_validation.md` — live-verified against real data (5,533 pages). Relocation + generation expansion: `validation/dm-dashboard/2026-09-16_alt-text-and-meta-audit-continued_validation.md`.

## Reuse
This exact pipeline shape (whole-catalog lightweight Shopify metadata
fetch → rule-based issue detection → GA4 traffic cross-reference →
explicit priority ladder → backlog) is directly reusable for any future
"audit X across the whole catalog, prioritize by real traffic" request —
e.g. an image-alt-text audit (a similar, already-built feature exists
elsewhere in this session as Alt Text Optimization, though built
independently before this capability was written down) or a structured-
data/schema-markup audit. Reuse the traffic-threshold and priority-
ladder pattern rather than re-deriving one per feature.

## Evidence
Original: `evidence/dilaksi/2026-09-16_dilaksi_req07_meta_title_description_audit_evidence.md`. Relocation + expansion: `evidence/dm-dashboard/2026-09-16_alt-text-and-meta-audit-continued_evidence.md`.

## Limitations
The priority ladder and traffic threshold are specific business rules
approved for THIS requirement (Dilaksi Req07) — a future reuse should
confirm with the relevant stakeholder whether the same threshold/rule
values apply, rather than assuming they transfer unchanged.

---

# Capability — Broken Link / 404 Monitor via Screaming Frog CLI

**Date:** 2026-09-17
**Owner:** Kuberan (SEO team: Dilaksi)
**Staff/Requirement:** Dilaksi Task 08, built as a Development Task (internal dev tooling, same convention as Meta Title & Description Audit / Alt Text Keyword Finder)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** PARTIAL — backend fully live-verified, UI/UAM not browser-tested (see validation/closure records)

## UPDATE (2026-09-17, later same day) — Screaming Frog approach REMOVED, superseded

This entire Screaming Frog CLI-based implementation was **removed from
the codebase** later the same day, per explicit instruction ("remove
all code about the screaming frog... change it to use GSC"). It was
briefly replaced by a pure-GSC-API version (`gsc_404_report`,
`broken_link_monitor` rebuilt on GSC's URL Inspection API instead of a
local crawl), which was then **also removed** per a further explicit
instruction ("remove the both pages, no need them for now").

The capability that now actually exists in the codebase is a **third,
final implementation**: see
`2026-09-17_gsc-404-url-monitor_capability.md` (new record, this same
folder) for the current, live "GSC 404 URL Monitor" (Dilaksi) task —
GSC URL Inspection API + Shopify replacement matching + review
workflow, registered with the existing Sync Monitor. This record is
kept for history (the Screaming Frog technical knowledge below is
still accurate about that CLI, it's just no longer used by this app)
rather than deleted, per "never delete previous evidence."

## Capability

Given a licensed, already-installed Screaming Frog SEO Spider CLI on
the host machine, run a controlled, bounded crawl of a live site,
detect broken internal/external links (4xx/5xx), cross-reference each
with real GA4 traffic, GSC performance, and Shopify resource context,
and produce a prioritized, reviewable remediation backlog — without
ever auto-publishing a redirect or modifying Shopify data.

## Relationship to the existing "Automated SEO Metadata Audit" capability

This is a **new, distinct capability**, not a duplicate of
`2026-09-16_seo-metadata-audit-traffic-prioritization_capability.md`.
That capability audits existing page metadata (titles/descriptions)
against the live Shopify catalog; this one detects and prioritizes
actually-broken links found by an external crawler tool (Screaming
Frog), a different data source and a different problem domain. The two
capabilities do, however, **share and reuse**:
- The GA4/GSC traffic-lookup pattern (`google_client.py`'s
  `fetch_ga4_report`/`query_gsc`).
- The `HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT = 50` traffic-tier
  convention documented in the metadata-audit capability — reused here
  rather than inventing a second, competing threshold.
- The module-level lock+state+background-thread job pattern
  (`_AUDIT_LOCK`/`_AUDIT_STATE` in meta_audit → `_CRAWL_LOCK`/
  `_CRAWL_STATE` here).

## What Was Implemented

1. A Screaming Frog CLI wrapper (`screaming_frog.py`) that runs only
   bounded, explicit list-mode crawls (`--crawl-list`) — never an
   unrestricted full-site crawl, since this CLI version has no
   `--max-urls`-style flag to bound a link-following crawl any other
   way.
2. CSV export parsing for both the direct "Response Codes" tab export
   (authoritative per-URL status) and the "…Inlinks" bulk-export
   (Source→Destination pairs) — verified via live `--help` output, not
   guessed, and verified to legitimately return empty Inlinks data in
   list-mode crawls (no link-following happens, so no inlink can be
   discovered), handled honestly with `source_url = NULL` rather than a
   fabricated source.
3. GA4/GSC/Shopify enrichment reused as-is from existing integrations,
   read-only throughout.
4. A conservative (v1) redirect-suggestion engine: only suggests a
   target when a live Shopify handle closely matches the broken URL's
   own handle (trailing numeric-suffix difference); anything else
   returns "No redirect suggestion" rather than guessing.
5. A documented priority ladder identical in shape to the metadata
   audit's (High/Medium/Low), using GSC clicks/impressions + GA4
   sessions as the actual traffic-evidence signal in place of
   "backlinks" (no Majestic/Ahrefs integration exists in this codebase —
   documented substitution, not a silent one).
6. Postgres persistence with a genuinely tricky NULL-dedup pattern: a
   standard `UNIQUE (source_url, broken_url)` constraint does not
   dedupe rows where `source_url IS NULL` (Postgres treats `NULL <>
   NULL`), solved with a separate partial unique index
   `ON (broken_url) WHERE source_url IS NULL` and a dynamic
   `ON CONFLICT` target chosen per-row.

## Technical Knowledge

- Screaming Frog's **list mode** (`--crawl-list`) is the correct,
  deliberate way to bound a crawl's size in this CLI version — it
  visits only the given URLs and discovers nothing via link-following,
  which is a feature (bounded, predictable) but means Source→Destination
  "Inlinks" data will legitimately be empty for any URL not directly in
  the seed list unless a broader, explicitly-authorized crawl mode is
  used instead.
- A standard SQL `UNIQUE` constraint across a nullable column will NOT
  prevent duplicate rows when that column is NULL for multiple rows — a
  partial unique index (`WHERE col IS NULL`) plus a dynamic
  `ON CONFLICT` target is the correct Postgres pattern for "dedupe by X,
  or by Y alone when X is absent."

## Files / Components

- `backend/app/dev_tasks/broken_link_monitor/{__init__.py,
  screaming_frog.py, schema.py, enrich.py, router.py}`
- `frontend/src/admin/pages/dev-tasks/BrokenLinkMonitor.jsx`

## Data Sources / Tools

Screaming Frog SEO Spider CLI v22.2 (local, licensed, no new
credentials), GA4 Data API (property `408110563`), Google Search
Console API (`sc-domain:ledsone.co.uk`), Shopify Admin GraphQL API
(`ledsone_uk`, read-only), this app's own Postgres (2 new tables).

## Validation

`validation/dilaksi/2026-09-17_dilaksi_task08_implementation_validation.md`
— backend/DB/integrations live-verified against production systems;
UI/UAM click-through explicitly not yet tested (PARTIAL, honestly
stated).

## Reuse

The list-mode-crawl + CSV-export-parsing + traffic/Shopify-enrichment +
priority-ladder shape here is directly reusable for any future
"run an external SEO crawler tool, prioritize its findings by real
traffic" request (e.g. a duplicate-content or canonical-tag audit fed
by the same Screaming Frog exports) — reuse the CLI wrapper and the
enrichment functions rather than re-deriving them per feature.

## Evidence

`evidence/dilaksi/2026-09-17_dilaksi_task08_implementation_evidence.md`

## Limitations

- No automated crawl scheduling exists yet — manual trigger only.
- No full-site crawl mode exists — bounded list-mode only, by explicit
  design, pending separate sign-off.
- The redirect-suggestion engine is deliberately conservative (v1,
  single signal) — do not assume it catches every real redirect
  opportunity; it is designed to under-suggest rather than guess.

---

# Capability — GSC 404 URL Monitor (via Search Console URL Inspection API)

**Date:** 2026-09-17
**Owner:** Kuberan (SEO team: Dilaksi)
**Staff/Requirement:** Dilaksi — GSC 404 URL Monitoring, built as a Development Task (internal dev tooling, same convention as Meta Title & Description Audit / Alt Text Keyword Finder)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** PARTIAL — code complete, compiles/builds clean, not yet live-tested (see validation record)

## UPDATE (2026-09-17, later same day) — design changed significantly, now live-tested

Several rounds of explicit instruction changed this task materially
from the original design described below. Original text is kept for
history (never delete previous evidence); this update reflects the
CURRENT live state.

**Data gathering — automatic scan REMOVED, manual upload only:**
The original design (a `ScheduledSnapshot`-driven automatic URL
Inspection scan, `gsc_scanner.py`, registered with Sync Monitor) was
removed entirely per explicit instruction. It now works exclusively
from a **manually uploaded GSC export** (Search Console → Pages → Not
found (404) → Export, a .zip or .csv) — every row is a URL Google
itself already confirmed, not a guessed-and-checked candidate.
`gsc_scanner.py` and the Sync Monitor registration are deleted;
`csv_import.py` parses the real export shape (Table.csv + Metadata.csv
inside the zip).

**Shopify matching — now AI-based, local LLM first:**
Replaced the original handle-suffix + token-overlap-only matcher with
an AI call using a specific user-supplied prompt template, given a
real live-fetched candidate list of Shopify products/collections in
the same category (the AI can only pick a URL actually in that list —
never a fabricated one). **Uses the self-hosted local LLM (Qwen3-Next,
same `LOCAL_LLM_*` credential already proven in
`alt_text_keywords/ai_alt_text.py`) first, Gemini only as a fallback**
if the local endpoint is unreachable — switched away from
Gemini-primary after live testing showed repeated Gemini calls
exhausting its quota and slowing every upload down. Matching is capped
at a hard timeout per row (started at 20-30s, found live that a single
row could otherwise stall an entire import for minutes) and runs
**5 rows in parallel** (verified live that the local LLM server
handles concurrent requests fine) instead of strictly one at a time —
real per-row latency measured live at ~8.6s for the actual matching
prompt (candidate list + full instructions) on the 80B local model.
A URL's match is also cached (`schema.get_existing_matches`) so a
re-upload of an already-seen URL skips re-matching entirely.

**Status workflow simplified:** the original `review_status` +
`development_status` two-column design was collapsed to a single
`status` column (`Pending`/`Done`). Selecting `Done` triggers a real
live HTTP check of the URL right then (`router.py`'s
`verify_live_redirect`) and is only accepted if the page no longer
errors — never trusted blindly. A fresh upload auto-marks a
previously-uploaded URL missing from the new file as `Done` (Google no
longer lists it), moving it out of the main "All URLs" table into a
separate "Past Data" tab; a "Done" tab shows only manually-confirmed
ones, with who confirmed it and when.

**New "Non-Indexed" tab added** — a second, separate dataset+upload
for GSC's Page Indexing "Crawled - currently not indexed" export
(different report, same no-public-API limitation). Locale-prefixed
URLs (`/pl/`, `/nl/`, `/es/`, etc. right after the domain) are
automatically excluded on upload and never stored — only true UK
(no-locale) URLs are kept, since a locale variant was never meant to
be indexed on this property. Deliberately simpler than the 404 table:
no Shopify/AI matching, no traffic enrichment, no live-redirect
verification (there's no API to verify indexing status) — `Done` here
is purely a manual "reviewed/actioned" marker.

**Confirmed real, hard limitation — no way to deep-link a specific URL
into GSC's URL Inspection tool.** A "quick link" feature was built,
live-tested by the user (real screenshots), and found broken: GSC's
inspect page's `id=` parameter expects an **opaque internal token**
(e.g. `EtZx62rhZB3-6i-CWS5MEQ`) that Google only generates once a URL
is actually searched inside its own UI — passing the real URL there
404s. There is no public, constructable link format for this; it was
**removed from the code entirely** per explicit instruction rather
than left as a broken feature. This is a genuine Google-side
limitation, not a bug — record it so a future attempt at the same idea
doesn't re-discover this the hard way.

**Live-verified working (2026-09-17):** a real 1000+ URL GSC export
was uploaded to production and processed successfully (988+ rows
persisted, live per-row, correct priority/KPI distribution observed:
e.g. 1,001 total, 220 Shopify replacements found, 5 High/90
Medium/199 Low priority in one real run) — this task has now actually
been exercised against real data, upgrading the "not yet live-tested"
status below for the core import+match+persist flow specifically
(status/History/Past Data/Non-Indexed workflows were exercised live
too via the same session).

## Relationship to the removed Screaming Frog capability

This supersedes `2026-09-17_broken-link-404-monitor_capability.md`
(now updated to point here). Same problem domain (broken/404 URL
detection + traffic-prioritized remediation backlog), genuinely
different data source and design: no external CLI, no local crawl --
purely Google's own Search Console API, plus a real Shopify
replacement-matching engine (the earlier version only suggested a
redirect on an exact handle-suffix match; this version adds a second,
token-overlap similarity signal).

## Capability

Given the existing GSC service-account credential, check a bounded
list of real, GSC-known URLs against Google's URL Inspection API to
find genuinely broken (404/soft-404/error) pages, cross-reference each
with real GA4/GSC traffic and a live Shopify catalogue search for a
possible replacement, assign a transparent priority, and track the
finding through a review/development workflow -- all without ever
auto-creating a redirect or modifying Shopify data. Results persist to
Postgres immediately per URL as a scan runs (not batched), and the
whole task runs on the same Sync Monitor schedule/UI as every other
scheduled dev-task page in this app.

## Technical knowledge (reusable for future "check GSC for X" tasks)

- **Google Search Console has no bulk "list all broken/error URLs"
  API.** `searchAnalytics.query` (clicks/impressions/position) and
  `urlInspection.index:inspect` (real per-URL crawl verdict) are
  different endpoints with no overlap -- the former can't tell you if
  a page is broken, the latter can't be queried in bulk. Any future
  task needing GSC's crawl/indexing status for many URLs will hit this
  same one-call-per-URL constraint; budget accordingly (Google's own
  per-property quota, not a code limitation).
- **`ScheduledSnapshot` supports arbitrarily slow `compute_fn`s.** It
  was designed around ~15s-scale computations, but nothing about the
  class assumes a short duration -- registering a 20-30-minute scan as
  a `compute_fn` worked cleanly and the existing Sync Monitor UI
  (running/last-success/next-scheduled) needed zero changes to display
  it correctly.
- **Live, per-record persistence pattern**: instead of collecting all
  results into memory and writing once at the end, pass an
  `on_result` callback into the slow-scan function and upsert to
  Postgres inside it, immediately, per item. This is directly reusable
  for any future task that needs its results visible in the UI while a
  long-running background job is still in progress, rather than an
  all-or-nothing wait.
- **Jaccard token-overlap similarity** (shared words / all words
  across two title+handle token sets) is a real, checkable, non-
  fabricated way to score "how similar is this broken URL's handle to
  a live product/collection" without inventing a fake ML-style
  confidence number -- the percentage IS the literal overlap ratio.

## Files / Components (current, 2026-09-17 later update)

- `backend/app/dev_tasks/gsc_404_monitor/{__init__.py, schema.py,
  non_indexed_schema.py, enrich.py, csv_import.py, router.py}` --
  `gsc_scanner.py` deleted (automatic scan removed)
- `backend/app/google_client.py` (`inspect_url` also removed --
  unused once the automatic scan was dropped)
- `backend/app/ai_shared.py` (`call_gemini`, fallback only)
- `frontend/src/admin/pages/dev-tasks/Gsc404UrlMonitor.jsx` -- 4 tabs:
  All URLs, Done, Past Data, Non-Indexed

## Data Sources / Tools (current)

Manually uploaded GSC exports (404 report + Page Indexing "Crawled -
currently not indexed" report, both .zip/.csv), GSC Search Analytics
API (site `sc-domain:ledsone.co.uk`, traffic context only), GA4 Data
API (property `408110563`), self-hosted local LLM (Qwen3-Next,
`LOCAL_LLM_*`) with Gemini fallback for Shopify matching, Shopify Admin
GraphQL API (`ledsone_uk`, read-only), this app's own Postgres (2
tables: `gsc_404_monitor_issues`, `gsc_non_indexed_urls`). No Sync
Monitor involvement (removed with the automatic scan).

## Validation

`validation/dilaksi/2026-09-17_gsc-404-url-monitor_validation.md` --
code-review-level PASS on every checked item at original write time.
Since then, live-tested directly in production by the user across
many real upload/match/status/delete cycles (see UPDATE section above)
-- the core flow is confirmed working, not just code-reviewed.

## Reuse

The "known-URL-list from Search Analytics -> per-URL Inspection check
-> live per-result Postgres upsert -> ScheduledSnapshot/Sync Monitor
registration" shape here is directly reusable for any future GSC-
crawl-status-based monitoring task (e.g. checking canonical-tag issues
or mobile-usability status per URL, both of which are also only
available via per-URL Inspection-style calls, not bulk reports).

## Evidence

`evidence/dilaksi/2026-09-17_gsc-404-url-monitor_evidence.md`

## Limitations

- Bounded to 500 URLs per scan (Google's URL Inspection quota) -- not
  a full-site sweep.
- Shopify matching is handle-suffix + token-overlap similarity, not a
  structured wattage/colour/material attribute parser (no existing
  reliable source for those as literal fields in this codebase).
- Not yet live-tested against real production data as of this record.

---

# Capability — LEDSone Content Index (Step 01 of Internal Linking Suggestion Engine)

Date: 2026-09-18

## What this capability provides

A reusable, persisted index of LEDSone UK's Product and Collection pages (URL, title, content
text/html, availability flags), refreshable on demand via `POST /api/dev/internal-linking/content-index/refresh`
and readable via `GET /api/dev/internal-linking/content-index`. Backed by
`public.internal_linking_content_index` in the existing Postgres database.

This is the foundation the later Internal Linking steps (02–05, not yet built) will read from — future
work should query this table rather than re-fetching Shopify data independently.

## Explicitly NOT included in this capability

Blog content indexing (no authoritative source exists — see this task's source-map), keyword
opportunity detection, link density analysis, or suggestion generation. Adding any of these is future
work under Steps 02–05, not an extension of this capability record.

## Checked before creating

Searched `capability/` for existing "internal linking", "content index", or "Dilaksi content" records —
none found (closest matches were `2026-09-17_gsc-404-url-monitor_capability.md` and
`2026-09-17_broken-link-404-monitor_capability.md`, both unrelated 404-monitoring capabilities). No
duplicate capability record created.

## UPDATE (2026-09-18, later) — Step 02 expands this capability

This capability now also includes a deterministic internal-link-opportunity detector
(`link_opportunities.py`, tables `internal_linking_opportunities` / `internal_linking_opportunity_scans`)
built directly on top of the Content Index above — no new capability record was created since this is a
direct expansion of the same one. It matches page titles/product types as anchor phrases via tokenized
n-gram dictionary lookups (not AI/semantic similarity, not a brute-force regex — see this task's evidence
doc for the performance rationale), checks existing links, excludes self-links, and deduplicates results.
Future steps (04-05: ranking, handoff) should build on this same capability rather than re-indexing or
re-scanning independently.

## UPDATE (2026-09-18, later) — Step 03 further expands this capability

Added a link-density measurement capability (`link_density.py`, `density_rules.py`, table
`internal_linking_density`) — per-page total/unique internal link counts, per-type breakdown, self-link
tracking, and a single documented threshold-based status (not a priority/ranking engine). Still a direct
expansion of the same Content Index capability, no separate capability record created. A real bug in the
shared link-parsing code (external links mis-counted as internal) was found and fixed as part of this
work, improving Step 02's accuracy too.

## UPDATE (2026-09-18, later) — Step 04 further expands this capability

Added a suggestion-generation and priority-classification capability (`suggestions.py`,
`priority_rules.py`, table `internal_linking_suggestions`) -- turns Step 02/03's outputs into reviewable,
prioritized suggestions with a persistent Approve/Reject/Keep-for-Review workflow. Still a direct
expansion of the same Content Index capability chain, no separate capability record created. Documented
limitation carried into this expansion: High/Medium priority requires cornerstone and new-blog
classifications that don't exist in this project, so those tiers are currently unreachable by design --
whoever builds Step 05 (handoff) should be aware every suggestion today is Low or No Action.

## UPDATE (2026-09-18, later) — Step 05 completes this capability chain (FINAL STEP)

Added a content-team handoff, implementation-tracking, and LIVE verification capability (`handoff.py`,
tables `internal_linking_handoffs`/`internal_linking_verification_log`). This is the final link in the
chain: Content Index -> Opportunities -> Density -> Suggestions -> Handoff/Verification. Still one
capability expansion, no separate record created. New reusable primitive added here worth noting for
future work: `link_opportunities.parse_internal_url(url)` -- classifies any single LEDSone URL into
`(page_type, handle)`, usable anywhere a URL needs to be matched against the Content Index without
re-fetching a full page. The live-verification approach (plain uncached `requests.get`, not the
competitor-research cache pattern) is the correct model to reuse for any future "check our own site's
current live state" need -- the cached `http_fetch.py` pattern is only right for external/competitor
pages where staleness is acceptable.

---

# Capability — AI FAQ Schema (JSON-LD) Generation Pattern

Date: 2026-09-22
Established by: Collection Page Thin-Content Detector's FAQ Analysis tab
Location: `backend/app/dev_tasks/collection_thin_content/faq_generation.py`

## What this capability is

A reusable, proven pattern for generating schema.org structured data (specifically FAQPage JSON-LD) from
real PAA (People Also Ask) questions via a self-hosted local LLM, with deterministic safeguards against the
two real failure modes LLM-generated structured data hits in practice:

1. **Missing `<script>` wrapper** — an LLM asked for "JSON-LD" will often return bare JSON. Pasting bare
   JSON into a page renders as visible text instead of invisible structured data (confirmed live via a real
   before/after Shopify screenshot). Fix: always wrap in `<script type="application/ld+json">...</script>`,
   validate/re-serialize the inner JSON so a malformed response can never be pasted through broken.
2. **Soft instructions are unreliable** — asking a model to "mention X if relevant" often produces zero
   compliance (confirmed live: a real generation with internal links offered produced no mention at all).
   Fix: never trust the model for something that must deterministically happen — check the output
   afterward and inject programmatically if the model didn't comply
   (`ensure_internal_link_present()`), and separately compute "what was actually used" from the real
   output rather than trusting what was offered (`links_actually_mentioned()`).

## Reusable pieces (all in `faq_generation.py`, all generically named, not collection-specific)

- `_call_local_llm()` — same `LOCAL_LLM_*` env-var pattern + Gemini fallback already used by
  `meta_audit/generate.py` and `alt_text_keywords/ai_alt_text.py`. Copy-per-file convention (established
  elsewhere in this codebase), not centralized.
- `parse_llm_output()` — extracts + validates + re-wraps a `<script type="application/ld+json">` block from
  a raw LLM response, tolerant of stray commentary the model prepends.
- `ensure_internal_link_present()` — deterministic "guarantee X happened" pattern for any soft instruction
  given to an LLM.
- `links_actually_mentioned()` — "report only what's genuinely true in the output, not what was offered" pattern.
- `strip_internal_links_from_jsonld()` — free, instant, no-new-AI-call post-processing edit pattern (edit
  the already-generated output via plain text/regex instead of re-spending a credit + LLM call for a small
  change).

## Frontend pattern (in `CollectionThinContentDetector.jsx`)

- `FaqSchemaPreview` / `linkifyAnswerText()` — renders a JSON-LD FAQPage schema as a real accordion, with
  any embedded URL shown as an actual clickable link (using a real matched page's title) — the preview only;
  the copied/stored schema text stays plain, since structured data is never rendered as a page.
- Per-collection `BackgroundJob` for AI generation (not the audit's single shared job) — proven pattern for
  "many independent slow AI calls, each keyed by its own entity id," reusable for any future per-item AI
  generation feature in this codebase.

## When to reuse this

Any future dev task that needs to (a) generate schema.org structured data via the local LLM, (b) ask an LLM
to conditionally include something and needs it to actually happen reliably, or (c) needs a
credit-conscious "edit the existing AI output for free" action instead of a full regenerate.

## Not reusable / scoped to this task

`primary_keyword_for()` and `pick_internal_links()` are specific to collection-page SEO (title-cleaning,
token-overlap against the Internal Linking content index) — reusable as a pattern, not as-is for a
different domain.

## UPDATE (2026-09-22, later) — confirmed reused, second consumer

This exact pattern was reused (not duplicated) the same day by the AEO/GEO Content Action feature
(`backend/app/dev_tasks/geo_visibility/content_actions.py`, Dilaksi Phase 1) — proof this capability record
is genuinely reusable, not a one-off:

- Same `_call_local_llm()` (`LOCAL_LLM_*` env vars) + Gemini fallback, copy-per-file per this codebase's
  established convention.
- Same "ask for strict JSON, validate before saving" pattern (`parse_llm_output()`) — here validating a
  `{format, formatReason, question, content, placementNote}` shape instead of a JSON-LD block, same
  discipline: a malformed response is rejected ("Generated response could not be validated. Please
  regenerate.") rather than silently saved.
- Extended the "never lose a previous draft" idea one step further: `generation_history` (a JSONB array on
  the DB row) preserves every prior AI draft before a Regenerate overwrites `generated_content` — the FAQ
  schema pattern only needed a single before/after edit (`strip_internal_links_from_jsonld`), this consumer
  needed unlimited regenerate history, so the pattern generalized cleanly to that need.
- New reusable idea contributed back: "human edit stored separately from the AI draft, original never
  overwritten" (`final_content`/`final_question` columns alongside `generated_content`/`generated_question`)
  — worth folding into this capability's own future consumers if a future feature needs human-editable AI
  output.

Confirms this is now a proven, twice-used pattern in this codebase, not implemented in reference to a
single task.

## UPDATE (2026-10-06) — consolidated into shared modules, location changed

This capability's code MOVED: `_call_local_llm()` is no longer copy-per-file — consolidated into
one shared `backend/app/dev_tasks/local_llm.py` (`call_local_llm`/`call_with_gemini_fallback`),
used by every AI-generation task in the codebase now, not just this pattern's consumers. The
FAQ-schema-specific logic itself (`parse_llm_output`, `ensure_internal_link_present`,
`links_actually_mentioned`, `strip_internal_links_from_jsonld`, `pick_internal_links`,
`primary_keyword_for`) moved from `collection_thin_content/faq_generation.py` to the new shared
`dev_tasks/faq_schema.py` (`generate_faq_schema()`), so Blog Optimization could reuse the exact
same pipeline for blog posts instead of building a second one — confirmed working, this is now a
**third** consumer of this capability.

## UPDATE (2026-10-07) — confirmed relevant to a 4th planned consumer, with a real gap found

Step 1 audit for a new "Blog HTML Automation" feature (see
`evidence/dm-dashboard/2026-10-07_blog-html-automation-step1-audit_evidence.md`) confirmed this
pattern is the correct reuse target for that feature's FAQ requirement too — but found a real
gap: `faq_schema.py`'s `generate_faq_schema()` is **schema-only**. It never generates visible
FAQ HTML content, only the FAQPage JSON-LD block. Blog HTML Automation needs BOTH (6–8 visible
FAQs plus schema that exactly matches them) — so this capability will need extending with a
visible-FAQ-HTML generation path alongside the existing schema-only one, not rebuilding. Flagged
as a Step 2 task, not yet implemented.

## UPDATE (2026-10-07, Step 3 implementation) — new reusable technique: render visible content FROM the schema, don't generate it twice

Blog HTML Automation's `faq_adapter.py` resolved the gap above WITHOUT a second LLM call: it
calls the existing `generate_faq_schema()` exactly once (unchanged, zero edits), then renders
the visible FAQ HTML directly from the already-parsed FAQPage JSON-LD's `mainEntity`
question/answer pairs. This is a stronger reuse pattern than "two outputs from one prompt" — it
is structurally impossible for the visible content and the schema to diverge, since one is
literally derived from the other's already-validated data, and it costs zero extra AI calls or
credits. Worth reusing for any future feature that needs both a visible rendering and a
structured-data version of the same AI-generated content (not just FAQs) — generate the
structured data once, render the visible form from it, rather than generating both
independently.

---

# Capability — Anti-repeat "Regenerate" pattern for local-LLM content generation

**Date:** 2026-09-22
**Owner:** dm-dashboard dev tooling
**Status:** Live, proven in production (Meta Title & Description Audit)

## What it is

A reusable fix pattern for any "Regenerate" button backed by the
self-hosted local LLM (LOCAL_LLM_* env vars, the same pattern already
used across `alt_text_keywords`, `meta_audit`, `collection_thin_content`,
`geo_visibility`, `kamsi_blog_title_finder`): identical or near-identical
inputs to an LLM call can produce identical or near-identical output if
(a) no `temperature` is set on the call (defaults to low/near-greedy
sampling) and (b) the prompt has no awareness the call is a "regenerate,
give me something different" request rather than a fresh generation.

## The fix

1. Set an explicit `temperature` (0.9 proven to work well) on the local
   LLM call.
2. When a previous generation exists for the same input (tracked via
   whatever log/history table the feature already has), fetch it and
   inject an explicit instruction block into the prompt: "A previous
   version was already generated: '{previous_text}'. Your new version
   MUST take a genuinely different angle/wording — do not just swap one
   or two words."

## Where it's proven

`backend/app/dev_tasks/meta_audit/generate.py` — found and fixed
2026-09-22 after a real user bug report (Regenerate producing
byte-identical output on a real product). Live-tested: 3 consecutive
regenerates on the same real product/keyword produced 3 genuinely
distinct outputs (previously identical/near-identical); re-confirmed
directly against production.

## When to reuse this

Any future "Regenerate" button on an AI-generated field in this
codebase that currently just re-calls the same prompt with the same
inputs should check: does it set a temperature? Does the prompt know
it's a regenerate? If either answer is no, this exact pattern applies
directly — see `meta_audit/generate.py`'s `_call_local_llm`/
`_PREVIOUS_VERSION_BLOCK` for the reference implementation.

---

# Capability — Search Console Sitemap & Indexing Monitor Pattern

**Date:** 2026-09-29
**Owner:** Kuberan (Hetheesha's Task 16, Phase 1)
**Project:** dm-dashboard, ledsone.fr
**Status:** Implemented, backend/frontend validated locally; not run against live Search Console
from any session to date, not deployed

## Capability

Read-only sitemap + indexing-issue detection for a Shopify store, using Google Search Console's
real Sitemaps API and URL Inspection API (not an assumption or crawl-only heuristic), with
priority classification driven by a real traffic/value signal and a day-over-day trend table.

## What problem it solves

Gives a staff member a single page answering "which of our sitemap URLs aren't indexed, and which
of those actually matter" — without any manual GSC UI digging, and without guessing at Search
Console's internal classifications.

## Originating task

`evidence/hetheesha/2026-09-29_task16-search-console-indexing-monitor_evidence.md` (commit
`36c2fb7`, `dev-work`).

## Technical implementation

- New backend package `backend/app/dev_tasks/search_console_indexing/`: `authorization.py`,
  `schema.py`, `sitemaps_api.py` (genuinely new — the first code in this project to call GSC's
  `sitemaps.list` endpoint), `value_signal.py`, `detection.py`, `pipeline.py`, `trends.py`,
  `router.py`, `scheduler.py`.
- New table `public.search_console_indexing_daily_snapshot` — one row per calendar day, powering
  the `/trends` current-vs-previous-period comparison. Correctly reports
  `"available": false, "reason": "Historical comparison unavailable"` on day one rather than
  fabricating a trend.
- Priority rules (NO_ACTION/HIGH/MEDIUM/LOW) driven by Search Console's own literal
  `coverageState` string (never reworded) crossed with a **high-value URL** signal.
- **High-value URL fallback convention** (reusable beyond this task): a URL counts as high-value
  if it already has 10+ GSC impressions in existing stored data; if no impression data exists yet
  for the store, falls back to the dashboard's existing SEO priority convention
  (Homepage/Collection/Product = high-value, Blog/Page = not) — a labelled existing convention,
  not an invented signal.

## Reuse (confirmed in the originating evidence, not duplicated)

- GSC authentication: `google_client.get_gsc_ledsone_fr_access_token` — no new credential.
- Per-URL indexing verdicts: the SAME `structured_data_validation_gsc_inspections` table and
  `choose_sample`/`run_inspections` helpers Task 15 (Structured Data Validation) already built —
  one shared Search Console URL Inspection quota across both tasks, not a second one.
- Sitemap URL list + template classification: `structured_data_validation.discovery.discover_urls()`
  reused as-is.
- Existing GSC impressions signal: Task 13's `french_keyword_research_seed_keywords.gsc_metrics`,
  not a new external data pull.
- Access control: same `auth.verify_token` + `access_grants` model as
  `structured_data_validation.authorization`.
- UI: the shared `jreq-*` CSS classes used by every Development Task page; only page-specific
  pieces (priority boxes, action-flow steps) got new CSS.
- Sync Monitor: registered as a `ScheduledSnapshot`, same shape as Task 15 (weekly, Run Now,
  `resume_if_interrupted=True`).
- **Genuinely new, not a duplicate:** the Sitemaps API call itself — no existing code in this
  project read that endpoint before this task.

## Data sources / APIs

Google Search Console: Sitemaps API (`sitemaps.list`, new), URL Inspection API (shared with Task
15, existing quota). Internal: `french_keyword_research_seed_keywords.gsc_metrics` (Task 13).

## Validation

`python -m py_compile` + `ast.parse` on all 10 new backend files: PASS. `npx vite build`: PASS. A
full `import app.dev_tasks` could not be completed locally (no live Postgres connection on that
dev machine; a pre-existing unrelated task opens a DB connection at import time before this one is
reached — a known limitation of testing this backend outside the server, not introduced by this
task). No live run against the real ledsone.fr Search Console property has been performed from any
session to date.

## Known limitations

No bulk index-coverage export exists in the public Search Console API — reasons come only from the
URL Inspection API, one URL at a time, bounded by the same shared ~2,000/day quota Task 15 uses.
Sitemaps API counts are Google's own per-sitemap aggregate, not a per-URL list. The high-value
fallback is template-type-based only (no GA4/revenue data wired into a page-URL-keyed dataset for
ledsone.fr yet). Trend needs 7+ days of runs before showing anything.

## Evidence

`evidence/hetheesha/2026-09-29_task16-search-console-indexing-monitor_evidence.md`

## Related

`capability/2026-09-17_gsc-404-url-monitor_capability.md` (a different mechanism — manual CSV
upload of GSC's 404 export, UK store — confirmed not a duplicate of this one, left untouched);
Task 13 (seed keywords/GSC metrics), Task 15 (Structured Data Validation, shares the inspection
table/quota).

## Limitations of this capability record

Written as a direct capability-ization of the originating evidence file (2026-10-08, AIOS full
capability backfill) — no new verification was performed beyond what the evidence file already
documents.
