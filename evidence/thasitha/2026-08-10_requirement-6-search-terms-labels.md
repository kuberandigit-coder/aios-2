# Evidence — thasitha.html Requirement 6: Search Terms Labels (2026-08-10)

**Purpose:** Record of Requirement 6's build and same-day rebuild/fixes.

## Build history (same day)
1. **Initial build** (`73ea3b6`): Google Ads/Amazon-keyword-to-Shopify-SEO gap report.
2. **Rebuild to match Jefri's Req2 format** (`ab6ab77`): user wanted the exact same "Search Terms Labels" format already proven on Jefri's Requirement 2 — rebuilt from scratch to match that layout/columns rather than iterating on the original gap-report design.
3. **Show all 3 campaigns fix** (`da9604b`): was only showing campaigns with existing search-term data; fixed to show all 3 of Thasitha's DE campaigns, including new ones with 0 terms yet, so a campaign with genuinely no data isn't invisible/indistinguishable from "not loaded."
4. **False-zero display fix** (`454d3bb`): was showing a literal "€0.00 / 0.00% ROAS / Villain" tag on search terms where cost was simply never tracked in the source data — corrected to distinguish "never tracked" from "genuinely zero spend."

## Files touched
- `reports/digital-marketing-member-pages/pages/thasitha.html`

## Deployment
Deployed to production same day, verified live.

**Status:** PASS
**Reviewer:** Thasitha (pending review)
**Next step:** None called out in commit messages.
