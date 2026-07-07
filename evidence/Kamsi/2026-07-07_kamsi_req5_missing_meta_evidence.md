# Evidence — Kamsi Requirement 5: Missing Meta Title & Meta Description Detection

**Title:** Kamsi Req 5 built — Missing Meta Title & Meta Description Detection, all Shopify products
**Purpose:** Prove the detection logic, data source, and dashboard were built exactly per the approved business rule, read-only
**Requirement Source:** Kamsi Google Sheet sample / screenshot provided by Kuberan
**Business Question:** Which Shopify product pages are missing manually added SEO meta title or meta description?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only, per instruction
**External Sources Checked:** None (GA4/GSC explicitly excluded)

## Step 1 — Existing asset discovery (results)
Searched `prompts/Kamsi/`, `evidence/Kamsi/`, `validation/Kamsi/`, `reports/Kamsi/`, `handover/Kamsi/`, `vercel/Kamsi/`, and all HTML pages under `reports/digital-marketing-member-pages/pages/`. No prior missing-meta-title/description report existed anywhere in the repo (full-text search for "meta-title"/"meta description"/"seo-title" returned nothing). Kamsi's dashboard already exists as 4 tab-linked pages (Req 1–4). **Decision: EXTEND** — add Requirement 5 as a new tab-linked page, same pattern as Req 1–4.

## Step 2 — Shopify data collection (read-only)
- Confirmed connected store: `ledsone.co.uk` (via `get-shop-info`) — same store as all other Kamsi/Dilaksi requirements.
- Used **Shopify Admin GraphQL Bulk Operations API** (`bulkOperationRunQuery`), read-only, two passes:
  1. First pass: id, handle, onlineStoreUrl, title, descriptionHtml, productType, updatedAt, seo{title,description}, collections(first:5){title}
  2. Second pass (added `tags`, needed for the Collection Type 3rd-priority fallback): same fields + `tags`
- Result: **5,179 products**, 101,207 JSONL records (product + nested collection edges), 35.3 MB.
- **No mutation performed. No product data changed.** Confirmed via Shopify's own read-only bulk query API (`bulkOperationRunQuery`, not `RunMutation` against product data).

## Step 3 — Detection logic implementation
Normalization: HTML tags stripped (regex `<[^>]+>` → space), whitespace collapsed, trimmed, lowercased for comparison only (original casing preserved for display).

- **Meta Title state:** `blank` if SEO title field empty after trim; `auto` if normalized SEO title equals normalized product title; else `ok`.
- **Meta Description state:** `blank` if SEO description field empty after trim; `auto` if normalized SEO description equals normalized product description **or** equals the first 160 normalized characters of it; else `ok`.
- **Meta Title Missing / Meta Description Missing** (booleans used for KPI cards and Yes/No filters): TRUE when state is `blank` OR `auto`, per Step 3 instruction.
- **Collection Type priority:** 1) `product_type` (populated for 4,935 of 5,179 products) → 2) first collection title → 3) first tag → 4) `"Not Available"`.
- **Action Needed** — applied as an ordered if/elif chain, exactly matching the priority order given in the task:
  1. Both title and description `blank` → "Add Meta Title and Meta Description"
  2. Title `blank` only → "Add Meta Title"
  3. Description `blank` only → "Add Meta Description"
  4. Title `auto` (and description not blank) → "Rewrite Meta Title"
  5. Description `auto` (and neither blank) → "Rewrite Meta Description"
  6. Else (both `ok`) → "OK"

  **Tie-break note:** the task's Action Needed rules don't define what happens when, say, title is `auto` and description is separately `blank` — my ordered chain resolves this by checking blank conditions first (rows 1–3) before auto-generated conditions (rows 4–5), so a blank field always takes priority over a same-row auto-generated field. This is a reasonable reading of an ordered instruction list, documented here for review.

## Step 3 results (5,179 products)
| Metric | Count |
|---|---|
| Meta Title: blank | 848 |
| Meta Title: auto-generated | 6 |
| Meta Title: OK (manual) | 4,325 |
| Meta Description: blank | 1,406 |
| Meta Description: auto-generated | 9 |
| Meta Description: OK (manual) | 3,764 |
| **Total Products Checked** | **5,179** |
| **Missing Meta Title** (blank+auto) | **854** |
| **Missing Meta Description** (blank+auto) | **1,415** |
| **Both Missing** | **795** |
| **OK Products** | **3,705** |

Action Needed breakdown: OK 3,705 · Add Meta Description 613 · Add Meta Title 55 · Add Meta Title and Meta Description 793 · Rewrite Meta Title 4 · Rewrite Meta Description 9.

## Step 4 — HTML dashboard
Built `kamsi-req5-missing-meta-detection.html` (live-site copy) + `reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html` (archival copy), same visual design system (CSS/tab-nav) as Dilaksi's requirement pages, adapted with a genuine sortable `<table>` (not accordion cards, per this task's explicit requirement) rendered client-side in pages of 100 for performance (5,179-row dataset embedded as JSON, filtering/sorting run in-memory — same architecture proven on Dilaksi Req 2 / Kamsi Req 4 after their earlier performance fix). Includes: 5 required KPI cards, search box, Collection Type filter, Action Needed filter, Missing Meta Title Yes/No/All toggle, Missing Meta Description Yes/No/All toggle, click-to-sort column headers, CSV export button (client-side, exports the currently filtered/sorted set), Last Updated timestamp in the header, mobile-responsive table (horizontal scroll on small screens), colour-coded badges (green=OK, orange=Add/Rewrite single field, red=Add both), and the required evidence note verbatim: *"Shopify auto-filled SEO metadata is treated as missing when it matches the product title or product description."*

Requirement 5 tab link added to Kamsi's existing Req 1–4 pages for consistent cross-navigation (label-only change, their own report content/data untouched).

## Files created
- `reports/digital-marketing-member-pages/pages/kamsi-req5-missing-meta-detection.html` (live-site)
- `reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html` (archival copy)
- `reports/Kamsi/data/2026-07-07_kamsi_req5_bulk_products.jsonl`, `..._v2.jsonl` (raw Shopify exports)
- `reports/Kamsi/data/2026-07-07_kamsi_req5_parse_and_detect.py` (parser + detection logic, auditable/re-runnable)
- `reports/Kamsi/data/2026-07-07_kamsi_req5_html_builder.py` (HTML builder)
- `reports/Kamsi/data/2026-07-07_kamsi_req5_missing_meta_log.csv` (full 5,179-row evidence CSV)
- `reports/Kamsi/data/2026-07-07_kamsi_req5_rows.json` (row-level dataset embedded in the page)
- Requirement 5 tab link added to `kamsi-req1-slow-moving-products.html`, `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html`, `kamsi-req4-product-priority-guidance.html`

**Dilaksi files touched:** none.

## Known limitations
- Only 6 products showed "auto-generated title" and 9 "auto-generated description" out of 5,179 — most missing-meta cases are genuinely blank fields, not Shopify auto-fill collisions. This is the actual data, not a detection-rule failure (verified via spot-check of several `auto` rows against the raw JSONL).
- Collection Type's 3rd-priority fallback (tag) is rarely reached since `product_type` is populated for the large majority of products; not fully exercised/tested against products lacking both product_type and collections (none were found in this catalog).
- Archival copies of Kamsi's Req 1–3 pages in `reports/Kamsi/` (the older `kamsi-requirement-{1,2,3}-*.html` snapshots) were **not** updated with the new Req 5 tab link — only the live `pages/` versions were, since those archival copies are static historical snapshots, not the navigable site.
- The Action Needed tie-break rule (blank takes priority over same-row auto-generated) is a documented interpretation of an otherwise-ambiguous ordered instruction list — flag to Kuberan if a different priority is intended.

**Evidence path:** this file · **Validation:** `validation/Kamsi/2026-07-07_kamsi_req5_missing_meta_validation.md`
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed locally — **not deployed** (deployment requires explicit approval, not yet requested)
**Next step:** Kuberan review of the tie-break rule above; deployment approval if desired
**PASS / FAIL:** PASS
