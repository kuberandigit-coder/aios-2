# Validation — Dilaksi Req 2: Collection + Without-Sales Filters, Detailed Badges

**Date:** 2026-07-02 · **Reviewer:** Kuberan · **Status:** PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| Collection filter buttons | All + 5 collections | 6 buttons (`data-coll`) in live HTML | PASS |
| Without-sales filter | 3rd sales state | `data-sales="unsold"` button live, filters `data-sold="0"` rows | PASS |
| Filters combine | collection × sales × search | single `apply()` ANDs all three conditions | PASS |
| Every row filterable by collection | 1,231 rows tagged | 1,231 `data-coll` attributes on product rows | PASS |
| Demand shown in detail | value + keyword + plain-language tooltip | `Demand: N searches/mo "keyword"` on all 1,231 rows | PASS |
| Organic shown in detail | value + plain-language wording + tooltip | `Organic: N visits (30d)` on all 1,231 rows | PASS |
| Legend explains everything | plain-language legend | "How to read each product row" box with colour samples + sources | PASS |
| Collection organic totals | per-collection sum in header | "organic N visits (30d)" in each h2 | PASS |
| Data unchanged | presentation-only change | same GA4/Semrush/Shopify datasets as prior evidence | PASS |
| Deployed & live | HTTP 200 | 200, all elements verified | PASS |

**PASS/FAIL: PASS**
