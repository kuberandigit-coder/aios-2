# Evidence — Muguntha Employee Performance Dashboard: Full Session Summary (2026-08-04)

**Purpose:** Detailed record of every change made to `pages/muguntha.html` / `api/muguntha.js` / `home.html` in this session, in chronological order, following on from the original dashboard build documented earlier the same day in `evidence/muguntha/2026-08-04_employee-performance-dashboard-sonya.md`.

This session covers 8 distinct sub-tasks. Nothing here duplicates the earlier build doc — it only covers what changed after that point.

---

## 1. DM campaign cost attribution added to Sonya's cost figures

**Problem:** Sonya's Sales already included any DM 46 campaign (`Pmax UK | Muguntha | Shoptimised | GB | DM 46 All | MCV | UK`, `campaign_id=20810136438`) order that contained one of her owned products (existing rule in `salesuk.js`/`sales25.js`), but her Cost only reflected her *own* Google Ads campaign group (`group_name='Sonya'`), never her share of DM's spend — an inconsistency between the Sales side and Cost side of the same dashboard.

**Fix:**
- `api/salesuk.js` — exported `SONYA_PRODUCT_IDS_UK` (a ~370-entry Set already used for Sales attribution) via `module.exports.SONYA_PRODUCT_IDS_UK = SONYA_PRODUCT_IDS_UK;` appended after the handler export, so it can be reused rather than duplicated.
- `api/muguntha.js` — added `queryDmCostsForMonth()`: sums `google_ads.product_performance.cost` for campaign `20810136438`, filtered to rows whose `split_part(product_item_id, '_', 3)` (the Shopify product ID embedded in Google's `shopify_gb_{productId}_{variantId}` format) is in Sonya's owned-product set. Also returns the DM campaign's unfiltered total cost (`dmTotalCost`) for transparency. Response now includes `cost` (own), `dmSonyaProductCost`, `dmTotalCost`, `totalCost` (own + DM share).
- Verified via direct SQL (ledsone-db-mcp) before implementing: product-level PMax cost doesn't sum to the full campaign cost (Google doesn't attribute 100% of PMax spend to specific products) — this is expected and documented in the dmTotalSource label, not a bug.

## 2. Iterative scoping of where DM cost applies (2026 → exclude 2025 → re-include 2025)

Three separate user instructions, applied in order:
1. Initial ask: fold DM's Sonya-product-share into Total Cost, with the DM campaign's full spend shown as a separate visible column for both years.
2. Correction: "for 2025 we not consider dm campaign... 2026 only show cost of sonya total cost" — removed the DM breakout columns entirely, reverted 2025 to own-cost-only, collapsed 2026 to a single Total Cost column with Own/DM shown in a bracket alongside the number rather than as separate columns.
3. Final correction (this session, most recent): "add dm campaign cost also 2025 all month like exact same as (own+dm)" — reversed step 2's 2025 exclusion; 2025 now uses the identical Own+DM Total Cost formula as 2026, same bracket format.

**Net result:** 2025 and 2026 both compute Total Cost identically: Own campaign cost + Sonya's product-share of DM 46's spend, displayed as `£X,XXX.XX (Own: £Y, DM: £Z)`.

## 3. 2025 month range extended to full year

- `MONTHS_2025` in `muguntha.html`: `['2025-01'..'2025-06']` → `['2025-01'..'2025-08']` (mid-session, after user asked for July/August specifically) → `['2025-01'..'2025-12']` (final, to match the parallel `sales25.js` full-year backfill).
- `MONTH_NAME` lookup dict extended to include September–December (was previously missing them, would have rendered `undefined` for those months).
- Cost-side snapshots generated for all of 2025-07 through 2025-12 via direct SQL (ledsone-db-mcp), written to `api/data/muguntha-sonya-2025-{07..12}.json`, same schema as the existing Jan–Jun snapshots (which already had DM fields from an earlier regen — confirmed via file inspection before writing new ones, no duplicate work).

## 4. UI redesign — sidebar/topbar restyle to match reference image

User supplied a screenshot of a police-department admin panel (dark navy sidebar, gold accent line, white card-based table, colored status pills) and asked for the same visual style. Rebuilt the page shell:
- Dark navy (`#0c1a30`/`#0e2143`) fixed sidebar with brand block, nav sections, "Developed by Kuberan" badge.
- Dark navy topbar with a 3px gold (`#c9a227`) bottom border.
- White card-based KPI row and table, navy table header with gold divider, color-coded pill badges (green "Not-Archived" / grey "Archived").
- All existing functional IDs (`kpiCards`, `tblBody`, `statusChip`, `refreshBtn`, `rowCount`, `mainTable`) preserved unchanged so the existing JS logic required zero changes for this step.

## 5. Professional color-coding pass

- Net values: green if ≥0, red if negative.
- ROAS / Target Achievement: green if at/above the 30% target, amber if within 70% of target, red below that.
- KPI cards: colored top border accent (blue default, green/red for growth-rate cards).
- Fixed a pre-existing HTML bug found during this pass: the "Not-Archived" status pill template literal had a typo (`<\span>` instead of `</span>`), which would have rendered literally instead of closing the tag.

## 6. Single-page multi-member navigation (no standalone pages)

User initially asked for sidebar links to each staff member's own performance page (`{name}-performance.html`), then corrected: "all others are in the same muguntha.html page no standalone page for members all are need to include in mugunhta.html tomorrow we will do for others". Reworked:
- Sidebar member links changed from `<a href="...">` to `<a href="#" data-member="...">` with a click handler (`selectMember()`) that toggles between `#panel-sonya` (the real dashboard) and `#panel-placeholder` (a "Coming soon" card) — all client-side, one HTML file, no page navigation.
- All 12 members included per two follow-up requests: Sonya (real), Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha, then Sajeepan, Theekshy, Jackson, Hetheesha, Thivajini (placeholder "coming soon" for all except Sonya).

## 7. Navigation cleanup

- Removed the "Reports" sidebar section (Sales UK / Sales 2025 standalone links) and the self-referencing "Muguntha" Management link — Sonya's tab under "Performance Analysis" now serves that purpose directly.
- Added a "Sales" link (`./sales2.html`) under the "Main" section, alongside "Overview".
- Removed the "Back to dashboard" button from the sidebar footer entirely (no longer needed given the Overview link already exists in Main).
- Removed the standalone "Management" section/card for Muguntha from `home.html` — the dashboard is now only reached via its own page, not a home.html tile.

## 8. KPI card cleanup

Removed 5 of the original 12 KPI cards per explicit user confirmation ("Keep only Sales/Net/ROAS — drop all Cost cards"): Total Employees, 2025 Cost, 2026 Total Cost, Cost Growth %, Target ROAS. Remaining 7: 2025 Sales, 2026 Sales, Sales Growth %, 2025 Net Profit, 2026 Net Profit, Net Growth %, Avg ROAS (2026).

---

## Files touched this session
- `reports/digital-marketing-member-pages/pages/muguntha.html` (all UI/JS changes above)
- `reports/digital-marketing-member-pages/api/muguntha.js` (DM cost query)
- `reports/digital-marketing-member-pages/api/salesuk.js` (exported `SONYA_PRODUCT_IDS_UK`)
- `reports/digital-marketing-member-pages/home.html` (removed Management/Muguntha card)
- `reports/digital-marketing-member-pages/api/data/muguntha-sonya-2025-{01..12}.json` (regenerated Jan–Jun with DM fields, created Jul–Dec new)
- `reports/digital-marketing-member-pages/api/data/muguntha-sonya-2026-{01..07}.json` (regenerated with DM fields)

## Deployment
Multiple incremental production deploys to `https://digital-marketing-member-pages.vercel.app` throughout the session (one per logical change, per the project's deploy-then-verify-then-push workflow). Final live URL for this page: https://digital-marketing-member-pages.vercel.app/pages/muguntha.html

**Status:** PASS — all changes deployed and spot-verified live via curl against `/api/muguntha` and `/api/sales25`.
**Reviewer:** Muguntha (pending review)
**Next step:** Build out the real performance-analysis data (Sales + Cost, same Own+DM formula) for the remaining 11 members — explicitly deferred by the user to "tomorrow."
