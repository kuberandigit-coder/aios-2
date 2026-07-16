# Evidence — Thasitha Requirement 5: Image priority fix + layout simplification

**Date:** 2026-07-16

## Purpose
User reported a specific SKU (`spsdp2bm-ide`) showing a broken/missing image despite the product existing and being active in Shopify. Also requested removing the Comparison (Diff/Change%/Trend) columns and the Summary Period selector for a simpler layout.

## Root cause found
The original metadata query prioritized `google_ads.merchant_products.image_link` (Merchant Center feed) over `listings.shopify_listings.main_image_url` (live Shopify CDN). Merchant Center feed images can go stale/broken over time even when the live Shopify listing has a current, working image. Confirmed live: `spsdp2bm-ide` had a broken Merchant Center image URL but a valid, current Shopify listing image.

## Fix
Re-ran the metadata join for all 1,865 SKUs with corrected priority: Shopify live listing image first (Germany preferred, `-ide` suffix fallback), falling back to Merchant Center only when no Shopify listing image exists at all. Result: 1,653 SKUs' images corrected to the live Shopify CDN source; 212 SKUs remain genuinely unresolved (no listing anywhere).

## Layout changes
- Removed Diff/Change %/Trend columns (3 columns) — Trend Status remains available as a filter only.
- Removed the Summary Period (30/60/90d) selector — KPI cards now fixed to 30-day figures.
- Simplified Sort By to Current 30d Total (asc/desc) and SKU (A→Z).
- Narrowed table `min-width` accordingly (1700px → 1350px desktop, 1400px → 1100px mobile).

## Status
Deployed to production. Commits `a5fddf5` (layout+image fix), pushed to `github.com/kuberandigit-coder/aios-2`.
