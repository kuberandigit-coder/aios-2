# Handover — Muguntha Employee Performance Dashboard: Sajeepan Panel (2026-08-04)

**Title:** Muguntha Dashboard — Sajeepan Performance Panel (2nd of 12 members)
**Requirement:** Build Sajeepan out with the exact same Sales/Cost data pipeline, formulas, and UI treatment already proven for Sonya (see `handover/muguntha/2026-08-04_full-session-summary.md` for Sonya's build).
**Files Modified:** `pages/muguntha.html` (Sajeepan panel + parameterized shared JS), `api/muguntha.js` (generalized to multi-employee), `api/salesuk.js` (exported `SAJEEPAN_PRODUCT_IDS_UK`)
**Files Created:** `api/data/muguntha-sajeepan-2025-{01..12}.json`, `api/data/muguntha-sajeepan-2026-{01..07}.json` (19 new snapshots)
**Evidence Location:** `evidence/muguntha/2026-08-04_sajeepan-performance-panel.md`
**Validation Result:** `validation/muguntha/2026-08-04_sajeepan-performance-panel.md` — PASS
**Owner:** Muguntha
**Status:** Deployed and verified live.
**Known Limitations:**
- 10 members still pending (Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha, Theekshy, Jackson, Hetheesha, Thivajini) — still show "Coming soon" placeholder.
- 2026-08 (current live month) is never snapshotted for either Sonya or Sajeepan — always a live Postgres query, per the existing `CURRENT_LIVE_MONTHS`/`LIVE_2026` pattern.
**Next Step:** Repeat this same pattern for the next member the user asks for — add an entry to `EMPLOYEES` in `api/muguntha.js` (group_name + product-ID Set + snapshot slug), add a `panel-<member>` div + filters bar to `muguntha.html`, add them to `BUILT_MEMBERS`, generate snapshots via direct SQL, deploy, verify, document.
**PASS/FAIL:** PASS

## What was done
1. Confirmed Sajeepan's Sales-side attribution already existed in `sales25.js`/`salesuk.js` (`SAJEEPAN_CAMPAIGNS_UK`, `SAJEEPAN_PRODUCT_IDS_UK`, etc.) — no new Sales logic written, just called the existing `group=sajeepan` endpoints.
2. Confirmed via SQL that Sajeepan's Google Ads campaign group is named `SAJEEPAN` (all caps, account_id 4503486236).
3. Exported `SAJEEPAN_PRODUCT_IDS_UK` from `salesuk.js` (same pattern as the existing `SONYA_PRODUCT_IDS_UK` export).
4. Generalized `api/muguntha.js` from a Sonya-only endpoint to a multi-employee one (`?employee=sonya|sajeepan`, default `sonya` for backward compatibility) via an `EMPLOYEES` config map, without changing Sonya's response shape or values.
5. Added `panel-sajeepan` to `muguntha.html` with its own DOM IDs, and parameterized the previously Sonya-only JS functions (`loadAll`, `fetchGroupSales`, `fetchCost`, `renderTable`, `renderCards`) so both members share one implementation.
6. Generated 19 cost snapshots (2025-01 through 2026-07) directly via SQL, matching the existing snapshot JSON schema.
7. Deployed to production, verified via curl (Sales endpoints, Cost endpoint × 3 months across both years, Sonya regression check, deployed-page content check).

## Where to find things
- Page: `reports/digital-marketing-member-pages/pages/muguntha.html` (`#panel-sajeepan`)
- Backend: `reports/digital-marketing-member-pages/api/muguntha.js` (`EMPLOYEES.sajeepan`)
- Shared product-ID export: `reports/digital-marketing-member-pages/api/salesuk.js` (`module.exports.SAJEEPAN_PRODUCT_IDS_UK`)
- Cost snapshots: `reports/digital-marketing-member-pages/api/data/muguntha-sajeepan-*.json`

## Risks / open questions
- Same PMax-product-attribution caveat as Sonya's: `google_ads.product_performance` (DM 46 product-level cost) doesn't sum to `google_ads.campaign_performance` (DM 46 full campaign cost) — Google doesn't attribute 100% of PMax spend to specific products. Expected, documented in the panel footnotes, not a bug.
- `api/muguntha.js`'s response still includes the legacy `dmSonyaProductCost` field (only populated when `employee=sonya`) alongside the new generic `dmProductCost` field, to avoid breaking any other consumer of the old field name. Future employees should read `dmProductCost` only.
