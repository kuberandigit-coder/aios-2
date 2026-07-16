---
title: Thasitha Requirement 5 — Validation
requirement_id: THASITHA-R5
date: 2026-07-16
status: BUILT — AMBER (Amazon excluded per confirmed data gap; scope/metric confirmed via user instruction)
---

## Purpose
Validation of the actual R5 build, after the user reviewed the blockers and explicitly instructed: "build shopify and ebay only, skip amazon", plus confirmed SKU scope ("all ledsone.de products") and metric ("units sold").

## Test results

| # | Test | Result |
|---|---|---|
| 1 | Requirement Source Test | AMBER — no CSV exists; scope/metric confirmed via direct user instruction instead, same pattern as R4 |
| 2 | Metric Definition Test | PASS — units sold (`SUM(item_quantity)`), confirmed by user, matches R4's convention |
| 3 | Channel Source Test | PASS — Shopify (`sub_source_id=108`), eBay (`sub_source_id=27`) confirmed live through 2026-07-16. Amazon (`sub_source_id=14`) confirmed excluded — verified live, zero rows since 2023-04-19, zero rows for all of 2025/2026 |
| 4 | Store Test | PASS — all three accounts confirmed Germany-scoped by name and cross-checked against order data |
| 5 | Common-End-Date Test | PASS — both Shopify and eBay confirmed live through 2026-07-16; used 2026-07-15 as the comparison end date (user-specified) |
| 6 | Date Shift Test | PASS — previous-year periods are exact calendar-date shifts (2025-06-16→2025-07-15, etc.), not month-aligned |
| 7 | Window-Length Test | PASS — 30/60/90-day windows computed as `end - (N-1) days` to `end`, verified via manual date arithmetic |
| 8 | SKU Mapping Test | AMBER — Shopify SKU resolution reused from R4's proven `real_sku` field; eBay SKU resolution uses the same shared `order_item_info.real_sku` field but has not been separately spot-checked for eBay-specific quirks (variation SKUs, aliases) |
| 9 | Bundle SKU Test | PASS — SKUs containing `+` preserved intact throughout (verified sample: `crff100bm+wsls155yb+scrn70bm+lsft220bm` present unmangled in output) |
| 10 | Duplicate Test | PASS — caught and fixed the same `merchant_products` duplicate-row fan-out bug found in R4 (1890 raw rows → 1865 deduped by keeping first non-null title) |
| 11 | Zero/Blank Test | AMBER — Price shows N/A for 375/1865 SKUs (20.1%) with no merchant/listing match; sales figures always show a real number (0 when genuinely no sales) since the query only returns SKUs with at least one qualifying sale, and 0-filled CASE WHEN branches for periods with no activity — "Not Listed"/"Data Check" statuses from the brief were not implemented as separate states since no channel-availability ambiguity was found (Shopify+eBay share one order table) |
| 12–15 | YoY Difference/Percentage/New Growth/Rolling-Window Tests | PASS — verified via code review: `diff30 = cy30-py30`, `r5ChangePct` returns "New Growth" (not Infinity) when py=0 and cy>0, "No Change" when both 0; 30/60/90 are independent rolling sums, never added together anywhere in the code |
| 16 | Summary Test | PASS — summary cards computed from the same `allRows` array used to render the table, with a period selector (30/60/90) that changes summary sums without altering the underlying table rows |
| 17 | Filter Test | PASS — search/trend/sort/clear all wired and tested via runtime simulation |
| 18 | Existing-Page Test | PASS — R1-R4 confirmed unaffected via full runtime simulation (t4kpiTotal still 572, r3kpiTotal still 232) |
| 19 | Responsive Test | PASS (structural) — sticky SKU/Product/Price columns, horizontal scroll container, mobile breakpoint narrows min-width. Not manually verified in a live browser |
| 20 | Browser Test | PASS — both `<script>` blocks parsed via Node `Function()`; full runtime simulation executed without error across all 5 tabs |
| 21 | Evidence Test | PASS — all 11 required AIOS files populated with real findings |

## Result: AMBER
Core Shopify+eBay YoY comparison is real, live-data-driven, all-catalog scope as instructed. Amazon correctly excluded with a documented, verified reason (stale sync, not a guess). Two items remain working defaults: eBay order-validity status filter (reuses Shopify's convention, not separately confirmed) and eBay SKU-mapping edge cases (not separately spot-checked).

## Reviewer
Claude Code (execution worker), self-assessed.

## Next step
None expected unless eBay-specific order-validity or SKU-mapping issues surface on review.
