## Purpose
Validate Mahima's new Performance tab.

## Checks performed
1. DB query confirming her real Google Ads campaign group (16 campaigns, account 9031058245).
2. `node -c api/muguntha.js` and `node -e "new Function(...)"` on all `muguntha.html` script blocks — no errors, both before and after each edit round.
3. Live curl of `/api/muguntha?employee=mahima&month=2025-03` — £1,545.43, matches the direct DB query for the same month exactly.
4. Live curl of `/api/salesde25?staff=mahima-total&month=2025-03` — real data (231 orders, €3,665.02 netSales), correct `staff.department: "Total Sales (All Channels, Unfiltered)"` label confirming the right endpoint.
5. Live grep on deployed page confirms `panel-mahima` and `mahima-total` present.
6. All 38 generated snapshot files validated as parseable JSON with `success: true`.
7. Timed a snapshot-backed request post-deploy: 1.07s.

## Result
PASS.

## Reviewer
Kuberan
