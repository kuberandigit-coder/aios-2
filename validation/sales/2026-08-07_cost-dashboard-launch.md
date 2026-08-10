# Validation — New Cost Dashboard Page + Data-Gap Closures (2026-08-07)

| Check | Result |
|---|---|
| `pages/cost.html` renders Sonya/Sajeepan/Kamsi/Dilaksi tabs | PASS |
| N/A categories (Product Cost pre-rule, CSS, Meta Ads Cost, Subscription Fee) show explicit "N/A" not a fabricated number | PASS (Product Cost later became real via 20% rule, others remain N/A) |
| `combinedSummary.vat` present in `/api/salesuk` and `/api/sales25` responses | PASS |
| Transaction Fee sourced from `accounting.shopify_transactions.fee`, matches `shopify_order_id` join, scoped to `sub_source=104` | PASS |
| Product Cost = 20% of Gross Sales, confirmed against sample month | PASS |
| Tab switching reuses cached data (no duplicate fetch) | PASS |
| All 31 backfilled snapshots (Sonya 2025 full, Sajeepan 2025+2026 full) contain vat/transactionFee fields | PASS |
| `sales25.js` DM 46 product-owned-order exclusion now matches `salesuk.js` logic | PASS |
| Deployed and live on production | PASS |

**Status:** PASS
