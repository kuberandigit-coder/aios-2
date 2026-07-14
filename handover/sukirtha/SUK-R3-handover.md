---
title: SUK-R3 — Handover
requirement_id: SUK-R3
type: handover
---

# Title
SUK-R3 — Slow-Moving Stock Identification — Handover

# Requirement ID
SUK-R3

# Purpose
Hand over the built Requirement 3 dashboard for review and deployment
decision.

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
Dynamic, computed at request time — see
`evidence/sukirtha/SUK-R3-90-day-sales-method.md`.

# Order Exclusion Rules
Cancelled, test, and VOIDED orders excluded.

# Refund Handling
Net sold quantity per line item via Shopify's own `refundableQuantity`.

# Current-Stock Source
Shopify inventory `available` quantity.

# Inventory Locations
Single active location: `LEDSone DE LTD`.

# Status Rule
Strict `Units Sold < 10 AND Current Stock > 100` → Slow-Moving.

# Completed
- Discovery performed (existing assets, tab structure, store connection,
  single-location inventory, sample order/line-item fields, 90-day order
  volume) — user then instructed to skip the formal discovery-approval
  gate ("this one also need live use the same api and start") and build
  directly, reusing the SUK-R2 live-endpoint pattern.
- New serverless endpoint
  `api/sukirtha-req3-slow-moving-stock.js` — paginated read-only pulls of
  (a) all products/variants/inventory and (b) all 90-day orders/line-
  items, merged by Variant ID, using the existing `SHOPIFY_ADMIN_TOKEN`
  Vercel Production env var (no new credential needed).
- Requirement 3 tab added to `pages/sukirtha.html` — full header, 11
  summary cards, 10 filter dimensions (SKU/title/variant search, Status,
  Product Status, Inventory Location, Current Stock range, Units Sold
  range, Missing SKU, Inventory Tracked), sortable 13-column table,
  pagination, CSV export matching the required 19 columns.
- Fixed a field-collision bug during build (Shopify `status` vs. computed
  Slow-Moving `status` were both writing to the same key) — renamed to
  `productStatus` before it reached any rendering or filter code.
- Div-balance and JS-syntax validated (`node --check` on the extracted
  script; ESM syntax check on the endpoint file). Requirement 1 and 2 tabs
  confirmed structurally untouched.

# Remaining Work
- **This requirement explicitly withholds Vercel deployment approval** —
  the endpoint has not been executed against live Shopify data, so no
  real Slow-Moving count, Total Current Stock, or Units Sold figures
  exist yet. All 30 validation checklist items were verified by code
  review, not live output.
- Git commit/push also explicitly requires separate written approval —
  not done.
- Reviewer sign-off (Sajeesan/Tamil Selvan/SEO Lead-Inventory Owner)
  pending, and can't meaningfully happen until live numbers exist.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`
(new).

# Evidence Location
`evidence/sukirtha/SUK-R3-*.md` (5 files)

# Validation Result
PASS on structural/logic review — see
`validation/sukirtha/SUK-R3-validation-report.md`. Live functional
validation blocked pending deploy approval.

# Owner
Sukirtha

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead / Inventory Owner — pending

# Status
Built, locally validated. Not deployed, not pushed — both explicitly
withheld by this requirement's own instructions pending separate written
approval.

# Known Limitations
See `evidence/sukirtha/SUK-R3-shopify-source-map.md` and
`SUK-R3-inventory-location-map.md`.

# Duplicate-Truth Risk
LOW — first slow-moving-stock report of this kind, no conflicting source.

# Parent AIOS Candidate Status
Not promoted — flagged as reusable pattern only.

# PASS / FAIL
PASS (build); PENDING (live)

# Next Step
User provides separate written approval to deploy to Vercel; then run
live, confirm real numbers against the boundary test cases, and update
all evidence/validation files with observed output.
