---
title: Thasitha Requirement 5 — Multichannel YoY SKU Sales — Report
requirement_id: THASITHA-R5
date: 2026-07-16
status: BUILT — AMBER
---

## Purpose
Final data totals for Requirement 5, pulled live from PostgreSQL per user instruction to build Shopify+eBay only, skip Amazon.

## Business question
For each SKU: Shopify and eBay units sold in the latest 30/60/90-day periods this year, vs. the equivalent periods last year.

## Scope
1,865 SKUs — every SKU with at least one valid Shopify or eBay order (Germany accounts) in the current 90-day window (2026-04-17 to 2026-07-16) or previous-year 90-day window (2025-04-17 to 2025-07-16).

## Channels
- Shopify (`sub_source_id=108`, ledsone-de)
- eBay (`sub_source_id=27`, ledsonede)
- Amazon excluded — confirmed zero synced orders since 2023-04-19, zero rows for all of 2024/2025/2026.

## Date windows
| Period | Current Year | Previous Year |
|---|---|---|
| 30 days | 2026-06-16 → 2026-07-15 | 2025-06-16 → 2025-07-15 |
| 60 days | 2026-05-17 → 2026-07-15 | 2025-05-17 → 2025-07-15 |
| 90 days | 2026-04-17 → 2026-07-15 | 2025-04-17 → 2025-07-15 |

## Data coverage
- SKU/title/price resolution: 1,490/1,865 (79.9%) resolved via `merchant_products` or `shopify_listings`. The remaining 375 SKUs have real sales history but no matching product feed/listing record (likely discontinued/unlisted) — shown as N/A, not invented.
- Duplicate fan-out from `merchant_products` (same issue found in R4) caught and fixed: 1,890 raw joined rows → 1,865 deduped.

## Known limitations
- eBay order-validity status filter reuses Shopify's convention (`status NOT IN ('Cancelled','Deleted')`) — not separately signed off for eBay.
- eBay SKU mapping uses the same `real_sku` field as Shopify but wasn't separately spot-checked for eBay-specific quirks (variation SKUs).
- Amazon entirely excluded per confirmed data gap — not a scope decision, a data-availability fact.

## Files created/modified
- `reports/digital-marketing-member-pages/pages/thasitha.html` — added Requirement 5 tab (HTML + CSS + JS + data), R1–R4 untouched (confirmed via runtime simulation).
- This report, plus [[requirement-5-validation]], [[requirement-5-discovery]], [[requirement-5-sales-definition]], [[requirement-5-channel-sku-mapping]], [[requirement-5-date-window-mapping]], [[requirement-5-ledsone-aios-mcp-knowledge-check]], [[requirement-5-ledsone-mcp-source-map]], [[requirement-5-multichannel-yoy-prompt]], [[requirement-5-handover]], [[requirement-5-deployment-readiness]].

## Status
Built. **NOT deployed, NOT pushed** — per this brief's explicit rule requiring written approval before deployment/git push.
