# Report — Did These 2 LEDSone UK Products Sell Yesterday? (2026-07-01)

**Purpose:** Answer Ripsan's question: did the two shared product links get Shopify sales on 2026-07-01?
**Store:** ledsone.co.uk (LEDSone UK Ltd) · **Timezone used:** BST (UTC+1, store timezone)
**Data source:** Shopify Admin GraphQL API (read-only, via Claude Shopify connector)
**Date scope:** 2026-07-01 00:00 – 23:59 BST

## Result

| Product URL | Product Title | Orders Found | Quantity Sold | Gross Sales/Revenue | Order Names | Status |
|---|---|---|---|---|---|---|
| ledsone.co.uk/products/3-pack-modern-designer-ceiling-light-shades-6446 | 3 Pack Modern Designer Ceiling Light Shades~6446 | 0 | 0 | £0.00 | — | NO SALES |
| ledsone.co.uk/collections/conduit-lighting/products/nautical-fisherman-wire-cage-for-pendant-light-ceiling-light | Industrial Metal Wire Cage Pipe Pendant Light for 3/4 Inch Conduit ~ 5558 | 0 | 0 | £0.00 | — | NO SALES |

## How it was verified

- Both URLs resolved to exact product handles in Shopify (exact handle match — certain).
- All 79 orders created on 2026-07-01 BST (#LED56881–#LED56959) were retrieved and every line item checked by product ID, handle, variant ID, and SKU.
- Zero matching line items. Full proof in evidence file.

**Evidence:** `evidence/shopify_sales/2026-07-02_ripsan_two_product_yesterday_sales_evidence.md`
**Duplicate-risk:** None — no prior Ripsan/product-sales report existed; new `shopify_sales/` structure created.
**Status:** PASS
**Reviewer:** Mohamed Ripsan Digit Web
**Next step:** None required; re-run on request for other dates/products.
