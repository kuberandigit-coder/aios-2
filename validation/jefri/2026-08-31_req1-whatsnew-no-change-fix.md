# Validation — Sync Monitor "What's New" always showing "No change"

**Date:** 2026-08-31

| Check | Expected | Actual | Result |
|---|---|---|---|
| Root cause found | orders_count/net_sales never written for ScheduledSnapshot syncs | confirmed via code read + DB query (both NULL on all prior runs) | CONFIRMED |
| `metrics_fn` added to ScheduledSnapshot | optional, safe if it throws | implemented, wrapped in try/except | PASS |
| Req1 metrics wired | product count + conv. value | `(totalProducts, totalConvValue)` | PASS |
| Req6 metrics wired | tracked listings + sales sum | `(len(rows), sum(totalSalesSinceUpdate))` | PASS |
| Req8 metrics wired | real orders_count/net_sales | `(count, sum of non-cancelled order value)` | PASS |
| Diff labels updated | not literally "orders" for Req1/Req6 | "product"/"conv. value", "tracked listing"/"sales" | PASS |
| Manual sync after fix | orders_count/net_sales populated | id 521: 2508 / 29977.68 | PASS |
| whatsNew computed correctly | real delta text | `"+2508 products, +€29977.68 conv. value"` | PASS |
| Backend syntax | valid | `ast.parse` clean on all 3 files | PASS |

## Status
PASS.

## Reviewer
Pending user confirmation in the Sync Monitor UI.
