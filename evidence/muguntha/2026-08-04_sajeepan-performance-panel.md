# Evidence — Muguntha Employee Performance Dashboard: Sajeepan Panel Added (2026-08-04)

**Purpose:** Detailed record of building Sajeepan's real-data performance panel into `pages/muguntha.html`, mirroring Sonya's proven data pipeline, formulas, and UI treatment exactly. Follows on from the earlier session doc `evidence/muguntha/2026-08-04_full-session-summary.md`, which built Sonya's panel and left the other 11 members (including Sajeepan) as "Coming soon" placeholders.

---

## 1. Confirmed pre-existing groundwork (no new attribution logic written)

- `api/sales25.js` and `api/salesuk.js` already support `group=sajeepan` — `SAJEEPAN_CAMPAIGNS_UK`, `SAJEEPAN_TERMS`, `SAJEEPAN_PRODUCT_IDS_UK`, `orderHasSajeepanProduct()`, `isSajeepanCampaignUk()` all pre-existed in both files (confirmed via grep before any changes).
- Confirmed via direct SQL (`SELECT DISTINCT group_name FROM google_ads.campaigns WHERE account_id=4503486236 AND group_name ILIKE '%saj%'`) that the Google Ads campaign group name is `SAJEEPAN` (all caps) — different casing convention from `Sonya`.

## 2. `api/salesuk.js` — exported `SAJEEPAN_PRODUCT_IDS_UK`

Appended one line after the existing `module.exports.SONYA_PRODUCT_IDS_UK = SONYA_PRODUCT_IDS_UK;`:
```js
module.exports.SAJEEPAN_PRODUCT_IDS_UK = SAJEEPAN_PRODUCT_IDS_UK;
```
So `api/muguntha.js` can reuse the same ~800-entry product-ID Set already used for Sales attribution, without duplicating it.

## 3. `api/muguntha.js` — generalized from Sonya-only to multi-employee

Rewrote the endpoint to accept `?employee=sonya|sajeepan` (default `sonya`, preserving backward compatibility with the existing `pages/muguntha.html` calls that predate this change). Key changes:
- New `EMPLOYEES` config map: `{ sonya: { groupName: 'Sonya', productIds: SONYA_PRODUCT_IDS_UK, snapshotSlug: 'sonya' }, sajeepan: { groupName: 'SAJEEPAN', productIds: SAJEEPAN_PRODUCT_IDS_UK, snapshotSlug: 'sajeepan' } }`.
- `ownCostQuery(groupName)` and `queryDmCostsForMonth(productIds, month)` parameterized instead of hardcoded to Sonya.
- Snapshot fast-path now reads `api/data/muguntha-{snapshotSlug}-{month}.json` — `muguntha-sonya-*.json` for Sonya (unchanged), `muguntha-sajeepan-*.json` for Sajeepan (new).
- Response includes both `dmProductCost` (new generic field name) and `dmSonyaProductCost` (kept only when `employee=sonya`, for backward compatibility with any cached Sonya snapshot files still using the old field name).
- Same `LEDSONE_ACCOUNT_ID=4503486236` and `DM_CAMPAIGN_ID='20810136438'` (DM 46 campaign) constants reused unchanged.

## 4. `pages/muguntha.html` — Sajeepan panel and generalized JS

- Added `<div id="panel-sajeepan">` mirroring `panel-sonya`'s structure exactly (KPI cards div `kpiCards-sajeepan`, table with the same 12 columns, `tblBody-sajeepan`, `rowCount-sajeepan`, footnotes block explaining the Sajeepan-specific data sources/formula).
- Added a second filters bar `#sajeepanFilters` (status chip `statusChip-sajeepan`, button `refreshBtn-sajeepan`) — hidden by default, shown only when Sajeepan's tab is active.
- Parameterized the JS functions that were previously Sonya-only so both members share one implementation instead of two copy-pasted code paths:
  - `fetchGroupSales(endpoint, member, month, force)` — `member` param passed through to `?group=` query string.
  - `fetchCost(member, month, force)` — calls `/api/muguntha?employee=<member>&month=...`; reads `data.dmProductCost` with a fallback to `data.dmSonyaProductCost` for backward compatibility.
  - `loadAll(member, idSuffix, force)`, `renderTable(rows, memberLabel, idSuffix)`, `renderCards(rows, idSuffix)` — all now take a `member`/`idSuffix` pair so the same code drives both Sonya's (`idSuffix=''`) and Sajeepan's (`idSuffix='-sajeepan'`) DOM trees without either fighting over element IDs.
- `selectMember()` rewritten to use a `BUILT_MEMBERS` lookup (`{ sonya: {...}, sajeepan: {...} }`) instead of a single `if (key === 'sonya')` branch — any member in that map shows their real panel + filters bar; everyone else still falls through to `#panel-placeholder`.
- `MONTHS_2025` (Jan–Dec 2025) and `MONTHS_2026` (Jan–Aug 2026, `LIVE_2026=['2026-08']`) reused unchanged — same ranges Sonya's panel already used.
- Two `loadAll()` calls fire on page load: `loadAll('sonya', '', false)` and `loadAll('sajeepan', '-sajeepan', false)`; two independent refresh buttons force-refresh only their own member's data.

## 5. Sajeepan cost snapshots generated (2025-01 through 2026-07)

Generated directly via `ledsone-db-mcp` SQL (not round-tripped through the live endpoint), three queries:
1. Own campaign cost by month: `SUM(cp.cost) FROM google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='SAJEEPAN' AND account_id=4503486236 GROUP BY month`.
2. DM 46 product-share cost by month: `SUM(pp.cost) FROM google_ads.product_performance WHERE campaign_id='20810136438' AND split_part(product_item_id,'_',3) = ANY(<~800 Sajeepan product IDs>) GROUP BY month`.
3. DM 46 full campaign cost by month (context-only field): `SUM(cp.cost) FROM google_ads.campaign_performance WHERE campaign_id='20810136438' GROUP BY month`.

Wrote 19 files: `api/data/muguntha-sajeepan-2025-{01..12}.json` and `api/data/muguntha-sajeepan-2026-{01..07}.json`, same JSON shape as `muguntha-sonya-*.json` (confirmed by reading `muguntha-sonya-2025-01.json` first). 2026-08 intentionally NOT snapshotted — it's the current live month (`CURRENT_LIVE_MONTHS`/`LIVE_2026`), always queried live.

Sample (2025-01): `cost: 2003.35` (own), `dmProductCost: 558.56`, `dmTotalCost: 6075.78`, `totalCost: 2561.91`.

## Files touched
- `reports/digital-marketing-member-pages/api/muguntha.js` (generalized to multi-employee)
- `reports/digital-marketing-member-pages/api/salesuk.js` (exported `SAJEEPAN_PRODUCT_IDS_UK`)
- `reports/digital-marketing-member-pages/pages/muguntha.html` (Sajeepan panel + parameterized JS)
- `reports/digital-marketing-member-pages/api/data/muguntha-sajeepan-2025-{01..12}.json` (new, 12 files)
- `reports/digital-marketing-member-pages/api/data/muguntha-sajeepan-2026-{01..07}.json` (new, 7 files)

**Status:** PASS — see `validation/muguntha/2026-08-04_sajeepan-performance-panel.md` for verification detail.
**Reviewer:** Muguntha (pending review)
**Next step:** Build remaining 10 members (Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha, Theekshy, Jackson, Hetheesha, Thivajini) using this same generalized `EMPLOYEES` map / parameterized-JS pattern.
