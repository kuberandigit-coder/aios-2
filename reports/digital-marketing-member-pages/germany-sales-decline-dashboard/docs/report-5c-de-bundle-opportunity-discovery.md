# Discovery Report — Germany Bundle Opportunities from UK Bundle SKUs

**Date:** 2026-08-06
**Analyst:** Senior PostgreSQL Data Analyst (read-only)
**Task type:** Discovery only — no dashboard, API, or migration created
**Status:** PASS

---

## Purpose

Determine whether Germany has bundle opportunities based on existing UK bundle SKUs. Identify which UK bundle SKUs do not currently exist in Germany but may be buildable using Germany's existing stock SKUs.

---

## 1. Source Tables Inspected

| Table | Purpose |
|---|---|
| `listings.ebay_listings` | UK & DE eBay active listings (`all_list=1`, `site='UK'/'Germany'`) |
| `listings.amazon_listings` | UK & DE Amazon listings (`site='UK'/'Germany'`) |
| `listings.shopify_listings` | UK & DE Shopify active listings (`all_list=1`, `site='UK'/'Germany'`) |
| `inventory.products` | SKU master |
| `inventory.local_inventory_current_stock_location_wise` | Germany warehouse stock (`warehouse_location='Germany'`, `stock>0`) |

**Existing APIs inspected:** `api/germany/marketplace-gap.js` — uses the same tables; confirmed bundle SKU handling via CTE prefix-expansion. No existing bundle opportunity API exists.

**Existing dashboards inspected:** `report-5b-marketplace-gap.html` — covers individual SKU channel coverage only, not bundle-level opportunity analysis.

---

## 2. How UK Bundle SKUs Are Stored

A bundle SKU is any SKU containing `+`, e.g. `CRSF100BM+PHSH1PBRYB+LSSS300BM`.

Stored directly in the `sku` column across all three listing tables. Some have a `-IDE` suffix variant (e.g. `CRSF100BM+PHSH1PBRYB-IDE`) — suffix stripped before analysis. Components extracted by splitting on `+`.

---

## 3. UK Bundle SKU Counts by Source

| Source Table | Distinct Bundle SKUs (UK, active) |
|---|---|
| `ebay_listings` | 12,287 |
| `amazon_listings` | 13,952 |
| `shopify_listings` | 8,628 |
| **Total distinct (union across all 3 channels)** | **23,247** |

---

## 4. Germany Context

| Metric | Count |
|---|---|
| DE in-stock SKUs (Germany warehouse, stock > 0) | 14,481 |
| Distinct DE bundle SKUs (all 3 channels, active) | 13,674 |

---

## 5. Bundle Gap Analysis — Summary

| Metric | Count |
|---|---|
| Total distinct UK bundle SKUs | **23,247** |
| Already exist in Germany (listed on any DE channel) | **10,059** (43%) |
| **Not in Germany** | **13,188** (57%) |
| Not in Germany — **all components available in DE stock** | **467** |
| Not in Germany — missing ≥1 component from DE stock | 12,721 |

---

## 6. SQL Used for Analysis

```sql
WITH uk_bundles AS (
  SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS bundle_sku
  FROM listings.ebay_listings WHERE site='UK' AND sku LIKE '%+%' AND all_list=1
  UNION
  SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
  FROM listings.amazon_listings WHERE site='UK' AND sku LIKE '%+%'
  UNION
  SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
  FROM listings.shopify_listings WHERE site='UK' AND sku LIKE '%+%' AND all_list=1
),
de_bundles AS (
  -- same pattern with site='Germany'
),
de_stock AS (
  SELECT p.sku, SUM(licsl.stock)::int AS de_qty
  FROM inventory.products p
  JOIN inventory.local_inventory_current_stock_location_wise licsl ON licsl.inventory_id = p.id
  WHERE licsl.warehouse_location = 'Germany' AND licsl.stock > 0
  GROUP BY p.sku
),
uk_components AS (
  SELECT ub.bundle_sku, unnest(string_to_array(ub.bundle_sku, '+')) AS component_sku
  FROM uk_bundles ub
),
bundle_check AS (
  SELECT
    uc.bundle_sku,
    COUNT(uc.component_sku)              AS total_components,
    COUNT(ds.sku)                        AS found_in_de,
    bool_and(ds.sku IS NOT NULL)         AS all_in_de,
    string_agg(uc.component_sku || ' (' || COALESCE(ds.de_qty::text,'MISSING') || ')', ' | ') AS component_detail
  FROM uk_components uc
  LEFT JOIN de_stock ds ON ds.sku = uc.component_sku
  GROUP BY uc.bundle_sku
)
SELECT
  COUNT(*)                                                            AS total_uk_bundles,
  COUNT(*) FILTER (WHERE db.bundle_sku IS NOT NULL)                  AS already_in_de,
  COUNT(*) FILTER (WHERE db.bundle_sku IS NULL)                      AS not_in_de,
  COUNT(*) FILTER (WHERE db.bundle_sku IS NULL AND bcc.all_in_de)    AS not_in_de_all_components_available,
  COUNT(*) FILTER (WHERE db.bundle_sku IS NULL AND NOT bcc.all_in_de) AS not_in_de_missing_some_components
FROM bundle_check bcc
LEFT JOIN de_bundles db ON db.bundle_sku = bcc.bundle_sku;
```

---

## 7. Sample Output — 20 Bundles Not in DE, All Components Available in DE Stock

| UK Bundle SKU | # Parts | Components (DE stock qty) | DE Bundle Exists | Missing Components |
|---|---|---|---|---|
| `CRFF140BM+LHNSE27YB+SCRN70BM+LSDO210BM+LHNSE27YB+SCRN70BM+LSDO210BC` | 7 | CRFF140BM(326) \| LHNSE27YB(537) \| LSDO210BC(241) \| LSDO210BM(254) \| SCRN70BM(2855) | No | None |
| `CRFF140BM+LHNSE27YB+SCRN70BM+LSDO210BM+LHNSE27YB+SCRN70BM+LSDO210RR` | 7 | CRFF140BM(326) \| LHNSE27YB(537) \| LSDO210BM(254) \| LSDO210RR(95) \| SCRN70BM(2855) | No | None |
| `CRSF100BM+PHSH2PBRYB+SPWRBM+SPUWBM+SCRN70BM+LSDO300BI` | 6 | CRSF100BM(3965) \| LSDO300BI(35) \| PHSH2PBRYB(51) \| SCRN70BM(2855) \| SPUWBM(934) \| SPWRBM(936) | No | None |
| `CRFF140GL+LHNSE27YB+SCRN70BM+LSUL220BB+LDMST64E274` | 5 | CRFF140GL(1070) \| LDMST64E274(3408) \| LHNSE27YB(537) \| LSUL220BB(60) \| SCRN70BM(2855) | No | None |
| `CRFF140GL+LHNSE27YB+SCRN70BM+LSUL220BC+LDMST64E274` | 5 | CRFF140GL(1070) \| LDMST64E274(3408) \| LHNSE27YB(537) \| LSUL220BC(112) \| SCRN70BM(2855) | No | None |
| `CRFF140GL+LHNSE27YB+SCRN70BM+LSUL220BM+LDMST64E274` | 5 | CRFF140GL(1070) \| LDMST64E274(3408) \| LHNSE27YB(537) \| LSUL220BM(112) \| SCRN70BM(2855) | No | None |
| `CRFF140GL+LHNSE27YB+SCRN70BM+LSUL220BS+LDMST64E274` | 5 | CRFF140GL(1070) \| LDMST64E274(3408) \| LHNSE27YB(537) \| LSUL220BS(220) \| SCRN70BM(2855) | No | None |
| `CRFF140GL+LHNSE27YB+SCRN70BM+LSUL220RR+LDMST64E274` | 5 | CRFF140GL(1070) \| LDMST64E274(3408) \| LHNSE27YB(537) \| LSUL220RR(133) \| SCRN70BM(2855) | No | None |
| `CRSF100BM+PHSH1PBRYB+SCRN70BM+LSFT220GS+LDMST64E274` | 5 | CRSF100BM(3965) \| LDMST64E274(3408) \| LSFT220GS(154) \| PHSH1PBRYB(96) \| SCRN70BM(2855) | No | None |
| `CRFF100BM+LHNSE27YB+SCRN70BM+LSTF40BM` | 4 | CRFF100BM(296) \| LHNSE27YB(537) \| LSTF40BM(127) \| SCRN70BM(2855) | No | None |
| `CRFF100BM+WSLS155BM+SCRN70BM+LSTF40BM` | 4 | CRFF100BM(296) \| LSTF40BM(127) \| SCRN70BM(2855) \| WSLS155BM(166) | No | None |
| `CRFF100BM+WSLS155YB+SCRN70BM+LSFT220BL` | 4 | CRFF100BM(296) \| LSFT220BL(14) \| SCRN70BM(2855) \| WSLS155YB(235) | No | None |
| `CRFF100BM+WSLS155YB+SCRN70BM+LSFT220GR` | 4 | CRFF100BM(296) \| LSFT220GR(148) \| SCRN70BM(2855) \| WSLS155YB(235) | No | None |
| `CRFF100BM+WSLS155YB+SCRN70BM+LSFT220GY` | 4 | CRFF100BM(296) \| LSFT220GY(61) \| SCRN70BM(2855) \| WSLS155YB(235) | No | None |
| `CRFF100BM+WSLS155YB+SCRN70BM+LSFT220RE` | 4 | CRFF100BM(296) \| LSFT220RE(38) \| SCRN70BM(2855) \| WSLS155YB(235) | No | None |
| `CRFF100BM+WSLS155YB+SCRN70BM+LSFT220YE` | 4 | CRFF100BM(296) \| LSFT220YE(8) \| SCRN70BM(2855) \| WSLS155YB(235) | No | None |
| `CRFF100FG+WSNW170FG+SCRN70FG+LSFT220FG` | 4 | CRFF100FG(100) \| LSFT220FG(39) \| SCRN70FG(19) \| WSNW170FG(1) | No | None |
| `CRFF140BM+LHLFE275BM+LSTF40BG+LDMG95E274` | 4 | CRFF140BM(326) \| LDMG95E274(916) \| LHLFE275BM(3) \| LSTF40BG(121) | No | None |
| `CRSF100BM+LHLFE27BM+SCRN70YB+LSCY290BL` | 4 | CRSF100BM(3965) \| LHLFE27BM(55) \| LSCY290BL(219) \| SCRN70YB(469) | No | None |
| `CRSF100BM+LHLFE27BM+SCRN70YB+LSCY290BS` | 4 | CRSF100BM(3965) \| LHLFE27BM(55) \| LSCY290BS(181) \| SCRN70YB(469) | No | None |

---

## 8. Key Observations

- **`SCRN70BM`** (2,855 DE stock) and **`CRSF100BM`** (3,965 DE stock) appear repeatedly as anchor components across many potential bundles — high-stock items that enable a large number of bundle combinations
- **`LDMST64E274`** (3,408 stock) is a common component in 5-part bundle candidates
- The 467 fully-buildable bundles range from 2 to 7 components
- The 12,721 bundles with missing components represent gaps where DE stock for individual SKUs must first be established before those bundles are possible
- 43% of UK bundles (10,059) already exist in Germany — strong baseline but 57% gap remains

---

## 9. Pass Criteria

| Criteria | Result |
|---|---|
| Total UK bundle SKUs identified | ✅ 23,247 |
| Which already exist in Germany | ✅ 10,059 (43%) |
| Which do not exist in Germany | ✅ 13,188 (57%) |
| Which have all components available in DE stock | ✅ 467 |
| Which are missing ≥1 component | ✅ 12,721 |
| Source tables inspected | ✅ 5 tables |
| Existing APIs inspected | ✅ marketplace-gap.js |
| Existing dashboards inspected | ✅ report-5b-marketplace-gap.html |
| Sample output (20 rows) provided | ✅ |
| No files modified / no dashboard / no API / no migration | ✅ Read-only |

**Overall: PASS**

---

## 10. Next Steps (not in scope of this task)

- Build a DE bundle opportunity dashboard showing the 467 fully-buildable bundles
- Prioritise by component stock depth (min stock across all components = buildable quantity)
- Cross-reference with UK sales velocity to rank highest-opportunity bundles first
