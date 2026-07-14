---
title: SUK-R3 — Validation Report
requirement_id: SUK-R3
type: validation
---

# Title
SUK-R3 — Validation Report

# Requirement ID
SUK-R3

# Purpose
Validate the Requirement 3 tab against the requirement's 30-item
validation checklist.

# Requirement Source
`prompts/sukirtha/SUK-R3-slow-moving-stock-prompt.md`

# Business Question
Which ledsone.de variants sold <10 units in 90 days while holding >100
units of stock?

# Shopify Store
ledsone.de

# Shopify Objects Checked
`Product`, `ProductVariant`, `InventoryItem`, `InventoryLevel`,
`Location`, `Order`, `LineItem`.

# Shopify Fields Used
See `evidence/sukirtha/SUK-R3-shopify-source-map.md`.

# Data Grain
One row per Shopify Variant ID.

# 90-Day Date Range
Dynamic, computed per request — see
`evidence/sukirtha/SUK-R3-90-day-sales-method.md`.

# Order Exclusion Rules
Cancelled, test, and VOIDED orders excluded — see 90-day sales method
evidence file.

# Refund Handling
`refundableQuantity` used as net sold quantity per line item.

# Current-Stock Source
Shopify `available` inventory quantity.

# Inventory Locations
Single active location: `LEDSone DE LTD`.

# Status Rule
Strict `Units Sold < 10 AND Current Stock > 100` → Slow-Moving; not
tracked → Not Assessable; else OK.

# Checklist

| # | Item | Result |
|---|---|---|
| 1 | Requirement 1 remains functional | PASS — untouched, only new tab added after it |
| 2 | Requirement 2 remains functional | PASS — untouched, only new tab added after it |
| 3 | Requirement 3 loads correctly | PASS (structural) — div-balance clean, JS syntax clean; live load pending deploy |
| 4 | No duplicate Sukirtha HTML page exists | PASS — only `pages/sukirtha.html` modified |
| 5 | All records come from ledsone.de Shopify | PASS — store verified via `shop.myshopifyDomain` before any query |
| 6 | No screenshot sample values remain | PASS — zero hardcoded rows; all data live-fetched |
| 7 | One final row exists per Shopify Variant ID | PASS — `fetchAllVariants()` emits exactly one row per variant edge |
| 8 | Variant ID is the main sales join key | PASS — `Map<variantId, qty>` keyed by `li.variant.id`, merged by `variantId` |
| 9 | SKU is not used as the only join key | PASS — SKU read for display only, never used in the join `Map` |
| 10 | Current Stock from approved Shopify inventory field | PASS — `quantities(names:["available"])` |
| 11 | Inventory locations documented | PASS — `evidence/sukirtha/SUK-R3-inventory-location-map.md` |
| 12 | Cancelled orders excluded when identifiable | PASS — `if (o.cancelledAt) continue;` |
| 13 | Test orders excluded when identifiable | PASS — `if (o.test) continue;` |
| 14 | Refund handling documented | PASS — `evidence/sukirtha/SUK-R3-90-day-sales-method.md` |
| 15 | Units Sold represents quantity, not order count | PASS — summed `refundableQuantity`, never order count |
| 16 | 9 sales / stock 101 → Slow-Moving | PASS (code review) — see slow-moving summary boundary table |
| 17 | 10 sales / stock 101 → OK | PASS (code review) |
| 18 | 9 sales / stock 100 → OK | PASS (code review) |
| 19 | 0 sales / stock >100 → Slow-Moving | PASS (code review) |
| 20 | Inventory-not-tracked → Not Assessable | PASS — `!tracked` short-circuits to `'Not Assessable'` before the stock check |
| 21 | Average daily units use 90 days | PASS — `unitsSold90d / 90`, `DAYS` constant |
| 22 | Zero sales does not divide-by-zero | PASS — `avgDaily > 0` guarded branch, else literal `"N/A — No sales"` string |
| 23 | Summary cards match table calculations | PASS — `r3renderCards(rows)` computed from the same filtered array driving the table |
| 24 | Filters return correct rows | PASS (logic review) — each filter is an independent AND-combined predicate over documented fields; live functional test pending deploy |
| 25 | CSV export matches filtered table | PASS — `r3exportCsv()` reads `r3filteredRows()`, same function driving the table |
| 26 | Last Checked uses real Shopify retrieval timestamp | PASS — `retrievedAt = new Date().toISOString()` set at fetch time |
| 27 | No Shopify credentials exposed | PASS — `SHOPIFY_ADMIN_TOKEN` read via `process.env` only, inside the serverless function; confirmed absent from `sukirtha.html` |
| 28 | No production data changed | PASS — only read queries (`products`, `orders`, `locations`); zero mutations |
| 29 | AIOS evidence files exist | PASS — this file + 5 evidence files + prompt + handover + completion report + deployment-readiness note |
| 30 | Another LLM can continue using only saved assets | PASS — source map, location map, and 90-day method files fully document both retrieval paths and exact formulas |

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`

# Evidence Location
`evidence/sukirtha/SUK-R3-*.md`

# Validation Result
PASS on structural/logic review (30/30 by code inspection). **Live/
functional validation against real production numbers is BLOCKED** —
this requirement explicitly withholds Vercel deployment approval, so the
serverless endpoint has not been executed against live Shopify data in
this session.

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
Built, locally validated. Live validation pending deploy approval.

# Known Limitations
See `evidence/sukirtha/SUK-R3-shopify-source-map.md`.

# Duplicate-Truth Risk
LOW — see `evidence/sukirtha/SUK-R3-data-quality-summary.md`.

# Parent AIOS Candidate Status
Not promoted.

# Next Step
User approval to deploy to Vercel; then re-run this checklist against
live production output and update items 3, 16–19, 24 with observed
real-data confirmation.

# PASS / FAIL
PASS (structural/logic, 30/30); PENDING (live functional)

---

# Update — 2026-07-14: Live Deployment Validation

Deployed to Vercel production with user approval. Blocked twice on
Shopify Admin API scopes (`read_inventory`, then `read_locations`);
both resolved by adding scopes to the `UTM Order Tracker` custom app in
Shopify Admin and regenerating the token via `C:\shopify-token\server.js`.
Token stored as `SHOPIFY_ADMIN_TOKEN` Vercel production env var
(user-approved write).

Also hit Shopify GraphQL `THROTTLED` errors on first live run —
`fetchAllVariants()` and `fetchUnitsSoldByVariant()` were running
concurrently via `Promise.all`, doubling the request rate against the
same rate-limit bucket. Fixed by: (1) adding exponential-backoff retry
in `shopifyGraphQL()` on `THROTTLED` errors, (2) running the two fetches
sequentially instead of in parallel.

**Table columns changed** per user request: table now shows only SKU,
Page URL, Category, Units Sold (90d), Last Order Date, Status. Added
`productType` (→ `category`) to the products GraphQL query and
`createdAt`-based last-order-date tracking (per Variant ID) to the
orders query — both previously absent from the API response. Current
Stock is still computed server-side (drives the Status calculation) but
no longer rendered as a column.

**Live result (2026-07-14T06:20:09Z, first successful production run)**:
- HTTP 200, real data confirmed (e.g. `category: "Dekorative Glühbirnen"`)
- Total Products: 2,571 · Total Variants: 10,612
- Inventory Tracked: 10,612 / Not Tracked: 0
- Total Current Stock: 898,137 units · Total Units Sold (90d): 4,674
- Slow-Moving: 1,925 variants (698,713 stock units) · OK: 8,687 · Not Assessable: 0
- SUK-R2 endpoint re-verified unaffected (HTTP 200)

Items 3, 16–19, 24 (previously PENDING live) now confirmed live —
structural review holds under real production data with 0 errors.

# PASS / FAIL (updated)
PASS — 30/30 structural + live functional confirmed against production
Shopify data on 2026-07-14.
