# Closure — Mahima Requirement 4 (Product ID Coverage): full rebuild

Date: 2026-09-22
Owner: Mahima
Reviewer: Kuberan
Repo: dm-dashboard, branch `dev-work`

## Status: COMPLETE

The page's ~10x inflated product count (26,831 vs a real catalog of
~2,711-2,771), its 70% cross-feed duplication, and its 100%-flagging
feed-eligibility heuristic were all root-caused via live, ID-level
verification against the real business database and Shopify's own
Admin API, fixed, deployed, and **confirmed live in production** via a
manual snapshot refresh + direct API check after each deploy.

## What was built

- Product universe rebuilt on `listings.shopify_listings`
  (`site='Germany', is_parent=1`) — the real, verified Shopify DE
  catalog — with Merchant Center feed data and campaign performance
  LEFT JOINed onto it.
- Feed-eligibility heuristic split into critical (blocks eligibility)
  vs recommended (flagged, non-blocking "Needs Improvement") attribute
  columns, per Google's actual Merchant Center requirements.

## Key files

`backend/app/mahima.py`, `frontend/src/mahima/pages/ProductIdCoverage.jsx`

## Commits

`87be999`, `4c2e032`, `020c1d0` — all deployed, confirmed live.

## Known limitations / follow-ups (not this task's bugs)

- 84% of the real Shopify DE catalog (2,320 of 2,771 products) has no
  Google Merchant Center feed row at all — a genuine feed-sync gap on
  the Merchant Center side, now visible for the first time. Flag to
  whoever manages that feed.
- Requirement 1 was flagged (not fixed) as having a related, even
  less-scoped version of the original currency-based bug.
