---
task: Mahima Requirement 2 — Stock Management, Tab 2 on mahima.html
date: 2026-07-09
team_member: Mahima
status: Done, local device only — not pushed
---

## Title
Mahima Requirement 2 — Stock Management (Tab 2) — Handover

## Purpose
Explain what was built, where it lives, and what's left before it can go live.

## Requirement source
Kuberan, 2026-07-09 — see `prompts/mahima/2026-07-09_mahima_req2_stock_management_prompt.md`

## Business question
Which Shopify products need restocking, monitoring, no restock yet, or stop purchasing based on
current stock and last 30-day sales?

## What was built
A second tab, **"Tab 2: Stock Management"**, added to the same `mahima.html` page as
Requirement 1's Product Performance Report. Tab switching via two buttons at the top of the
page. Tab 2 contains:
- 6 KPI cards (Total SKUs 10,133; Fast Moving 48; Healthy 11; Slow Moving 336; Never Moving
  9,728; Restock Needed 48)
- Search box (SKU/title), Status filter, Action filter, Category filter (132 real categories,
  populated dynamically from the data)
- Paginated table (100 rows/page) with all 11 required columns
- Data source note, calculation rules note, known limitations note — matching Tab 1's style

## Shopify sources checked
- `get-shop-info` → confirmed ledsone.de
- `productsCount` → 2,524 products
- Admin GraphQL `bulkOperationRunQuery` full catalog export → 12,657 objects (bulk op
  `gid://shopify/BulkOperation/9514590175497`)
- ShopifyQL `run-analytics-query` inventory report (30-day window) → 10,233 rows
- Cross-check ShopifyQL sales query on one SKU → confirmed consistent

## Files created or modified
- **Modified:** `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`
  (local device only — this is the working copy of the `staff` remote
  `digitalmarketing69140951-sys/Staff-requirements`, cloned locally on 2026-07-09 for this
  task; **not pushed**, per Kuberan's explicit mid-task instruction)
- Earlier in the same session, also removed the "Feed Status" column from Tab 1 of this same
  file (separate small edit, also local-only)
- **Created (kuberan-web repo, committed separately if/when approved):**
  - `prompts/mahima/2026-07-09_mahima_req2_stock_management_prompt.md`
  - `evidence/mahima/2026-07-09_mahima_req2_stock_management_evidence.md`
  - `validation/mahima/2026-07-09_mahima_req2_stock_management_validation.md`
  - `handover/mahima/2026-07-09_mahima_req2_stock_management_handover.md` (this file)
  - `reports/mahima/2026-07-09_mahima_req2_stock_management_report_note.md`
  - `vercel/mahima/2026-07-09_mahima_req2_stock_management_vercel_notes.md`
  - `reports/mahima/data/2026-07-09_mahima_req2_build_stock_report.py` (catalog+inventory join script)
  - `reports/mahima/data/2026-07-09_mahima_req2_compute_rules.py` (Avg Daily Sales/Days Remaining/Status/Action calculator)
  - `reports/mahima/data/2026-07-09_mahima_req2_stock_summary.json` (final counts)

## Evidence location
`evidence/mahima/2026-07-09_mahima_req2_stock_management_evidence.md` (full source trail,
join methodology, row counts)

## Validation result
PASS — see `validation/mahima/2026-07-09_mahima_req2_stock_management_validation.md`

## Owner / Reviewer
Owner: Mahima · Built by: Claude Code · Reviewer: Kuberan

## Status
Done — **local device only**. Not committed to git, not pushed, not deployed to the OneDrive
copy or Vercel. Kuberan asked mid-task to keep this change local-only, so no git operations
were run on the Staff-requirements clone.

## Known limitations
1. Product Category Data Missing for 207/10,133 rows (2.0%) — no `productType` and no safe
   collection fallback available.
2. Last 30-Day Sales Data Missing for 10/10,133 rows (0.1%) — variant not present in the
   30-day inventory report (likely very recently added).
3. SKU blank for 13/10,133 variants (0.1%) — genuine gap in the Shopify catalog.
4. Snapshot as of 2026-07-09, not auto-refreshing.
5. Grain is Shopify variant/SKU (not parent product) — by design, per the requirement.

## Next steps
1. Kuberan reviews Tab 2 locally at
   `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`.
2. If approved: commit + push to the `staff` remote, and/or mirror to the OneDrive deployed
   copy (`reports/digital-marketing-member-pages/pages/mahima.html`) — neither was done yet,
   awaiting explicit go-ahead.
3. If a live-refreshing version is wanted later, the same bulk-operation + ShopifyQL method
   documented in the evidence file can be re-run and the script re-executed.

## PASS / FAIL result
**PASS** (build + validation). Deployment step intentionally not taken — local-only per
instruction.
