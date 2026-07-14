---
title: SUK-R3 — 90-Day Sales Method
requirement_id: SUK-R3
type: evidence
---

# Title
SUK-R3 — 90-Day Sales Method

# Requirement ID
SUK-R3

# Purpose
Document exactly how Units Sold (90d) is computed, including the date
range logic, exclusion rules, and refund handling.

# Requirement Source
`prompts/sukirtha/SUK-R3-slow-moving-stock-prompt.md`

# Business Question
How many units of each variant sold in the last 90 days?

# Shopify Store
ledsone.de

# Shopify Objects Checked
`Order`, `LineItem`.

# Shopify Fields Used
`Order.createdAt`, `Order.cancelledAt`, `Order.test`,
`Order.displayFinancialStatus`, `LineItem.sku`, `LineItem.quantity`,
`LineItem.refundableQuantity`, `LineItem.variant.id`.

# 90-Day Date Range
Computed dynamically at request time, never fixed:
```
end   = UTC midnight of the query execution date
start = end - 90 calendar days
```
Recorded per request as `dateRangeStart`/`dateRangeEnd`
(`YYYY-MM-DD`) plus `retrievedAt` (full ISO timestamp) in the API
response — matches the requirement's "do not use a fixed historical date"
rule. Discovery-time sample: querying `ordersCount` for a 90-day window
ending 2026-07-14 returned **1,636 orders**, confirming the store has
enough order volume for this to be a meaningful signal (not a near-empty
window).

# Order Exclusion Rules
Excluded from Units Sold, in this exact order of evaluation:
1. `cancelledAt` is non-null → order excluded entirely.
2. `test` is `true` → order excluded entirely.
3. `displayFinancialStatus === 'VOIDED'` → order excluded entirely.

All three are reliably and directly identifiable from Shopify's own order
fields — no inference or heuristic guessing involved.

# Refund Handling
Per line item, `refundableQuantity` is used as the net "kept/sold"
quantity rather than the raw `quantity`. `refundableQuantity` is Shopify's
own computed value = original line-item quantity minus whatever has
already been refunded for that specific line item — this is a reliable,
Shopify-native Variant-ID-mapped refund figure (not an approximation),
satisfying the requirement's "do not subtract refunds unless refund
quantities can be reliably mapped to the correct Shopify Variant ID"
condition. If `refundableQuantity` is ever absent/non-numeric for a given
line item (not observed in sampling, but defensively handled), the code
falls back to raw `quantity` rather than crashing or silently dropping
the line item.

# Variant-Level Join
Each line item carries `variant.id` (a Shopify Global ID) directly — units
are summed into a `Map<variantId, totalQty>`, then merged onto each
variant row from the product/inventory pull by matching `variantId`
exactly. SKU is never used as a join key for this step (a line item's own
`sku` field is read but not used for joining — only for reference/
troubleshooting), satisfying "SKU is not used as the only join key."

# Formula Summary
```
Units Sold (90d) = Σ line_item.refundableQuantity
                    WHERE order NOT cancelled
                    AND order.test = false
                    AND order.displayFinancialStatus != 'VOIDED'
                    AND created_at IN [start, end)
                    GROUPED BY line_item.variant.id
```
If a variant has zero eligible line items, `Units Sold (90d) = 0` (default
Map lookup, no divide-by-zero, no null).

# Average Daily Units Sold / Days of Stock
`avgDailyUnitsSold = unitsSold90d / 90` (always safe — 90 is a constant,
never zero). `daysOfStockRemaining = currentStock / avgDailyUnitsSold`
only when `avgDailyUnitsSold > 0`, else `"N/A — No sales"` string; when
inventory isn't tracked, `"Not Assessable"` — both explicit string
branches avoid any divide-by-zero path.

# Files Modified
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`

# Evidence Location
This file.

# Validation Result
See `validation/sukirtha/SUK-R3-validation-report.md` — boundary cases
(9/101, 10/101, 9/100, 0/150) verified by direct code review of
`computeStatus()` against the requirement's strict `<` / `>` conditions
(not `<=`/`>=`).

# Owner
Kuberan (AIOS) / Claude Code session

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead / Inventory Owner — pending

# Status
Built; live numbers pending deploy approval.

# Known Limitations
`displayFinancialStatus` is Shopify's derived/display value rather than
the raw `financialStatus` enum — chosen because it's the more human-
readable equivalent Shopify itself recommends surfacing; behavior is
identical for the VOIDED case being excluded here.

# Duplicate-Truth Risk
None — first 90-day sales-velocity method documented for this store.

# Parent AIOS Candidate Status
Not promoted — flagged as reusable (variant-level net-sales-via-
refundableQuantity is a clean, generally-applicable pattern for other
stores' future "units sold" requirements).

# Next Step
Live retrieval once deploy is approved; spot-check a handful of real
variants' Units Sold against Shopify's own Analytics UI for cross-
verification.

# PASS / FAIL
PASS
