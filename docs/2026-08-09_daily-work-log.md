# Daily Work Log — 2026-08-09

## Summary
Single data-correction task: split a set of previously-untraceable Google Ads orders on `salesuk.html` between Sonya and Theekshy based on a user-supplied product list.

## Tasks Completed

1. **Sonya/Theekshy product-ID split for untraceable Google Ads orders** (`3e26da9`): Sonya's "untraceable-campaign" catch-all rule previously claimed every order with no UTM campaign/term and `medium=google_ads`. Per a user-supplied product list (413 IDs, ledsone.co.uk), orders carrying a Theekshy-owned product now route to her tab instead of Sonya's.
   - Regenerated snapshots live from Shopify for the 2 affected closed months:
     - `salesuk-sonya-2026-03.json` / `-2026-04.json`: now exclude Theekshy-owned orders.
     - `salesuk-theekshy-2026-03.json` (new, 2 orders) / `-2026-04.json` (new, 13 orders): created.

## Files Touched
- `reports/digital-marketing-member-pages/api/data/salesuk-sonya-2026-{03,04}.json` (regenerated)
- `reports/digital-marketing-member-pages/api/data/salesuk-theekshy-2026-{03,04}.json` (new)

## Status
Snapshots regenerated live from Shopify and committed same-day; commit message itself documents the before/after order counts (2 and 13 orders moved to Theekshy for March/April respectively).

## Outstanding
- None called out in the commit.
