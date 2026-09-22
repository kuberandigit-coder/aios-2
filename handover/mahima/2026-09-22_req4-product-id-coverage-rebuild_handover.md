# Handover — Mahima Requirement 4 (Product ID Coverage): full rebuild

Date: 2026-09-22
Owner: Mahima (Google Ads DE)
Reviewer: project owner/team

## What was built/fixed

The Product ID Coverage page was showing ~10x the real product count
(26,831 vs a real catalog of ~2,711-2,771) due to a chain of scoping
bugs, and its Feed Eligibility heuristic was flagging 100% of products
as "Not Eligible" regardless of real Google Merchant Center rules. Both
fully root-caused and fixed — see evidence.md for the full investigation
chain, which included the user personally catching a flaw in an
intermediate ID-matching claim (a good example of why "same aggregate
count" is not the same as "same actual product IDs").

## Files changed

- `backend/app/mahima.py` (`MAHIMA_QUERY_R5` rebuilt on
  `listings.shopify_listings`; new critical/recommended attribute-column
  split; `_mahima5_missing_attribute`, `_req5_payload_compute`,
  `dataNote` all updated accordingly)
- `frontend/src/mahima/pages/ProductIdCoverage.jsx` ("Needs Improvement"
  KPI card + filter option)

## Data source correction (the core fix)

Old: product universe derived from `google_ads.merchant_products`
(various scoping bugs, described in evidence.md).
New: product universe is `listings.shopify_listings` (site='Germany',
is_parent=1) — the real, separately-synced Shopify listings table,
verified to match Shopify's own Admin API `productsCount` within ~2%.
Merchant Center feed data and campaign performance are joined onto this
real product list, not the other way around.

## Testing

Every number in this fix was checked against the real business Postgres
database directly (not assumed from reading code), and the final result
was re-verified against the live production API and the scheduled
snapshot cache after each deploy (this page's data is cached for 10
days; a manual "Run Now" refresh was triggered each time to confirm the
live numbers, not just the underlying query).

## Current status

Fully implemented, live-verified in production. Commits `87be999`,
`4c2e032`, `020c1d0` (all `dev-work` only, per the mid-session standing
instruction to stop pushing to `main` directly).

## Known limitations / real findings surfaced (not this task's bugs, but
now visible because of this fix)

- **84% of the real Shopify DE catalog (2,320 of 2,771 products) has no
  Google Merchant Center feed row at all.** This is a genuine feed-sync
  gap on the Merchant Center side, not a dashboard bug — previously
  invisible because the old query only ever looked at whatever
  `merchant_products` already contained.
- The stale/mislabeled secondary data source found in
  `merchant_products` (2,392 "products" with raw numeric IDs matching
  zero real Shopify listings) was left untouched in the source table —
  only excluded from this report's query. Worth flagging to whoever
  manages the Merchant Center feed configuration.
- Requirement 1 (Product Performance Report) was flagged separately
  during this investigation as having an even less-scoped version of the
  original currency='EUR' bug (no store filter at all) — not fixed, not
  explicitly requested this session.

## Next step

Consider whether Requirement 1 needs the same investigation/fix. Flag
the 84% Merchant Center feed-sync gap to whoever owns that feed.
