---
task: Mahima Requirement 1 — Full Rebuild (Product Performance Report)
date: 2026-07-10
team_member: Mahima
---

## Title
Mahima Requirement 1 — Full Rebuild — Reusable Prompt

## Purpose
Reusable execution prompt for the full-replacement rebuild of Req1 (Tab 1 on the live
mahima.html staff page). Re-run with an updated date/window if this needs refreshing.

## Requirement source
Kuberan, 2026-07-10 — "Completely remove the existing Mahima Requirement 1 implementation and
rebuild it from scratch using verified data sources and business requirements. Full replacement,
not an incremental update."

## Team member
Mahima (Owner) · Kuberan (Reviewer)

## Business question
Product-level Google Ads performance for ledsone.de: Campaign, Item ID, Product, Clicks,
Impressions, Conversions, Cost, Conversion Value, ROAS, Status (Merchant Center eligibility),
Missing Attribute (feed issues) — with no fabricated values for fields that don't exist in
PostgreSQL.

## PostgreSQL sources checked
- `google_ads.product_performance` (final source for performance metrics)
- `google_ads.campaigns` (confirm the 5 campaign IDs belong to `account_id = 9031058245` =
  ledsone.de)
- `google_ads.merchant_products` (product title lookup)
- `raw_data.gmc_product_diagnostics_daily` — **re-verified 2026-07-10: table no longer exists
  at all** (was empty on 2026-07-09, now `relation does not exist`). Confirms Status/Missing
  Attribute remain unavailable in PostgreSQL.

## Prompt (verbatim scope used)
1. Confirm no duplicate Req1 rebuild already exists (this IS the sanctioned full replacement,
   not a new duplicate).
2. Re-verify PostgreSQL absence of Status/Missing Attribute source (do not trust yesterday's
   doc blindly — re-run the check).
3. Identify the correct campaign scope: 5 ledsone.de campaigns (20763699505, 23684789991,
   23053104908, 23431543574, 23926509987), confirmed via `google_ads.campaigns.account_id`.
4. Pull last-30-day product×campaign aggregates from `google_ads.product_performance`.
5. Join product titles from `google_ads.merchant_products` via numeric product-id segment
   extraction (`split_part(product_id,'_',3)`), preferring DE-country/EUR-currency feed rows.
6. Compute ROAS = conv_value/cost (0 when cost=0, never divided by zero).
7. Set Status and Missing Attribute to the literal string "Not Available in PostgreSQL" for
   every row — no proxy/heuristic, no fabrication.
8. Validate against the example: campaign "Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG |
   priceGT10_5 | MCV" × product 8278561882377.
9. Surgically remove ALL old Tab 1 HTML/CSS/JS/data (old ROWS/DAY arrays, badgeClass,
   rangeBase/pickRange/daysBetween date-picker feature, old rowHtml/render/applyFilter) from
   `reports/digital-marketing-member-pages/pages/mahima.html`, without touching Tab 2 (Stock
   Management) or Tab 3 (Search Terms) markup, data, or shared utility functions (`esc`,
   `debounce`, `naSpan`).
10. Rebuild Tab 1 from scratch with the new column set and honest N/A labeling.
11. Verify: full inline `<script>` block passes `node --check`; every new `getElementById`
    target exists exactly once; ROWS1/ROWS2/ROWS3 all present and independently JSON-parseable;
    no leftover fragments of old Tab 1 code (grep for `pickRange`, `rangeBase`, `daysBetween`,
    `badgeClass`, old `const ROWS=`/`const DAY=`).

## Files created or modified
- `reports/digital-marketing-member-pages/pages/mahima.html` (Tab 1 fully replaced; Tab 2/Tab 3
  untouched)
- `reports/mahima/data/2026-07-10_mahima_req1_rebuild_calc_builder.py` (new)
- `reports/mahima/data/2026-07-10_mahima_req1_rebuild_splice_script.py` (new)
- `reports/mahima/data/2026-07-10_mahima_req1_rebuild_raw.json` (new, gitignored — raw computed
  rows)
- `reports/mahima/data/2026-07-10_mahima_before_req1_rebuild_backup.html` (new — pre-edit backup
  of the live file)

## Evidence location
`evidence/mahima/2026-07-10_mahima_req1_rebuild_evidence.md`

## Validation result
See `validation/mahima/2026-07-10_mahima_req1_rebuild_validation.md`

## Owner / Reviewer
Owner: Mahima · Reviewer: Kuberan

## Status
Done, deployed to production Vercel (pending user confirmation before this run — deploy handled
separately per prior approval pattern).

## Known limitations
- Status and Missing Attribute are "Not Available in PostgreSQL" for all 4,249 rows — confirmed
  absent, not fabricated. See open developer request:
  `reports/mahima/2026-07-09_postgres_developer_request_feed_status_missing_attribute.md`.
- Product title matched for 87.9% of rows (3,738 of 4,249); the rest show "Data Missing" in the
  Product column due to Merchant Center feed duplication across currencies/feed-labels.
- Date range is a rolling last-30-days window as of build time, not a fixed historical range —
  re-running this build on a different day changes totals by design.

## Next steps
Kuberan/Mahima review the rebuilt Tab 1 → confirm the "Not Available in PostgreSQL" labeling is
acceptable (vs. the prior version's heuristic proxy) → if the GMC diagnostics pipeline is ever
built, wire Status/Missing Attribute to the real data.

## PASS / FAIL result
**PASS**
