---
title: Thasitha Requirement 2 — PMax Zero-Performance Dashboard — Continuation Prompt
requirement_id: THASITHA-R2
type: prompt
---

## Purpose
Resume this exact task after a computer restart interrupted mid-discovery.
Paste this whole file into a new session to continue from where it
stopped — do not restart discovery from scratch, the findings below are
already confirmed.

## Task Being Executed (verbatim role)
Acting as execution worker only (not the planning/validation layer) for:

**THASITHA REQUIREMENT 2 — PMAX PRODUCT ZERO-PERFORMANCE AND ROOT-CAUSE
DASHBOARD**

Staff: Thasitha · Department: Google Ads · Store: ledsone.de
Supporting AIOS staff: Kuberan

Full original task spec (all rules, column list, Zero-Flag logic,
Root-Cause categories, Action priorities, validation tests, required
AIOS files, and STOP CONDITIONS) was pasted in full by the user in the
message immediately before this interruption — **if that message is
still visible in conversation history, use it as the literal source of
truth for every rule.** If not visible, ask the user to re-paste it
before proceeding; do not reconstruct the rules from memory.

## Where We Stopped
Mid-way through **Mandatory Discovery Before Implementation** (the
task's own required phase 1) — specifically just after finishing a
repo-wide Explore search and about to move into direct PostgreSQL
inspection via `ledsone-db-mcp`. **No HTML was edited. No files were
written yet in this task.** This is 100% discovery-only so far.

## Confirmed Findings So Far (do not re-derive — verified this session)

### 1. Authoritative file location (corrects the task spec's assumed path)
The task spec assumed `Staff-requirements\pages\thasitha.html`, but
that path **does not exist locally** — `Staff-requirements` is a
separate GitHub repo, only ever cloned into the scratchpad temp
directory, never a persistent local folder.

**Real authoritative file:**
`C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\thasitha.html`
(436 lines). Confirmed byte-identical to the `Staff-requirements` GitHub
repo's `pages/thasitha.html` (diff clean, repo already up to date as of
2026-07-15).

### 2. What Requirement 1 currently does (must be preserved untouched)
Campaign-level "Campaign Performance & ROAS Action" dashboard.
**Static HTML** with data baked in at build time (embedded `CAMPAIGNS`
array + `DAY` daily lookup object) — no live API calls from the browser.
Built by a Python script
(`reports\thasitha\data\2026-07-10_thasitha_req1_builder.py`, also a
`_v2.py`) that queries PostgreSQL directly and writes the HTML.

Data source: `google_ads.campaign_performance` JOIN
`google_ads.campaigns`, filtered to `account_id = 9031058245`
(ledsone.de) AND `group_name = 'Thasi'` (an internal ownership tag
already synced from Google Ads — this is likely the campaign-ownership
proof source for Requirement 2's scope too, needs confirming).

This is **campaign-level only** — no product IDs, no GMC data, no
Shopify data touched anywhere in Requirement 1. Nothing to reuse
directly for product-level work except the account/ownership filter
pattern and the static-build-script architecture.

### 3. ⚠️ CRITICAL BLOCKER — GMC (Google Merchant Center) status data does NOT exist
Confirmed via a prior, thorough investigation already done for a
different staff member (Mahima):
`reports\mahima\2026-07-09_postgres_developer_request_feed_status_missing_attribute.md`.

Key facts from that investigation:
- `raw_data.gmc_product_diagnostics_daily` table **exists but has 0
  rows** — the ingestion pipeline was designed but never actually run.
- All 43 tables matching `%google%`/`%gmc%`/`%merchant%`/`%shopping%`
  were enumerated at the time; none contain real per-product GMC
  status/diagnostics at any scale (only a tiny 193-row/4-product sample
  table, `staging_ai.cppc_pmax_campaign_digital_twin_rows_v1`).
- The system's own audit view already flags this gap itself:
  `staging_ai.v_pmax_18m_feed_failure_v1` carries a failure reason
  literally named `GMC_DIAGNOSTICS_SOURCE_EMPTY`.
- A `google_merchant_products` importer exists and does carry basic
  feed content (title, price) — but **not** status/diagnostics/
  eligibility. Not sufficient for the "GMC Status" column this task
  requires (Approved/Disapproved/Under Review/etc.).

**This matches one of the task's own explicit STOP CONDITIONS verbatim:
"GMC status source is unavailable."** This has NOT yet been re-verified
firsthand this session (only via the subagent's report of a prior
investigation) — **next step below covers re-confirming this directly**
before deciding whether to formally stop/report the blocker to the
user, or proceed with GMC Status permanently = "Unknown" (documented
limitation, AMBER-tier PASS per the task's own PASS/AMBER/FAIL rules,
never fabricated).

### 4. Google Ads product-level query — exists, but with known problems
`evidence\mahima\2026-07-08_mahima_req1_product_level_evidence.md`
documents a working join pattern:
```sql
select p.google_item_id, gmp.title, gmp.price
from <product_performance_table> p
join google_merchant_products gmp on p.google_item_id = gmp.product_id
```
**Two documented gotchas that must be replicated/fixed, not blindly
copied:**
- Fan-out bug: one `product_id` maps to up to ~15 rows in the product
  performance table (needs dedup handling — the task's own "Duplicate
  Test"/"Grain Test" directly cover this).
- Only ~18.7% match rate between Google Ads product IDs and the
  Merchant product feed — most product-level rows currently don't
  resolve to a real product.

Reference implementation (working example of a product-level Google Ads
dashboard, though it has no GMC status and no Shopify join):
`reports\mahima\mahima-requirement-1-product-performance-report.html`,
built by `reports\mahima\data\2026-07-08_mahima_req1_product_level_builder.py`.

### 5. No prior Thasitha Requirement 2 work exists anywhere
Confirmed via full-repo grep — zero hits for "Requirement 2" tied to
Thasitha in `prompts/`, `evidence/`, `validation/`, `handover/`,
`reports/`, `vercel/`, or `closure/`. This is genuinely net-new work,
not a duplicate-risk situation (Duplicate-Risk = LOW so far).

### 6. No Shopify-inventory-joined Google-Ads-product dashboard exists yet
Confirmed absent repo-wide — this combination (Ads product × GMC ×
Shopify stock) would be entirely new work for Requirement 2, no
existing pattern to reuse beyond the two partial precedents above.

## Existing Thasitha AIOS Docs Found (Requirement 1 only, for reference/pattern-matching)
- `prompts\thasitha\requirement-1-campaign-roas-prompt.md`,
  `prompts\thasitha\2026-07-12_requirement-1-monday-continue-prompt.md`
- `evidence\thasitha\requirement-1-discovery.md`,
  `requirement-1-data-validation.md`,
  `requirement-1-postgresql-source-map.md`,
  `requirement-1-impressions-clicks-ctr-and-daily-view-addendum.md`,
  `requirement-1-hourly-live-refresh-routine-evidence.md`
- `validation\thasitha\requirement-1-validation.md`,
  `validation\thasitha\2026-07-13_hourly-live-refresh-validation.md`
- `handover\thasitha\requirement-1-handover.md`,
  `handover\thasitha\2026-07-13_hourly-live-refresh-handover.md`
- `vercel\thasitha\requirement-1-deployment-readiness.md`
- `reports\thasitha\requirement-1-campaign-roas-report.md`,
  `reports\thasitha\data\2026-07-10_thasitha_req1_builder.py` (+`_v2.py`)
- `closure\thasitha\2026-07-13_hourly-live-refresh-closure.md`

## Next Steps (resume here)
1. **Re-verify the GMC-data-absence finding directly** via
   `ledsone-db-mcp` (don't just trust the subagent's summary of Mahima's
   old investigation — confirm `raw_data.gmc_product_diagnostics_daily`
   row count and re-check for any newer GMC table live, since Mahima's
   finding is from 2026-07-09 and could theoretically be stale).
2. Search for Thasitha's specific PMax campaign scope / product
   allocation (the task requires proof of ownership — check
   `group_name = 'Thasi'` pattern from Requirement 1, and look for any
   asset-group/listing-group mapping table in PostgreSQL).
3. Check Shopify inventory data availability at variant/SKU level
   (likely available — `inventory.local_inventory_current_stock_location_wise`
   or similar, per other sessions' work this AIOS repo already has solid
   Shopify inventory schemas for ledsone.de).
4. **Decision point**: if GMC status is confirmed still unavailable,
   either (a) formally STOP per the task's own stop condition and report
   the blocker back to the user without building anything, or (b) ask
   the user directly whether to proceed with GMC Status hardcoded to
   "Unknown" for every row (task explicitly allows this — "Not Found" /
   "Unknown" are approved enum values) as a documented AMBER-tier
   limitation. Given the user's usual preference this session has been
   to keep moving with clearly-labeled limitations rather than hard-stop,
   lean toward asking via AskUserQuestion rather than silently halting —
   but this is a judgment call for whoever resumes.
5. Only after scope + Shopify + GMC-status decision are settled, proceed
   to build: update `reports\digital-marketing-member-pages\pages\thasitha.html`
   in place (add Requirement 2 tab, preserve Requirement 1 exactly),
   following every column/Zero-Flag/Root-Cause/Action rule from the
   original task spec.
6. Write all 9 required AIOS files per the task's own list (prompts,
   evidence ×4, validation, reports, handover, vercel) — do not skip any.
7. **Do not deploy to Vercel and do not git push** — task explicitly
   requires separate written approval for both, same as every other
   requirement handled this session (SUK-R2/R3/R4, Kamsi).

## Session Context (other work completed earlier this same session, unrelated to Thasitha R2, FYI only)
- SUK-R2 (Duplicate Listing/Price Check), SUK-R3 (Slow-Moving Stock),
  SUK-R4 (Core GA4 Data for SEO) — all built, deployed, validated for
  Sukirtha on ledsone.de. Pushed to both `aios-2` and `Staff-requirements`
  GitHub repos.
- Kamsi's authoritative 725-product allocation CSV built from 29 Shopify
  collections (`reports\Kamsi\data\2026-07-14_kamsi-product-allocation.csv`).
- A full Kamsi sales dashboard built on `pages\sales.html` +
  `api\sales-kamsi.js` (ledsone.co.uk, separate Shopify UK token) —
  month-tabbed (Jan–Jun 2026), all-channels breakdown with click-to-filter
  and expandable session details, now served from **pre-generated static
  JSON snapshots** (`api\data\kamsi-sales-2026-0X.json`) for instant
  loading instead of live Shopify scans, since all 6 months are closed/
  historical. Deployed and live.
- None of the above needs any further action right now — only Thasitha
  R2 was mid-flight when this restart interruption happened.

## Owner
Kuberan (AIOS) / Claude Code session

## Status
Discovery in progress, ~60% complete. No files written yet for this
requirement. Safe to resume exactly at "Next Steps" above.
