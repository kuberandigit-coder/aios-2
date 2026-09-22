# Source Map — Sales 2026 UK: ShopifyQL access requirement

Date: 2026-09-22

| # | Source | Purpose | Authority | Data used | Read/Write | Status |
|---|---|---|---|---|---|---|
| 1 | Shopify Admin GraphQL `shopifyqlQuery` field (`ledsone_uk`/UK store token) | Powers the Shopify Actuals tab's full-year monthly sales table | Authoritative Shopify Analytics engine — same data as Shopify's own Analytics > Reports page | gross_sales, discounts, returns, net_sales, shipping_charges, return_fees, taxes, total_sales (daily, aggregated to monthly in Python) | Read-only | Live, working as of 2026-09-22 |

## Access requirement discovered (not previously documented anywhere in this codebase)

`shopifyqlQuery` requires the **`read_reports`** Admin API scope, which
is separate from `read_analytics` (already granted, insufficient on its
own) and from all the standard order/product scopes this app's UK token
already had. It additionally requires Shopify's own Protected Customer
Data access tier if the report ever surfaces customer-linked fields
(not needed for the sales-aggregate fields used here, but worth knowing
if this integration is ever extended).

**Action taken**: user added `read_reports` to the app's configuration
in Shopify Admin and re-authorized; confirmed live (ACCESS_DENIED before,
real data after, same code both times).

## Note for any future ShopifyQL usage in this codebase

If another page/feature ever wants to query `shopifyqlQuery` again, this
scope is now granted for the UK store's existing token — no new access
request should be needed for that store. A separate store (DE, FR) would
need this same scope granted on its own token first.
