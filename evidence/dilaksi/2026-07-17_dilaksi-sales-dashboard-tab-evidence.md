# Evidence — Dilaksi Sales Dashboard Tab (mirrors Kamsi tab)

**Title:** "Dilaksi" tab added to the staff sales dashboard, replicating Kamsi's tab architecture and organic-sales definition
**Purpose:** Give Dilaksi (SEO team) her own historical (Jan–Jun 2026) product-sales view, scoped to her owned Shopify collections, with the same 6-group organic-sales definition already finalized for Kamsi
**Date:** 2026-07-17 · **Team member:** Dilaksi · **Team:** SEO · **Store:** ledsone.co.uk

## Business question
Which of Dilaksi's SEO-owned products actually sold, and through which channels (Fully Organic, First-Session Organic, Direct, Referral, No Journey Data, AI Tools), for each closed month Jan–Jun 2026 — same question already answered for Kamsi, now for Dilaksi's product scope.

## Step 1 — Product allocation source (corrected mid-task)
**Initial approach (superseded):** started building the allocation from `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html`, but that report turned out to be a store-wide "all products, all 475 collections" (5,179 products) SEO priority report — not a curated ownership list, and it carries no Shopify Product ID/GID at all (titles only, with an internal `~NNNN` row-index suffix).

**Corrected approach (used):** the user supplied the authoritative list — 24 specific Shopify collections that define Dilaksi's product ownership:
`pendant-lights, wall-light, plugin-lighting, table-lamps, spider-light, pipe-lighting, ceiling-lights-for-flash-lights, easy-fit-shades, led-panels, led-modules, pendant-holder, chandelier, hemp-collection, clocks, kitchen-items, fitting-items, handles, artificial-flower-pots, door-mat, foot-wear, storage-bags, belt, sports-accessories, office-items`.

A temporary read-only debug endpoint (`api/tmp-dilaksi-collections.js`, deleted after use — never committed) queried Shopify Admin GraphQL `collectionByHandle(handle) { products(first:100) { ... variants(first:100) { id legacyResourceId sku } } }` for each of the 24 handles, paginating with `after` cursors, and unioned all products by Product ID (de-duplicated — a product can belong to more than one of Dilaksi's collections).

**Results:**
- All 24 collection handles resolved successfully — **zero not-found/typo handles**.
- **1,615 unique products** found across the 24 collections (17,542 variants total across the whole store; this is Dilaksi's scoped subset).
- **7,071 unique variants** captured with real Variant IDs and Variant GIDs (unlike Kamsi's allocation, which had to mark variant IDs `MISSING_FROM_DB` — this query returns them live).
- **165 products** belong to more than one of Dilaksi's 24 collections (counted once each in the allocation, per instruction).
- Zero duplicate Product IDs, zero empty/rejected IDs in the final CSV.

Saved to `reports/dilaksi/data/2026-07-17_dilaksi-product-allocation.csv` (1,615 data rows + header), matching Kamsi's allocation CSV column schema exactly (`staff_name,department,store,shopify_product_id,shopify_product_gid,product_title,product_handle,product_url,product_status,variant_count,variant_ids,variant_gids,skus,collection_count,collection_ids,collection_handles,collection_titles,collection_urls,ownership_method,primary_source,source_updated_at,extracted_at,included_in_current_sales_scope,exclusion_reason`). `collection_ids` (numeric Shopify collection IDs) is marked `MISSING_FROM_DB` — the query used handles/titles/URLs as identifiers, not numeric IDs; this does not affect product matching, which is Product/Variant ID-based. Copied verbatim to `reports/digital-marketing-member-pages/api/data/dilaksi-product-allocation.csv` for Vercel bundling.

## Step 2 — `api/sales-dilaksi.js`
Copied `api/sales-kamsi.js` verbatim and did a scoped find/replace (`Kamsi`→`Dilaksi`, `kamsi`→`dilaksi`) — all classification/journey/matching logic is identical (store-wide logic, not staff-specific): paid/organic/direct/referral/social/email/affiliate session classification, FULLY_ORGANIC / FIRST_SESSION_ORGANIC / MIXED_JOURNEY / NON_ORGANIC / NO_JOURNEY_DATA journey rules, AI_SOURCES list, exact refund matching by line-item ID, the DST-aware Europe/London month-boundary logic, and the `created_at` query-parser fix already baked into the file being copied. `SUPPORTED_MONTHS` unchanged (`2026-01` through `2026-06`). Verified zero leftover "Kamsi"/"kamsi" strings and corrected two stale internal comment paths (allocation file path/date) after the copy.

## Step 3 — 6 static monthly snapshots
Local `.env.local` Shopify credentials pulled empty (Vercel treats `SHOPIFY_UK_*` as Sensitive env vars, only resolvable server-side on a Production deployment, not via `vercel env pull`). Generated the snapshots by deploying the project to Vercel Production and curling the live `/api/sales-dilaksi?month=<month>&refresh=1` endpoint for each of the 6 months, saving each response as `reports/digital-marketing-member-pages/api/data/dilaksi-sales-2026-0X.json` (X=1..6). Re-ran this fetch after the Step 1 correction so all 6 snapshots are built against the corrected 1,615-product allocation.

**Verification — all 6 months returned `success:true`, consistent allocationStats (`totalRows:1615, uniqueVariantIds:7071, duplicateProductIdsFound:0, emptyIdsRejected:0, variantIdsAvailable:true`):**

| Month | Orders (combinedSummary) | Gross Sales | Net Sales | Currency |
|---|---|---|---|---|
| 2026-01 | 282 | £12,499.70 | £11,944.51 | GBP |
| 2026-02 | 268 | £10,216.44 | £9,824.66 | GBP |
| 2026-03 | 352 | £19,017.84 | £17,905.76 | GBP |
| 2026-04 | 364 | £17,443.46 | £16,907.87 | GBP |
| 2026-05 | 327 | £15,715.70 | £15,336.22 | GBP |
| 2026-06 | 350 | £17,176.88 | £16,234.50 | GBP |

(`combinedSummary` = Fully Organic + First-Session Organic + Direct + Referral + No Journey Data + AI Tools, mirroring Kamsi's definition exactly.)

## Step 4 — "Dilaksi" tab in `sales.html`
Added a new tab button (`tabBtnDilaksi`) next to Kamsi's, and a structurally identical `tabDilaksi` div (month tabs, KPI cards, top-of-tab "Export CSV" button, 6-group breakdown table, line-item order table with search/filter/CSV export, session-detail expand rows, footnotes) — built by programmatically duplicating the Kamsi block and remapping every id/function/variable to a `d`/`D`-prefixed, non-colliding name (`D_DATA`, `D_CURRENT_MONTH`, `dSelectMonth`, `dLoad`, `dRenderAll`, `dGroupOf`, `dcFlatRows`, `dcGroupBreakdown`, `dcRenderAll`, `dcRenderTable`, `dcExportCsv`, `dGroupExportCsv`, all `d*`/`D_*` element IDs). Verified: zero duplicate HTML `id` attributes on the page, the inline `<script>` block parses cleanly (`new Function(...)` succeeded), zero leftover "Kamsi"/"kamsi" text inside the Dilaksi tab's HTML, fetches point at `/api/sales-dilaksi`. Both `kLoad(false)` and `dLoad(false)` are called on page load so both tabs' data is ready before the user switches tabs. The two footnote lines that were factually specific to Kamsi's allocation (source path/date, and the "no persistent Variant IDs" limitation) were rewritten for Dilaksi's actual situation (live variant-level matching available, unlike Kamsi).

The two detail tables are restricted to the same 6 groups as Kamsi's (Fully Organic, First-Session Organic, Direct, Referral, No Journey Data, AI Tools) via `dGroupOf()`, excluding Google Ads/Paid Search, Social, Email, Affiliate, and non-AI Other — identical logic to Kamsi's `kGroupOf()`, just under non-colliding names.

## Files created/modified
- `reports/dilaksi/data/2026-07-17_dilaksi-product-allocation.csv` (new, 1,615 rows)
- `reports/digital-marketing-member-pages/api/data/dilaksi-product-allocation.csv` (new, copy for Vercel)
- `reports/digital-marketing-member-pages/api/sales-dilaksi.js` (new)
- `reports/digital-marketing-member-pages/api/data/dilaksi-sales-2026-01.json` through `-06.json` (new, 6 files)
- `reports/digital-marketing-member-pages/pages/sales.html` (modified — Dilaksi tab added)
- `reports/digital-marketing-member-pages/api/tmp-dilaksi-collections.js` — temporary, created and deleted within this session, never committed

## Guardrails
Kamsi's tab, all classification logic shared with Kamsi's endpoint, and all other member pages untouched. No live Shopify data was modified — read-only GraphQL queries only. Product allocation is verifiably live-sourced (24 real collection handles, zero typos/not-found), not invented or guessed.

**Status:** Completed — 6/6 monthly snapshots generated and verified, Dilaksi tab built and verified structurally sound, temp debug endpoint removed, ready for commit/push/deploy.
**Known limitation:** `collection_ids` (numeric) not populated in the allocation CSV — handles/titles/URLs used instead; does not affect sales matching (Product/Variant ID-based).
**Next step:** commit, push, `vercel --prod` deploy, then user spot-check against Shopify Admin for one or two orders per month.
