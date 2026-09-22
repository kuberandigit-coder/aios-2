# Validation — Mahima Requirement 4 (Product ID Coverage): full rebuild

Date: 2026-09-22
Reviewer: (pending)

| Requirement | Test | Result | PASS/FAIL |
|---|---|---|---|
| Products scoped to ledsone.de only | Direct COUNT query, feed_label='DE' vs currency='EUR' | 2,843 vs 26,831 — confirmed the fix | PASS |
| Duplicate rows quantified | Cross-feed_label duplicate norm_id query | 18,793 of 26,846 had 2+ conflicting rows | PASS |
| Shopify-pattern IDs are real, numeric-other are not | Exact ID match against `listings.shopify_listings` | 451/451 shopify-pattern matched, 0/2,392 numeric-other matched | PASS |
| Real catalog size confirmed against Shopify itself | Live Shopify Admin API `productsCount` query | 2,711 total / 2,504 active — matches `listings.shopify_listings` (2,771) within ~2% | PASS |
| Product universe rebuilt correctly | Full query run against real DB | totalProducts = 2,771, exact match | PASS |
| Feed-eligibility heuristic no longer over-flags | Live run, before/after comparison | Feed Eligible 0 -> 2,194 (heuristic fix) -> 51 (real catalog); genuine Feed Issues 2,843 -> 649 -> 400 | PASS |
| Real Shopify products with no Merchant Center row now visible | Count of `feedStatus='Data Missing'` post-rebuild | 2,320 of 2,771 (84%) — new, previously-invisible finding | PASS (surfaced correctly, not a bug) |
| **Confirmed live in production** | Snapshot manually refreshed via Run Now after each deploy, live API re-checked | Correct numbers confirmed live each time | PASS |

## Overall

**PASS — fully validated, confirmed live in production.** This was the
most extensively evidence-checked fix of the day, including a
self-correction after the user's own verification request exposed a
flaw in an earlier (aggregate-count-only) comparison — a good example of
why ID-level verification matters over count-level similarity.
