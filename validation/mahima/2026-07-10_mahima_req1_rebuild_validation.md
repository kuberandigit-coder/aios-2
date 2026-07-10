---
task: Mahima Requirement 1 — Full Rebuild (Product Performance Report)
date: 2026-07-10
team_member: Mahima
---

## Title
Mahima Requirement 1 — Full Rebuild — Validation

## Purpose
Confirm the rebuilt Tab 1 meets the full requirement set: correct source, correct formulas,
correct field/filter coverage, no production changes.

## Requirement source
Kuberan, 2026-07-10 (full replacement + follow-up UI/data requests, see prompt/evidence docs)

## Business question
Product-level Google Ads performance for ledsone.de with honest handling of unavailable fields.

## PostgreSQL sources checked
`google_ads.product_performance`, `google_ads.campaigns`, `google_ads.merchant_products`,
`google_ads.ad_group_products`, `raw_data.gmc_product_diagnostics_daily` (confirmed absent) —
all read-only SELECT, no writes.

## Validation checklist

| Check | Result |
|---|---|
| Old Req1 (HTML/CSS/JS/data) fully removed | PASS — verified via grep for `pickRange`, `rangeBase`(orig), `daysBetween`(orig), `badgeClass`, old `const ROWS=`/`const DAY=`; none found |
| Duplicate Req1 not created | PASS — same file/tab updated in place |
| Date range restored to full Jan 1–Jul 10 2026 | PASS — 6,938 rows over the full window |
| Date range filter (2 calendar inputs) added and functional | PASS — client-side recompute from embedded daily data (224,111 entries, 191 dates) |
| 7-Day ROAS column, formula exact | PASS — `(SUM(conv_value,7d)/SUM(cost,7d))×100`, fixed anchor to today, independent of range picker |
| 30-Day ROAS column, formula exact | PASS — `(SUM(conv_value,30d)/SUM(cost,30d))×100`, same anchor rule |
| Status = Not Available in PostgreSQL, honestly | PASS — confirmed via 3 independent checks (diagnostics table absent, ad_group_products unreliable/PMax-incompatible, merchant_products has no status column) |
| Missing Attribute = real per-product data | PASS — 10 feed-quality attributes checked per product from `merchant_products`, matched for 6,386/6,938 rows (92.0%) after join-bug fix |
| Missing Attribute visually distinct/colour-coded | PASS — green/amber/red/grey badges |
| Toolbar CSS restyled | PASS — `.toolbar1`/`.flabel1`, consistent sizing, focus states |
| Additional filters (Missing Attribute, Conversions) | PASS — both wired to `applyFilter1()`, plus Clear Filters button |
| No PostgreSQL writes | PASS |
| No Google Ads changes | PASS |
| Tab 2 (Stock Management) untouched | PASS — ROWS2 10,133 rows verified intact after every edit |
| Tab 3 (Search Terms) untouched | PASS — ROWS3 1,768 rows verified intact after every edit |
| showTab() wiring correct for all 3 tabs | PASS |
| Full inline `<script>` passes `node --check` | PASS — re-verified after every edit in this session |

## Numeric spot-check (screenshot cross-check)
Product `8278561882377`, campaign "Pmax DE | Mahi | Shoptimised| BESTEN-BELEUCHTUNG":
- User's Google Ads UI screenshot (Jan 1–Jul 7): 4,573 impr / 73 clicks / €47.31 cost / €84.11
  conv. value / 0.98 conversions.
- This build (Jan 1–Jul 10, 3 extra days): 4,584 impr / 73 clicks / €47.32 cost / €84.11 conv.
  value / 0.98 conversions. ROAS = 84.11/47.32 = 1.78x ✓. Missing Attribute = `item_group_id,
  mpn, color` (real, not fabricated).

## Known limitations (carried into report Notes)
1. Status is Not Available in PostgreSQL for all 6,938 rows — genuine data gap, documented with
   3 independent verification checks.
2. Missing Attribute covers only the 10 feed-quality columns in `merchant_products`, not
   Google's policy/disapproval issue codes.
3. 552 of 6,938 rows (8%) have no findable feed entry under any known ID format — shown
   honestly, not guessed.
4. 7-Day/30-Day ROAS are fixed to real-time windows and intentionally do not respond to the
   date-range picker, per the requirement's own formula definition.

## PASS / FAIL result
**PASS**
