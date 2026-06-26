# Task: Shopify Selected Products Section

**Date:** 2026-06-26
**Status:** Complete

## What was done

Created a Shopify Liquid section file that allows a merchant to hand-pick up to 5 products via the Theme Editor and display them as a product grid.

## Output file

`docs/selected-products-section.liquid`

## How to use

1. Copy `selected-products-section.liquid` into your Shopify theme's `sections/` folder.
2. In the Shopify Theme Editor, add the **Selected Products** section to any page.
3. Use the 5 product pickers (Product 1 – Product 5) to choose which products to show.
4. Set an optional section title.
5. Save and publish.

## What the section does

| Feature | Detail |
|---|---|
| Product pickers | 5 individual product pickers in schema settings |
| Product image | Renders `featured_image` at 400px width, 220px height, object-fit cover |
| Fallback image | Uses Shopify `placeholder_svg_tag` if no image set |
| Product title | Links to product page |
| Price | Rendered via `money` filter |
| Add to Cart | Form POST to `/cart/add` using first available variant |
| Sold Out state | Button disabled with grey style if product unavailable |
| Layout | CSS Grid, auto-fill columns, min 200px per card |

## Discovery check

- No existing Shopify section file found in `docs/`, `prompts/`, or `evidence/`
- No duplicate asset — CREATE was correct decision

## AIOS decision

CREATE NEW — no existing asset covered this requirement.
