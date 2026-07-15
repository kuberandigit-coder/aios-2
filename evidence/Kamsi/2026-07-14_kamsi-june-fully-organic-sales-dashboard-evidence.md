---
title: Kamsi — June 2026 Fully Organic Sales Dashboard — Evidence
requirement_id: SUK-KAMSI-SALES-1
type: evidence
---

# Title
Kamsi — June 2026 Fully Organic Sales Dashboard — Evidence

# Requirement ID
SUK-KAMSI-SALES-1

# Purpose
Add a Kamsi tab to the LEDSone.co.uk staff sales dashboard
(`sales.html`) showing only fully organic June 2026 product sales for
Kamsi-owned products, with full customer-journey session detail.

# Business Question
Which June 2026 orders on ledsone.co.uk contain a Kamsi-assigned
product, arrived via a completely Organic Search customer journey, and
what did Kamsi's organic product sales actually total?

# GA4 Property
n/a — this task uses Shopify order/journey data, not GA4.

# GSC Property
n/a.

# Existing Page Discovery
`sales.html` was found to exist at
`reports/digital-marketing-member-pages/pages/sales.html`, but
contained only a single `<iframe>` embedding a legacy Google Apps
Script sheet — no tab system, no staff dashboards, no backend endpoint.
User confirmed (asked directly): replace the iframe with a real tabbed
dashboard, starting with Kamsi as the first tab. No second HTML page
was created.

# Allocation Source
`reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv` (725 rows)
— read as-is server-side by the new API endpoint. **Not rebuilt from
collection URLs in this task**, per instruction. Copied verbatim into
`api/data/kamsi-product-allocation.csv` so Vercel's build can statically
trace and bundle the `fs.readFileSync` call.

Allocation stats confirmed at runtime: 725 rows, 725 unique Product
IDs, 0 duplicate Product IDs, 0 empty IDs rejected, **0 Variant IDs
available** (the source CSV records `variant_ids`/`variant_gids` as
`MISSING_FROM_DB` for every row — documented gap from the earlier
allocation-build task, not fabricated here). Matching therefore
operates at Product ID/GID level only; this does not affect order
qualification correctness since Shopify collection membership (the
ownership source) is inherently per-product, not per-variant.

# Shopify UK API Configuration
- Store domain: `ledsone.myshopify.com` (confirmed live via
  `shop { myshopifyDomain primaryDomain { url } }` — `primaryDomain.url
  = https://ledsone.co.uk`)
- API version: `2024-10`
- Env vars used: `SHOPIFY_UK_STORE_DOMAIN`, `SHOPIFY_UK_ADMIN_TOKEN`,
  `SHOPIFY_UK_API_VERSION` — all added to Vercel production with
  explicit user approval (user supplied the token directly in chat and
  said "use this"; risk of the write was explained before upload,
  matching the pattern already used for the ledsone.de/GA4 tokens
  earlier this session).
- Scope confirmed live: `read_orders` (order + line item + refund
  queries succeeded). `read_all_orders` was not separately probed —
  June 2026 data was accessible without hitting any historical-access
  error, so no escalation was needed.

# Critical Bug Found & Fixed: Shopify `created_at` Query Parser
Live-tested the exact query pattern from the task spec —
`created_at:>=2026-06-01T00:00:00+01:00 AND created_at:<2026-07-01T00:00:00+01:00`
— against the real API. **Shopify's search-query parser does not
reliably handle a time component on `created_at` at all**: even a
single clause with a time portion gets silently truncated to
date-only, and a garbage extra filter term gets split off (visible in
the GraphQL `extensions.search[].warnings` debug field: `"Invalid
search field for this query", code: "invalid_field"`). With two
clauses combined via AND, the upper bound was corrupted to
`23:59:59+01:00` instead of `00:00:00+01:00`, silently admitting an
entire extra day of orders (verified: an order dated
`2026-07-01T14:52:31Z` was returned by the "June" query before the
fix).

**Fix applied:** the Shopify query now uses a **date-only** boundary
(`created_at:>=2026-05-31 AND created_at:<2026-07-02`, one day wider on
each side as a safety margin) — confirmed the shop's own
`ianaTimezone` is `Europe/London`, so Shopify's date-only
interpretation already aligns. The **exact** inclusion boundary is then
enforced in code (`REPORT_START_MS`/`REPORT_END_MS`, computed from
`new Date('2026-06-01T00:00:00+01:00')` /
`new Date('2026-07-01T00:00:00+01:00')`), never trusting Shopify's own
date-only parsing as the source of truth. Verified after fix: earliest
included order `2026-06-02T12:25:14Z`, latest `2026-06-30T18:58:51Z` —
zero July orders, zero May orders.

# GraphQL Fields Retrieved
`Order`: `id legacyResourceId name createdAt updatedAt cancelledAt
cancelReason test displayFinancialStatus displayFulfillmentStatus
currentTotalPriceSet currentTotalDiscountsSet`.
`customerJourneySummary`: `ready customerOrderIndex daysToConversion
firstVisit lastVisit moments(first:100){...pageInfo}` (all
`CustomerVisit` fields: `id occurredAt landingPage referrerUrl source
sourceDescription sourceType referralCode utmParameters{source medium
campaign term content}`).
`lineItems(first:100)`: `id name title variantTitle sku quantity
refundableQuantity originalUnitPriceSet discountedTotalSet variant{id
legacyResourceId title sku product{id legacyResourceId title handle}}`.
`refunds`: `id createdAt refundLineItems(first:100){quantity
lineItem{id} subtotalSet}`.

One field from the task's example query was **removed** —
`currentTotalRefundedSet` does not exist on `Order` in API version
2024-10 (confirmed live: `Field 'currentTotalRefundedSet' doesn't
exist on type 'Order'`). It was unused anyway (refunds are computed
exactly from `refundLineItems`, matched by Line Item ID, per the task's
preferred principle — not estimated).

# Organic Classification Rule Implementation
`classifySession(visit)` — central reusable function, returns one of
`ORGANIC_SEARCH | PAID_SEARCH | DIRECT | SOCIAL | EMAIL | AFFILIATE |
REFERRAL | OTHER | UNKNOWN`. Paid evidence (UTM medium in
`cpc/ppc/paid/paid_search/paidsearch/display/shopping/paid_social/cpv/cpm/cpa`,
click IDs `gclid/gbraid/wbraid/msclkid/dclid` in URLs, or `sourceType`
containing "paid") is checked **first** and overrides any
search-engine-looking source, per the task's explicit rule. Recognised
organic search engines: Google, Bing, Yahoo, DuckDuckGo, Ecosia,
Yandex, Baidu, AOL, Ask (case-insensitive substring match on
`source`/`sourceDescription`/referrer hostname).

`classifyOrderJourney(order)` implements all 8 required statuses.
`FULLY_ORGANIC` requires: `customerJourneySummary` exists, `ready =
true`, at least one visit, first visit organic, last visit organic,
**every** available `CustomerVisit` moment organic (not just
first/last) — matching the task's explicit warning not to classify
organic based only on first+last.

# Kamsi Matching Logic
`matchLineItemToKamsi()` — priority order exactly as specified: (1)
Variant GID, (2) numeric Variant ID, (3) Product GID, (4) numeric
Product ID. Live result: 100% of matches this run resolved via
`product_gid` (priority 3) — expected, since Variant IDs are
unavailable in the source data (documented above). Never matched by
SKU.

Only matched line items contribute to Kamsi's KPI totals — verified: a
mixed-product order's non-Kamsi line items are excluded from the
`matchedItems` array entirely; `orderTotal` is shown separately and
labeled distinctly from Kamsi's gross/net figures in both the UI and
CSV export.

# Refund Attribution
Exact refund-line matching by Shopify Line Item ID (`refunds[].refundLineItems[].lineItem.id
=== lineItem.id`), never proportional estimation, per the task's
stated preference.

# Files Created/Modified
- `reports/digital-marketing-member-pages/pages/sales.html` (rewritten
  — iframe replaced with Kamsi tab dashboard)
- `reports/digital-marketing-member-pages/api/sales-kamsi.js` (new)
- `reports/digital-marketing-member-pages/api/data/kamsi-product-allocation.csv`
  (new — verbatim copy of the authoritative allocation CSV for Vercel
  bundling)
- This evidence file, plus validation report, handover, and completion
  report (see below).

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Deployed, live-tested, validated.
