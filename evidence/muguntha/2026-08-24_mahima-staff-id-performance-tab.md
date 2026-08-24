## Purpose
Add a Mahima tab to `pages/staff-id-performance.html` (Kamsi/Dilaksi/Sajeepan/Jackson/Sonya's ID-level lifetime sales/stock tool), even though the page is titled "ledsone.co.uk Ads Team" and its existing staff are all UK-store.

## Business Question
Kuberan: "dont take care about the titke add mahima tab and her id performance i need show" — an explicit override after I flagged the title/store mismatch.

## Investigation
Checked whether Mahima's DE (ledsone.de) product IDs would actually work against this UK-titled page's underlying queries, via direct read-only DB queries before writing any code:
- **Sales** (`order_management.order_item_info`, `listings.shopify_listings`): her DE product IDs matched fine — this is a shared multi-store data warehouse, not UK-only despite the page title.
- **Stock** (`inventory.products` joined by SKU, filtered to `warehouse_location = 'UK'`): broke for her. DE listings' SKUs carry a store suffix (e.g. `CL2TGD-IDE`) that the base `inventory.products.sku` doesn't have (`CL2TGD`), so the join silently matched nothing; her real stock also lives under `warehouse_location = 'Germany'`, not `'UK'`.
- Verified the fix directly against the DB before touching code: stripping the suffix (`regexp_replace(..., '-[A-Za-z]+$', '')`) and switching to `'Germany'` returned real stock numbers (e.g. 16,809 units for one product).

## Fix
- `data/staff-ids.js`: added `mahima: [...]` (same 678-ID list as `MAHIMA_EXCLUDED_PRODUCT_IDS`).
- `api/staff-id-performance.js`: added a `isDeStaff = ids_param === 'mahima'` branch that swaps the stock query's SKU-join expression and warehouse filter for her specifically — every other staff key's query is byte-identical to before.
- `pages/staff-id-performance.html`: added the Mahima tab button.

## Files Modified
- `data/staff-ids.js`, `api/staff-id-performance.js`, `pages/staff-id-performance.html`

## Status
PASS — stock join fix verified directly against the database before deploy; live page confirmed to have the new tab.

## Reviewer
Kuberan
