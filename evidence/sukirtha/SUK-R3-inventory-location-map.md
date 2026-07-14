---
title: SUK-R3 — Inventory Location Map
requirement_id: SUK-R3
type: evidence
---

# Title
SUK-R3 — Inventory Location Map

# Requirement ID
SUK-R3

# Purpose
Document which Shopify inventory locations exist for ledsone.de and how
Current Stock is aggregated across them.

# Requirement Source
`prompts/sukirtha/SUK-R3-slow-moving-stock-prompt.md`

# Business Question
n/a — inventory infrastructure documentation.

# Shopify Store
ledsone.de

# Shopify Objects Checked
`Location` (via `locations(first:10)`), `InventoryLevel` (via each
variant's `inventoryItem.inventoryLevels`).

# Shopify Fields Used
`Location.id`, `Location.name`, `Location.isActive`,
`Location.fulfillsOnlineOrders`, `InventoryLevel.quantities(names:["available"])`.

# Locations found
Exactly **one** active location: `LEDSone DE LTD`
(`gid://shopify/Location/48953295015`), `isActive:true`,
`fulfillsOnlineOrders:true`. No other locations exist for this store —
confirmed via a direct `locations(first:10)` query returning a single
edge.

# Current-Stock Source
Shopify inventory **available** quantity
(`quantities(names:["available"])`), per the requirement's stated
preference. Not `on_hand`, not `committed`, not `incoming` — those are
retrieved in the discovery sample but the dashboard's "Current Stock"
column uses `available` only, matching the spec's preferred source.

# Aggregation Formula
Since there is exactly one operational location, Current Stock = that
location's `available` quantity, with no cross-location summing decision
required. The endpoint code sums across whatever `inventoryLevels` Shopify
returns for a variant (defensive, in case a second location is added
later) — but today this is mathematically identical to reading the single
location's value directly. No "Inventory Location" filter ambiguity: the
filter exists in the UI per the requirement's spec, but will only ever
show one option (`LEDSone DE LTD`) until a second location is added.

# Negative Inventory
Not observed in the discovery sample (values seen were 0 in the two
sampled variants) — Shopify does permit negative available inventory in
general (oversell scenarios), and the dashboard does not clamp negative
values; they would display and sort as negative numbers, which is
intentionally accurate rather than hidden.

# Inventory Tracked
`InventoryItem.tracked` is read per variant. When `false`, Current Stock
displays "Not Tracked" (never treated as 0, never contributes to Total
Current Stock), and the variant's Status is forced to "Not Assessable"
per the requirement's exact rule.

# Files Modified
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`

# Evidence Location
This file.

# Validation Result
See `validation/sukirtha/SUK-R3-validation-report.md`.

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
Documented; live verification pending deploy approval.

# Known Limitations
If ledsone.de adds a second warehouse/location in the future, the
"approved operational locations" decision (which locations count toward
Current Stock) will need explicit re-confirmation — today's single-
location reality made that decision trivial, not because the logic
handles it generically with governance built in.

# Duplicate-Truth Risk
None — first inventory-location documentation of this kind for this
store in the AIOS asset tree.

# Parent AIOS Candidate Status
Not promoted.

# Next Step
Re-confirm this mapping if/when ledsone.de adds a second location.

# PASS / FAIL
PASS
