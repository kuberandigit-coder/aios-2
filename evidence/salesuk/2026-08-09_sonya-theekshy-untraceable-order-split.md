# Evidence — salesuk.html: Sonya/Theekshy Untraceable Google Ads Order Split (2026-08-09)

**Purpose:** Record of the March/April 2026 snapshot regeneration splitting untraceable Google Ads orders between Sonya and Theekshy.

## Change (`3e26da9`)
Sonya's "untraceable-campaign" catch-all rule previously claimed every order with no UTM campaign/term and `medium=google_ads`. Per a user-supplied product list (413 IDs, ledsone.co.uk), orders carrying a Theekshy-owned product now route to her tab instead of Sonya's.

Regenerated live from Shopify for the 2 affected closed months:
- `salesuk-sonya-2026-03.json` / `-2026-04.json`: now exclude Theekshy-owned orders.
- `salesuk-theekshy-2026-03.json` (new, 2 orders) / `-2026-04.json` (new, 13 orders): created.

## Files touched
- `reports/digital-marketing-member-pages/api/data/salesuk-sonya-2026-{03,04}.json`
- `reports/digital-marketing-member-pages/api/data/salesuk-theekshy-2026-{03,04}.json` (new)

## Deployment
Snapshots regenerated live from Shopify and deployed/committed same day.

**Status:** PASS — order counts (2 for March, 13 for April moved to Theekshy) documented directly in the commit message.
**Reviewer:** Pending.
**Next step:** None called out; only 2 closed months (March, April) were in scope — later months should be checked if the same untraceable-order pattern recurs.
