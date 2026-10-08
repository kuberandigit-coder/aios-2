# Capabilities — 2026-07-24

8 capabilities documented from this day's work.

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

