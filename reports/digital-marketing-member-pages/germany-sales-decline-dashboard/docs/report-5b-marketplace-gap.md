# Report 5 — Marketplace Gap: DE In-Stock SKUs

**File:** `pages/report-5b-marketplace-gap.html`
**API:** `api/germany/marketplace-gap.js`
**Hub label:** Report 5
**Last rebuilt:** 2026-08-06 (v5 — eBay Accounts tab + per-account tracking)

---

## Purpose

Shows all DE in-stock SKUs and whether each has an active listing on Amazon DE, eBay DE, and Shopify DE. Used to identify stocked products missing from one or more sales channels — a direct cause of lost Germany revenue.

---

## Key Numbers (live — refreshed every 5 seconds)

| Metric | Source |
|---|---|
| Total DE In-Stock SKUs | `summary.total` |
| Not Listed Anywhere | `summary.notAnywhere` |
| Missing Amazon DE | `summary.missingAmazon` |
| Missing eBay DE | `summary.missingEbay` |
| Missing Shopify DE | `summary.missingShopify` |
| Listed on All 3 Channels | `summary.allThree` |

Numbers shown are always raw DB counts — no localStorage adjustment.

---

## API (`api/germany/marketplace-gap.js`)

### Query Logic

**Step 1 — DE in-stock SKUs**
```sql
SELECT p.sku, SUM(licsl.stock)::int AS st
FROM inventory.products p
JOIN inventory.local_inventory_current_stock_location_wise licsl ON licsl.inventory_id = p.id
WHERE licsl.warehouse_location = 'Germany' AND licsl.stock > 0
GROUP BY p.sku
```

**Step 2 — Bundle SKU matching (CTE prefix-expansion)**

Each channel (Amazon, eBay, Shopify) uses two complementary approaches in a UNION CTE:

```sql
-- Approach 1: unnest — covers single SKUs that appear anywhere inside a bundle
SELECT DISTINCT unnest(string_to_array(base, '+')) AS covered_sku FROM raw_amz
UNION
-- Approach 2: left-prefix expansion — covers bundle stock SKUs as left prefix of a listing
SELECT DISTINCT array_to_string(parts[1:n], '+') AS covered_sku
FROM (SELECT base, string_to_array(base,'+') AS parts,
      generate_series(1,array_length(string_to_array(base,'+'),1)) AS n
      FROM raw_amz) x
```

`-IDE` suffix stripping applied before expansion:
```sql
CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS base
```

This covers:
- Single SKU listed as a standalone: exact match
- Single SKU that appears inside a bundle (e.g. `CRSF100BM+LHNSE27BM`): unnest catches `LHNSE27BM`
- Bundle stock SKU as left prefix of a longer listing: prefix expansion catches `A+B` from `A+B+C`

**Step 3 — Per-account eBay CTEs**

Six additional CTEs, one per eBay DE sub_source, using the same prefix-expansion logic:

| sub_source | Account name |
|---|---|
| 1 | led_sone |
| 4 | sunsone |
| 22 | electricalsone |
| 27 | ledsonede |
| 28 | huettenlampen |
| 222 | homin_gmbh |

Returns columns: `e1`, `e4`, `e22`, `e27`, `e28`, `e222` (1 = listed, 0 = not).

**Step 4 — Final SELECT**

```sql
SELECT s.sku AS s, s.st,
  MAX(CASE WHEN ac.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS a,
  MAX(CASE WHEN ec.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e,
  MAX(CASE WHEN sc.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS sh,
  MAX(CASE WHEN e1.covered_sku  IS NOT NULL THEN 1 ELSE 0 END)::int AS e1,
  MAX(CASE WHEN e4.covered_sku  IS NOT NULL THEN 1 ELSE 0 END)::int AS e4,
  MAX(CASE WHEN e22.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e22,
  MAX(CASE WHEN e27.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e27,
  MAX(CASE WHEN e28.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e28,
  MAX(CASE WHEN e222.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e222
FROM stock s
LEFT JOIN amz_coverage ac ...
LEFT JOIN ebay_coverage ec ...
LEFT JOIN shop_coverage sc ...
LEFT JOIN ecov_1 e1 ... (×6 accounts)
GROUP BY s.sku, s.st ORDER BY s.st DESC
```

**Response shape:**
```json
{
  "ok": true,
  "refreshed_at": "2026-08-06T10:00:00.000Z",
  "summary": { "total": 14481, "notAnywhere": 5447, "missingAmazon": 12204, "missingEbay": 7108, "missingShopify": 8886, "allThree": 1497 },
  "ebayAccounts": [
    { "id": 1, "name": "led_sone", "listed": 8200, "missing": 6281 },
    ...
  ],
  "rows": [
    { "s": "EXAMPLE-SKU", "st": 500, "a": 1, "e": 0, "sh": 0, "e1": 0, "e4": 0, "e22": 0, "e27": 0, "e28": 0, "e222": 0 }
  ]
}
```

**Debug mode:** `?debug=SKU` returns a single row for that SKU.

---

## Tabs

### Tab 1 — Gap Report

Main table: all DE in-stock SKUs with Amazon / eBay / Shopify listed status.

**Filter pills:**

| Pill | Logic |
|---|---|
| All | All DE in-stock SKUs |
| Not Listed Anywhere | `a=0 AND e=0 AND sh=0` |
| Missing Amazon | `a=0` |
| Missing eBay | `e=0` |
| Missing Shopify | `sh=0` |
| Listed All 3 | `a=1 AND e=1 AND sh=1` |

Features: SKU search, pagination (100/page), CSV export.

---

### Tab 2 — Listing Added Log

Tracks when a missing SKU gets listed on a channel. Entries are auto-created by `detectTransitions()` on each 5-second poll when a 0→1 flip is detected.

**localStorage keys:**
- `de_marketplace_added_log_v1` — log entries `[{sku, channel, addedAt, auto}]`
- `de_marketplace_prev_state_v1` — previous state snapshot `{sku: {a, e, sh}}`

**Status values:**
- **Pending** — transition detected but unconfirmed
- **Confirmed Live** — current DB data shows `1` for that channel

Filters: by channel (Amazon DE / eBay DE / Shopify DE), by status (Pending / Confirmed). CSV export available.

---

### Tab 3 — eBay Accounts

Per-account coverage breakdown across all 6 eBay DE accounts.

**Account summary cards (top):**
One card per account showing: Listed count, Missing count, coverage % bar.

**SKU table (bottom):**

Columns: `SKU | DE Stock | eBay Overall | led_sone | sunsone | electricalsone | ledsonede | huettenlampen | homin_gmbh`

Each account cell shows:
- `✓ Listed` — SKU is covered by that account
- `✓ Listed` + `added DD Mon HH:MM` — listed AND a 0→1 transition was auto-detected (shows date/time it was first seen)
- `✗ No` — not listed on that account

**Filter dropdown:**

| Option | Logic |
|---|---|
| Missing eBay (any account) | `e=0` |
| All DE SKUs | no filter |
| Missing: led_sone | `e1=0` |
| Missing: sunsone | `e4=0` |
| Missing: electricalsone | `e22=0` |
| Missing: ledsonede | `e27=0` |
| Missing: huettenlampen | `e28=0` |
| Missing: homin_gmbh | `e222=0` |

SKU search and CSV export available.

**Per-account transition tracking (localStorage):**
- `de_ebay_acc_added_log_v1` — `[{sku, account, addedAt}]`
- `de_ebay_acc_prev_v1` — previous snapshot of `{e1, e4, e22, e27, e28, e222}` per SKU

Auto-refreshes every 5 seconds when tab is active.

---

## Auto-Poll

Interval: **5 seconds** (`setInterval` in JS).

Each poll:
1. Fetches `api/germany/marketplace-gap` with `cache: 'no-store'`
2. Calls `detectTransitions()` — checks channel-level and per-account 0→1 flips
3. Updates `DATA`, `ACC_SUMMARY`, KPI cards, filter pills, table
4. Re-renders Log tab (if open) and eBay Accounts tab (if open)

---

## Tables Used

| Schema | Table | Purpose |
|---|---|---|
| `inventory` | `products` | SKU list |
| `inventory` | `local_inventory_current_stock_location_wise` | Germany stock > 0 |
| `listings` | `amazon_listings` | Amazon DE (`site='Germany'`) |
| `listings` | `ebay_listings` | eBay DE (`site='Germany'`, `all_list=1`) |
| `listings` | `shopify_listings` | Shopify DE (`site='Germany'`, `all_list=1`) |

---

## Key Correctness Rules

1. `warehouse_location = 'Germany'` and `stock > 0` — only genuine DE in-stock SKUs
2. `site = 'Germany'` on all listing tables — DE marketplace only
3. `all_list = 1` on ebay_listings and shopify_listings — active listings only (Amazon has no `all_list` column)
4. LEFT JOIN — preserves SKUs with no listing on a given channel
5. CTE prefix-expansion UNION unnest — correctly handles bundle SKUs in both directions
6. `-IDE` suffix stripped before matching — avoids false negatives on eBay/Shopify IDE variants
7. Raw DB counts only in KPIs — no localStorage adjustment, consistent across all browsers

---

## Known Limitations

- Listing existence ≠ listing is actively selling (beyond `all_list=1`)
- Amazon has no `all_list` filter — uses `site='Germany'` only
- Stock is point-in-time; restock orders not factored in
- Per-account transition dates are browser-local — only visible to the browser that first detected the flip
