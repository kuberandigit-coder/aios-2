# Capabilities — 2026-08-04

## Capability — Shopify-Product-ID-From-Campaign-Item-ID Cost Attribution

**Date:** 2026-08-04
**Owner:** Kuberan (Muguntha's dashboard)
**Project:** digital-marketing-member-pages (`api/muguntha.js`)
**Status:** Implemented, verified via direct SQL before coding

### Capability

Attribute Google Ads campaign spend down to the individual Shopify product level by parsing the
Shopify product ID out of Google's own `product_item_id` format, for campaigns where Google stores
cost against `shopify_gb_{productId}_{variantId}`-style identifiers rather than a clean product
reference.

### Technical implementation

- `queryDmCostsForMonth()` sums `google_ads.product_performance.cost` for a given campaign,
  filtered to rows whose `split_part(product_item_id, '_', 3)` (the embedded Shopify product ID)
  is in a specific owned-product Set.
- Reused an existing exported constant (`SONYA_PRODUCT_IDS_UK`, a ~370-entry Set already used for
  Sales attribution) rather than duplicating the product list — exported from `api/salesuk.js` via
  `module.exports.SONYA_PRODUCT_IDS_UK = SONYA_PRODUCT_IDS_UK` appended after the handler export.
- Returns both the filtered product-level cost AND the campaign's unfiltered total cost
  (`dmTotalCost`) side by side, for transparency.

### Important business rule (verified before implementing, not assumed)

**Product-level PMax cost does not sum to the full campaign cost.** Verified via direct SQL
before writing any code: Google does not attribute 100% of Performance Max spend to specific
products. This is documented as expected behaviour (labelled via the `dmTotalCost` field), not
treated as a bug to "fix" by forcing the numbers to reconcile.

### Originating task

`evidence/muguntha/2026-08-04_full-session-summary.md`

### Reuse

The pattern (export a staff member's product-ID Set for reuse rather than duplicating it; parse a
Shopify product ID out of a composite Google identifier; always show both the filtered and
unfiltered total for transparency) is reusable for any future cross-campaign,
product-level cost attribution need.

### Limitations

Written up from a session-summary evidence file, not a dedicated task evidence/validation pair —
the exact SQL query used for the pre-implementation verification was not independently re-run as
part of this capability-ization.
