---
title: SUK-R3 — Shopify Source Map
requirement_id: SUK-R3
type: evidence
---

# Title
SUK-R3 — Shopify Source Map

# Requirement ID
SUK-R3

# Purpose
Document exactly which Shopify objects/fields/mechanisms this requirement
reads from, confirming no other data source was used.

# Requirement Source
`prompts/sukirtha/SUK-R3-slow-moving-stock-prompt.md`

# Business Question
Which ledsone.de variants sold <10 units in 90 days while holding >100
units of current stock?

# Shopify Store
ledsone.de (confirmed via `shop.myshopifyDomain` = `ledsone-de.myshopify.com`,
same store already verified for SUK-R2 in this session).

# Shopify Objects Checked
`Product`, `ProductVariant`, `InventoryItem`, `InventoryLevel`, `Location`,
`Order`, `LineItem`.

# Shopify Fields Used
- Product: `id`, `title`, `handle`, `status`, `updatedAt`
- Variant: `id`, `title`, `sku`, `price`, `inventoryItem{id, tracked}`
- Inventory: `inventoryLevels{location{id,name}, quantities(names:["available"])}`
- Location: `id`, `name`, `isActive`, `fulfillsOnlineOrders`
- Order: `id`, `createdAt`, `cancelledAt`, `test`, `displayFinancialStatus`
- LineItem: `sku`, `quantity`, `refundableQuantity`, `variant.id`

All confirmed live-queryable via direct sample calls during discovery
(single-location sample, 3-order sample with full line-item detail, all
fields returned without error).

# Data Grain
One row per Shopify `ProductVariant` (`variantId` is the primary key for
both the inventory join and the sales join — never SKU alone).

# Live retrieval path
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`
— Vercel serverless function, reusing the same `SHOPIFY_ADMIN_TOKEN`
Production environment variable already set up for SUK-R2 (server-side
only, never in HTML/client JS). Two parallel paginated Admin GraphQL
pulls: all products/variants/inventory, and all orders/line-items in the
90-day window — merged in-memory by Variant ID.

# No mutation performed
Only read queries (`products`, `orders`, `locations`) are called. Zero
mutation calls. No inventory, price, or order record was changed.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html` (Requirement
3 tab added), `reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`
(new).

# Evidence Location
This file, plus `SUK-R3-inventory-location-map.md`,
`SUK-R3-90-day-sales-method.md`, `SUK-R3-slow-moving-summary.md`,
`SUK-R3-data-quality-summary.md`.

# Validation Result
See `validation/sukirtha/SUK-R3-validation-report.md`.

# Owner
Kuberan (AIOS) / Claude Code session, on behalf of Sukirtha.

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead / Inventory Owner — pending

# Status
Built, locally validated (syntax/structure). **Not deployed** — this
requirement explicitly withholds Vercel deployment approval, so live
production numbers have not been generated or observed yet.

# Known Limitations
Same 100-variants-per-product pagination note as SUK-R2 (no current
product approaches this). Order pull is capped at 100 line items per
order page — no current order approaches this either.

# Duplicate-Truth Risk
No prior "slow-moving stock" or inventory-velocity report exists anywhere
in the Sukirtha, Kamsi, or general AIOS asset folders (checked via
targeted search before build) — LOW risk, first report of this kind.

# Parent AIOS Candidate Status
Not promoted — flagged as a reusable pattern only (variant-level 90-day
sales + inventory join method could apply to other stores).

# Next Step
User approval to deploy; then live retrieval and full validation against
the boundary test cases using real numbers.

# PASS / FAIL
PASS (build); PENDING (live verification, blocked on deploy approval)
