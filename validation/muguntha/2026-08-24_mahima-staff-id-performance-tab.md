## Purpose
Validate the Mahima Staff ID Performance tab.

## Checks performed
1. Direct DB query confirming her DE product IDs exist in `order_management.order_item_info` / `listings.shopify_listings` (sales/titles work as-is).
2. Direct DB query proving the original stock join returns 0 rows for her IDs (root-caused to SKU suffix + wrong warehouse).
3. Direct DB query with the fix applied — real stock numbers returned (898, 16,809, 8,098 units for 3 sample products).
4. `node -c` syntax check on `data/staff-ids.js` and `api/staff-id-performance.js`.
5. Confirmed `mahima` array has exactly 678 unique IDs.
6. Confirmed the UK staff's stock query is unmodified for `ids_param !== 'mahima'` (regression check — same SQL string as before for every other key).
7. Live grep on deployed page confirms `data-staff="mahima"` tab present.

## Result
PASS.

## Reviewer
Kuberan
