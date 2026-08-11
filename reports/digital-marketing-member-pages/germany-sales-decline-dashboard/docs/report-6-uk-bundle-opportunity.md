# Report 6 — UK Bundle Opportunity: Germany Coverage Gap

**File:** `pages/report-6-uk-bundle-opportunity.html`
**API:** `api/germany/uk-bundle-opportunity.js`
**Hub label:** Report 6
**Created:** 2026-08-06
**Discovery reference:** `docs/report-5c-de-bundle-opportunity-discovery.md`

---

## Purpose

Identify UK bundle SKUs that do not currently exist in Germany but could be listed using Germany's existing in-stock component SKUs. This is a gap analysis — it does NOT recommend creating bundles or calculate build quantities.

---

## Business Question

Which UK bundle SKUs do not currently exist in Germany, and which of those have all component SKUs already in German stock?

---

## Source Tables

| Schema | Table | Filter | Purpose |
|---|---|---|---|
| `listings` | `ebay_listings` | `site='UK'`, `all_list=1`, `sku LIKE '%+%'` | UK eBay bundle SKUs |
| `listings` | `amazon_listings` | `site='UK'`, `sku LIKE '%+%'` | UK Amazon bundle SKUs |
| `listings` | `shopify_listings` | `site='UK'`, `all_list=1`, `sku LIKE '%+%'` | UK Shopify bundle SKUs |
| `listings` | `ebay_listings` | `site='Germany'`, `all_list=1`, `sku LIKE '%+%'` | DE existing bundles |
| `listings` | `amazon_listings` | `site='Germany'`, `sku LIKE '%+%'` | DE existing bundles |
| `listings` | `shopify_listings` | `site='Germany'`, `all_list=1`, `sku LIKE '%+%'` | DE existing bundles |
| `inventory` | `products` | — | SKU master |
| `inventory` | `local_inventory_current_stock_location_wise` | `warehouse_location='Germany'`, `stock>0` | Germany stock check |

---

## API Used

**New API created:** `api/germany/uk-bundle-opportunity.js`

**Reason for new API (not reusing marketplace-gap.js):**
- `marketplace-gap.js` maps DE in-stock SKUs against DE listing coverage (DE→DE direction)
- This report maps UK bundle SKUs against DE component stock (UK→DE direction)
- Different source tables, different JOIN direction, different output shape
- Reusing/extending marketplace-gap would break its single responsibility and backward compatibility

---

## SQL Logic

### Step 1 — All distinct UK bundle SKUs (union across 3 channels)
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
)
```

### Step 2 — All existing DE bundle SKUs
Same pattern with `site='Germany'`.

### Step 3 — Germany in-stock SKUs
```sql
de_stock AS (
  SELECT p.sku, SUM(licsl.stock)::int AS de_qty
  FROM inventory.products p
  JOIN inventory.local_inventory_current_stock_location_wise licsl ON licsl.inventory_id = p.id
  WHERE licsl.warehouse_location = 'Germany' AND licsl.stock > 0
  GROUP BY p.sku
)
```

### Step 4 — Explode bundles into components
```sql
uk_components AS (
  SELECT ub.bundle_sku, unnest(string_to_array(ub.bundle_sku, '+')) AS component_sku
  FROM uk_bundles ub
)
```

### Step 5 — Component availability check
```sql
bundle_check AS (
  SELECT
    uc.bundle_sku,
    COUNT(uc.component_sku)::int    AS tc,   -- total components
    COUNT(ds.sku)::int              AS fc,   -- found in DE stock
    (COUNT(uc.component_sku) - COUNT(ds.sku))::int AS mc, -- missing count
    bool_and(ds.sku IS NOT NULL)    AS ready, -- all components in DE
    array_agg(DISTINCT uc.component_sku ORDER BY uc.component_sku) AS components,
    array_remove(array_agg(CASE WHEN ds.sku IS NOT NULL THEN uc.component_sku END), NULL) AS found,
    array_remove(array_agg(CASE WHEN ds.sku IS NULL THEN uc.component_sku END), NULL)     AS missing
  FROM uk_components uc
  LEFT JOIN de_stock ds ON ds.sku = uc.component_sku
  GROUP BY uc.bundle_sku
)
```

### Step 6 — Final select with DE existence check
```sql
SELECT bc.*, CASE WHEN db.bundle_sku IS NOT NULL THEN 1 ELSE 0 END AS de_exists
FROM bundle_check bc
LEFT JOIN de_bundles db ON db.bundle_sku = bc.bundle_sku
ORDER BY bc.ready DESC, bc.tc DESC, bc.bundle_sku
```

**API filters to not-in-DE rows only** before sending to client (reduces payload).

---

## Report Flow

1. Page loads → calls `api/germany/uk-bundle-opportunity`
2. API returns `summary` + `rows` (only not-in-DE bundles)
3. KPI cards and header stats update
4. Table renders with filter pills: All / Ready for Review / Missing Components
5. Auto-poll every 5 seconds refreshes data silently

---

## KPI Cards

| Card | Value |
|---|---|
| Total UK Bundle SKUs | All distinct UK bundles across eBay+Amazon+Shopify |
| Already Exists in Germany | UK bundles that also exist on any DE channel |
| Not in Germany | UK bundles with no DE listing |
| Ready for Review | Not-in-DE bundles where all components are in DE stock |
| Missing Components | Not-in-DE bundles where ≥1 component not in DE stock |

---

## Filters

| Pill | Logic |
|---|---|
| All Not in Germany | All rows (de_exists=0) |
| ✓ Ready for Review | `ready=true` |
| Missing Components | `ready=false` |
| Search SKU | Client-side bundle SKU substring match |

---

## Table Columns

| Column | Source |
|---|---|
| UK Bundle SKU | `b` |
| # Parts | `tc` (total components) |
| Component List | `components` array — green chip = found in DE, red chip = missing |
| DE Bundle | Always `✗ No` (table only shows not-in-DE rows) |
| Found | `fc / tc` |
| Missing | `mc` |
| Opportunity Status | `✓ Ready for Review` or `Missing N component(s)` |

---

## Validation

Validated against discovery report (`report-5c-de-bundle-opportunity-discovery.md`):
- Total UK bundles: 23,247 ✓
- Already in DE: 10,059 ✓
- Not in DE: 13,188 ✓
- Ready for Review: 467 ✓

---

## Known Limitations

- Bundle SKU match is exact string after `-IDE` strip — no left-prefix expansion (bundles are matched as complete units, not sub-parts)
- Component availability ≠ build quantity — does not calculate how many can be built
- Does not factor in restock orders or incoming stock
- `amazon_listings` has no `all_list` column — uses `site='UK'/'Germany'` only
- Per-browser localStorage not used in this report — all data is live DB
