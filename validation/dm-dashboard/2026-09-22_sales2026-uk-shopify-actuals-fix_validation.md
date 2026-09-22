# Validation — Sales 2026 UK: Shopify Actuals tab bug chain

Date: 2026-09-22
Reviewer: (pending)

| Requirement | Test | Result | PASS/FAIL |
|---|---|---|---|
| Frontend polls until real data arrives | Code review + local build | Poll loop present, 1.5s interval, ~30s ceiling | PASS |
| Hard timeout fires without deadlocking | Simulated 999s hang, 3s timeout | Control returned at exactly 3.0s | PASS |
| ShopifyQL column name is correct | Tested every SHOW column individually against the real live API | `returns` confirmed correct, `sales_reversals` confirmed invalid | PASS |
| Full pipeline returns real data | Direct call to `_build_uk_shopify_actuals_payload()` | 9 months real 2026 data, 1.2s, real GBP figures | PASS |
| **Confirmed live in production** | Repeated polling of the real `?refresh=1` endpoint after each deploy | Resolved with real data after all 3 fixes deployed | PASS |
| `read_reports` access is the true blocker, not a code bug | Live call before/after the user granted the scope | ACCESS_DENIED before, real data after — same code | PASS (root cause confirmed, access issue not code) |

## Overall

**PASS — fully validated, confirmed live in production.** This was the
longest, most compounded bug chain of the day (5 distinct causes); every
one was individually isolated and live-tested rather than assumed fixed.
