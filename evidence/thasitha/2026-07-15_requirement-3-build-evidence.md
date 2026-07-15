---
title: Thasitha Requirement 3 — SKU Overlap & CPC Inflation — Build Evidence
requirement_id: THASITHA-R3
date: 2026-07-15
status: BUILT (scope narrowed and formula corrected per direct user instruction, superseding the earlier full-account brief)
---

## Purpose
Records what was actually built for Requirement 3 tab 3 after the original
full-account brief (see `2026-07-15_requirement-3-discovery.md`) was
blocked at discovery. The user issued a follow-up message with a
simplified, directly-buildable spec, which takes precedence.

## Scope change from the original brief
Original brief: overlap across "all active Google Ads campaigns for
ledsone.de" — blocked because no current-assignment source exists for
PMax. **User's follow-up instruction changed the base set**: start from
the SKUs in Thasitha's own two PMax campaigns (already pulled for
Requirement 2), then check `google_ads.product_performance` account-wide
(any campaign, any status, all-time) for every other campaign that has
ever served the same SKU. This sidesteps the current-assignment blocker
by using all-time historical performance as the overlap signal instead
of a live-eligibility feed — documented as a limitation in the page's
status note, not hidden.

## Formula change from the original brief
The original 600-line brief explicitly banned the reversed formula
`((Baseline/Inflated)-1)*100`, calling it "misleading negative inflation."
The user's follow-up message explicitly specified this exact reversed
formula in the same session. **Followed the user's explicit, most-recent
instruction** — this is documented plainly in the page's own legend and
status note so nobody mistakes it for the earlier (opposite) formula.

## Data pipeline
1. Reused Requirement 2's SKU list (831 products in Thasitha's 2
   campaigns) and its `merchant_products` title/image/link lookup.
2. New query: for each of those SKUs, `SUM` cost/clicks/conversions/
   conversion_value grouped by `(product_item_id, campaign_id)` across
   the *entire* `product_performance` table (not scoped to Thasitha's
   campaigns) — found 1,999 rows across 571 distinct SKUs and 48 distinct
   campaigns.
3. Kept only SKUs with 2+ distinct campaigns (overlap definition) — 328
   qualifying SKUs.
4. Campaign 1 = Thasitha's own campaign for that SKU (higher-cost one if
   in both). Campaign 2/3/+more = every other campaign sorted by cost
   descending.
5. Baseline CPC = Campaign 1's aggregate CPC (cost/clicks). Inflated CPC
   = combined aggregate CPC of Campaign 2+ (SUM cost / SUM clicks across
   all of them together, not per-campaign).
6. Est. CPC Inflation = ((Baseline/Inflated)-1)*100, rounded to 2dp.
7. Risk buckets: CRITICAL ≥30%, HIGH 15-30%, MODERATE 5-15%, LOW 0-5%,
   negative → CPC DEFLATION, missing/zero CPC on either side → DATA
   CHECK REQUIRED.
8. Best campaign / Action: highest lifetime Conversion Value among all
   campaigns for that SKU, tie-broken by ROAS then conversions then
   lower cost — matches the original brief's hierarchy (this part of the
   original brief was not superseded). Insufficient evidence (zero
   conversion value and ≤1 conversion for the leader) → "BUSINESS REVIEW
   REQUIRED" instead of fabricating a winner.

## Results
- 328 overlapping SKUs, 238 with resolved product titles (73%, same
  known merchant_products match-rate gap as Requirement 2).
- Risk distribution: 68 CRITICAL, 10 HIGH, 7 MODERATE, 3 LOW, 58 CPC
  DEFLATION, 182 DATA CHECK REQUIRED (mostly zero-click campaigns on one
  side of the comparison).

## Advisory safety
Page is read-only/advisory. No campaign, listing group, bid, or budget
changes were made or automated. Disclaimer included verbatim on the
page: "Recommendations are based on available product-level lifetime
performance and require PPC review before campaign changes."

## Files modified
- `reports/digital-marketing-member-pages/pages/thasitha.html` (Tab 3
  added; Requirement 1 and 2 tabs untouched — verified via HTML div-depth
  balance check and JS syntax check, both pass).

## Known limitations (documented on-page, not hidden)
- Overlap is all-time/any-status, not a live current-eligibility feed
  (no such source exists for PMax in this database).
- Inflated CPC is a combined aggregate across all "other" campaigns, not
  a per-competing-campaign breakdown (available in the row's expandable
  detail panel instead).
- CPC inflation formula is the reversed form the user explicitly
  requested this turn, differing from the original brief's specified
  formula — flagged in the page legend so it's not confused with a
  different methodology.

## Owner
Kuberan (AIOS) / Claude Code session.

## Status
BUILT. Not deployed, not pushed — pending separate explicit approval, same as Requirements 1 and 2.
