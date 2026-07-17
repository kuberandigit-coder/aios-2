# Jackson — Standalone Product Sales Page (private, not on shared dashboard)

**Date:** 2026-07-17
**Purpose:** User supplied 50 Shopify product IDs owned by Jackson and asked for a month-by-month sales view for them from Shopify UK (`ledsone.co.uk`) — explicitly NOT as a tab on the shared staff dashboard (`pages/sales.html`), as a fully separate standalone page instead.

## What was built
### `reports/digital-marketing-member-pages/api/sales-jackson.js`
- Server-side only, reads `SHOPIFY_UK_ADMIN_TOKEN` (same token Kamsi's endpoint uses) from env — never exposed client-side.
- Hardcoded `JACKSON_PRODUCT_IDS` (50 IDs supplied by user).
- Month-scoped like the other dashboards: `SUPPORTED_MONTHS` Jan–Jul 2026, July is the live/month-to-date month with a Refresh button; unlike the other endpoints there are no static Jan–Jun snapshot files — every month is fetched live from Shopify on each request (55s in-memory cache), since the product scope is narrow (50 IDs) so full-month order volume is small.
- For each order in the requested month, filters line items to only Jackson's product IDs, computes gross/discounts/refunds/net per product, and buckets each product's net sales by channel (Organic Search, Google Ads/Paid Search, Direct, Social, Email, Referral, AI Tools, No Journey Data/Unknown) using the same `customerJourneySummary.firstVisit` classification logic as `sales-kamsi.js`.
- Returns `rows` (one per product with any sales that month), `totals`, and `productIdsWithNoSales` (Jackson IDs with zero orders that month).

### `reports/digital-marketing-member-pages/pages/jackson-sales.html`
- Fully standalone page — not linked from `index.html`, not a tab inside `pages/sales.html`, no reference to it anywhere else in the site.
- Month tabs Jan–Jul 2026 (July marked live, with Refresh button).
- Summary cards (products with sales, orders, units, gross, refunds, net) + a per-product table (Product ID, Title, Orders, Units, Gross, Discounts, Refunds, Net) with a row-hover tooltip showing the channel breakdown, plus a totals row.
- CSV export button, includes full per-channel columns.

## Why no static snapshots
Unlike Kamsi/Dilaksi/Sukirtha (which pre-generate Jan–Jun as frozen JSON snapshots for speed), Jackson's endpoint always live-fetches — the product list is small (50 IDs) so a full month's orders scan completes quickly, and this avoids a separate one-off snapshot-generation step for a page that's meant to be private/low-traffic.

## Verification performed (production)
- Deployed via `vercel --prod --yes`.
- Confirmed `/api/sales-jackson?month=2026-07&refresh=1` on production returns `success:true`, 11 products with July sales, 18 orders, £190.56 net, channel breakdown present, and lists the 39 Jackson IDs with zero sales that month.
- Confirmed `/pages/jackson-sales.html` returns HTTP 200 on production.
- Confirmed the page is not referenced from `index.html` or `pages/sales.html`.

## Live page
`https://digital-marketing-member-pages.vercel.app/pages/jackson-sales.html`

## Files added
- `reports/digital-marketing-member-pages/api/sales-jackson.js`
- `reports/digital-marketing-member-pages/pages/jackson-sales.html`
- `evidence/jackson/2026-07-17_jackson-standalone-sales-page.md` (this file)

## Status: PASS
Standalone page live, verified against production directly, not linked from the shared dashboard.

**Reviewer:** self-verified via live production curl checks.
**Next step:** none — page is live and usable month-by-month.
