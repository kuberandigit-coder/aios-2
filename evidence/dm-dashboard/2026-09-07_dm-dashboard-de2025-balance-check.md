# Evidence — DE 2025 Jul-Dec balance-check against real Shopify totals

**Date:** 2026-09-07
**Project:** dm-dashboard

## Method
Pulled real order data live from Shopify (DE store) for each month
Jul–Dec 2025, summed real order totals (`currentTotalPriceSet`), then
summed what the extended attribution rules assign across every bucket
(Mahima organic + ads, Sukirtha organic + email, Jeffri ads, Not
Assigned) for that same month. Unaccounted = real total minus assigned
total.

## Results

| Month | Real Shopify Total | Unaccounted | % |
|---|---|---|---|
| 2025-07 | €13,525.51 | €346.94 | 2.57% |
| 2025-08 | €15,004.48 | €499.68 | 3.33% |
| 2025-09 | €14,757.34 | €1,059.15 | 7.18% |
| 2025-10 | €20,015.22 | €186.33 | 0.93% |
| 2025-11 | €25,092.98 | €251.69 | 1.00% |
| 2025-12 | €20,281.13 | €276.29 | 1.36% |

Unaccounted orders were spot-checked: mostly `medium=subscribe_email`
and blank-UTM orders with no journey data — same order of magnitude as
the existing (already-trusted) Jan–Jun months, not a new/systemic gap.

**Decision:** approved as good enough by user; rules extended and
pushed live.
