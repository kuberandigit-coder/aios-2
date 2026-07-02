# Evidence — Ripsan Two-Product Yesterday Sales Check (LEDSone UK)

**Date of check:** 2026-07-02
**Requester:** Mohamed Ripsan Digit Web
**Store:** LEDSone UK Ltd — ledsone.co.uk (verified via Shopify MCP get-shop-info: Advanced plan, GBP, timezone BST)
**Mode:** Read-only. No products, orders, customers, or theme files modified.

## Question
Did these two products receive any Shopify orders yesterday (2026-07-01)?

## Products confirmed (via Shopify Admin API `search_products` by handle)

| # | Handle | Product Title | Product GID | Variant IDs | SKUs |
|---|--------|---------------|-------------|-------------|------|
| 1 | 3-pack-modern-designer-ceiling-light-shades-6446 | 3 Pack Modern Designer Ceiling Light Shades~6446 | gid://shopify/Product/15171176759682 | 55932107850114, 55932107882882, 55932107915650, 55932107948418, 55932107981186 | WCBCFBM3PK+RPR44WH3PK, WCIR300BM3PK+RPR44WH3PK, WCFL180BM3PK+RPR44WH3PK, WCFL180RO3PK+RPR44WH3PK, WCBCFRO3PK+RPR44WH3PK |
| 2 | nautical-fisherman-wire-cage-for-pendant-light-ceiling-light | Industrial Metal Wire Cage Pipe Pendant Light for 3/4 Inch Conduit ~ 5558 | gid://shopify/Product/14821247418754 | 54971046003074, 54971046035842, 54971046068610, 54971046101378, 54971046134146 (+1 more, 6 variants total) | WCPC170YE, WCPC210YE, WCPC170GY, WCPC210GY, WCPC170GR (+1) |

Note: URL 2 (`/collections/conduit-lighting/products/nautical-fisherman-wire-cage-...`) resolves to the handle above; the product title has since been renamed to "Industrial Metal Wire Cage Pipe Pendant Light for 3/4 Inch Conduit ~ 5558". Handle match is exact — match confidence is certain.

## Query method

- Data source: Shopify Admin GraphQL API via Claude Shopify MCP connector (`graphql_query`).
- Query: `orders(query: "created_at:>='2026-07-01T00:00:00+01:00' created_at:<'2026-07-02T00:00:00+01:00'")` — store timezone BST (UTC+1) explicitly used.
- Fields pulled per order: name, createdAt, line items (quantity, sku, title, product id + handle, variant id, original line total).
- Pagination: 2 pages, 50 per page; `hasNextPage: false` on page 2 — full day covered.

## Raw result summary

- Orders found for 2026-07-01 (BST): 79 orders, #LED56881 – #LED56959 (first created 2026-06-30T23:20:59Z = 00:20 BST; last 2026-07-01T22:45:56Z = 23:45 BST). No customer personal data retrieved.
- Every line item in all 79 orders was checked against: product GID 15171176759682, product GID 14821247418754, both handles, all variant IDs, and all SKU prefixes (`WCBCF…3PK`, `WCIR300…3PK`, `WCFL180…3PK`, `WCPC170…`, `WCPC210…`).
- **Matches found: 0.** No line item referenced either product.
- Near-miss noted and excluded: order #LED56896 contained SKU `WCB3BS+RPR44WH` ("Brushed Silver Drum Metal Wire Cage… ~1994", product 5742787100833) — a different product; not a match.

## Verdict

**No matching line items found.** Neither product sold on 2026-07-01 (BST).

## Files

- Evidence: `evidence/shopify_sales/2026-07-02_ripsan_two_product_yesterday_sales_evidence.md` (this file)
- Report: `reports/shopify_sales/2026-07-02_ripsan_two_product_yesterday_sales_report.md`

**Status:** PASS (both products checked against full day of orders; zero-sales proven, evidence saved)
**Reviewer:** Mohamed Ripsan Digit Web
**Next step:** Re-run for future dates on request; report format is reusable.
