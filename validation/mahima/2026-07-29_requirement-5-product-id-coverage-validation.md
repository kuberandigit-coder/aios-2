# Validation — Mahima Requirement 5: Product ID Coverage

**Title:** Product ID Coverage Tab — validation
**Purpose:** Confirm the live endpoint and UI produce correct, non-fabricated results per the exact spec logic.
**Requirement Source:** prompts/mahima/2026-07-29_requirement-5-product-id-coverage-prompt.md
**Team Member:** Mahima

## Checks performed
1. `node --check api/requirement.js` — syntax valid.
2. SQL validated directly against live PostgreSQL (bounds/range/prev-range CTEs, then full query with LIMIT 5) — correct shape, no errors.
3. Live production endpoint `GET /api/requirement?fn=mahima-req5` — `success:true`, `summary.totalProducts:5274` (matches the live-verified DE catalog count).
4. Spot-checked one in-campaign row: cost 54.93, conv_value 68.20 → ROAS 1.24 (68.20/54.93 = 1.2417, rounds to 1.24) ✓. prevRoas 3.90 > roas 1.24 → roasTrend "Down" ✓ (matches rule: ROAS < Previous ROAS → Down).
5. Spot-checked one not-in-campaign row: campaigns=[], cost/clicks/impressions all 0, roas/prevRoas null, roasTrend "N/A" ✓. feedStatus "Not Eligible" (missing item_group_id/mpn/color/condition) → action correctly "Fix Feed First — Not Enrolled" (not-in-campaign branch, feed not eligible) ✓.
6. Priority mapping verified: both spot-checked rows show action∈{Optimize Feed, Fix Feed First — Not Enrolled} → priority "High" ✓ (matches spec's Priority rule).
7. UI: Tab 5 button, panel, KPI cards, filters, colored badges, legend, sources, and known-limitations sections all present in `pages/mahima.html`; verified live via `curl` against the deployed page (`Requirement 5 — Product ID Coverage` string present).

## Result
**PASS** — all spot-checked calculations match the exact spec formulas; no fabricated values; Feed Status/Missing Attribute honestly labelled as a derived proxy (not real GMC data) with the underlying gap documented, consistent with Req1's precedent and the user's explicit sign-off to proceed on that basis.

## Known data-shape note (not a bug)
Because most of the DE merchant feed's `product_category`/`item_group_id`/`mpn`/`color`/`condition` columns are frequently blank, the derived Feed Status flags ~99.8% of products as "Not Eligible" (5,264 of 5,274). This is an honest reflection of the proxy's bluntness, not a defect — documented in the tab's own "Known limitations" panel.
