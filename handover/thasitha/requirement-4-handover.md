---
title: Thasitha Requirement 4 — Handover
requirement_id: THASITHA-R4
date: 2026-07-16
status: BUILT — AMBER — not deployed
---

## Purpose
Handover for whoever resumes this next.

## Team member / Department / Store
Thasitha / Google Ads / ledsone.de

## What happened
Discovery was stopped once (see original blockers, superseded below), then
the user reviewed and explicitly said "get all the data from postgres only
and update" — so the page was built using live PostgreSQL data with
working defaults for the two still-unresolved definitions, clearly
labelled on-page rather than silently invented.

## Real bug caught and fixed during the build
Initial join attempt matched Google Ads `product_item_id` directly against
Shopify `real_sku` (case-insensitive) — this returned **zero** matches for
~99% of the 572-SKU scope, because most `product_item_id` values in this
campaign scope are numeric Shopify listing IDs (`listings.shopify_listings.item_id`),
not literal SKU strings. Fixed by resolving `product_item_id → shopify_listings.item_id → sku`
first. Also caught `merchant_products` having duplicate `product_id` rows,
which fanned out a join 572→952 rows before deduping. Both are documented
in [[requirement-4-validation]] test 5.

## What's built
- New "Requirement 4" tab in `reports/digital-marketing-member-pages/pages/thasitha.html`:
  summary cards, filters (search/campaign/status/sort/clear), grouped
  2-row table header (Past 30/60/90 Days × Shopify/Ads/Diff/Status),
  sticky SKU/Product/Price columns, status legend, data-source note.
- 572 SKUs of real data embedded (`R4_PRODUCTS` array).

## What's NOT done
- No deploy (`vercel --prod`), no `git push` — explicitly withheld per
  instruction. File is modified locally only (`git status` shows it as
  modified, uncommitted).
- No live-browser visual check this pass (only Node syntax-parse check).
- Two definitions remain working defaults pending sign-off (Shopify
  status filter, Ads conversion-action purity) — see
  [[requirement-4-order-definition]].
- CSV export not built — no existing reusable export pattern found
  elsewhere in the project.

## Status
BUILT, AMBER. NOT deployed. NOT pushed.

## Next step
Get sign-off on the 2 AMBER items if/when needed; otherwise, deploy is
just a `git commit` + `git push` + `vercel --prod` away once explicitly
approved by the user.
