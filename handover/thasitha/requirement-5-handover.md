---
title: Thasitha Requirement 5 — Handover
requirement_id: THASITHA-R5
date: 2026-07-16
status: BUILT — AMBER — not deployed
---

## Purpose
Handover for whoever resumes this next.

## What happened
Discovery stopped once (blockers: SKU scope, metric definition, Amazon data gap). User then confirmed: SKU scope = all ledsone.de products, metric = units sold, Amazon = skip entirely (confirmed live: zero synced orders since 2023-04-19). Built accordingly.

## What's built
- New "Requirement 5" tab: summary cards (with 30/60/90 period selector), filters (search/trend/sort/clear), grouped 2-row table header (Current Year × Shop/eBay × 30/60/90d, Previous Year same, Comparison), sticky SKU/Product/Price columns, trend legend, rolling-window explanation note.
- 1,865 SKUs of real data embedded (`R5_PRODUCTS` array), ~750KB.

## Real bug caught during build
Same `merchant_products` duplicate-row fan-out issue as R4 — 1,890 raw joined rows deduped to 1,865 by keeping the first row with a non-null title.

## What's NOT done
- No deploy, no git push — explicitly withheld per this brief's rule requiring written approval.
- No live-browser visual check — only Node syntax-parse + full runtime simulation (confirmed R1-R4 unaffected, R5 populates all 1,865 rows correctly).
- eBay order-validity and SKU-mapping edge cases not separately confirmed (see [[requirement-5-validation]] AMBER items).

## Status
BUILT, AMBER. NOT deployed. NOT pushed.

## Next step
Awaiting explicit deploy approval. If/when eBay-specific validity rules need sign-off, revisit [[requirement-5-sales-definition]] and [[requirement-5-channel-sku-mapping]].
