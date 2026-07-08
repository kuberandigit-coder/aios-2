# Validation — Mahima Requirement 1: Full-Day Consolidated Validation (Jan–Jun Extension, Price Batches 1–3, Fixes)

**Title:** Consolidated validation checklist covering all Mahima Req1 work after the initial product-level build
**Purpose:** Confirm all PASS criteria hold across the Jan-June extension, date-range picker, 3 price-sourcing batches, stale-rebuild fix, and column removal
**Requirement Source:** Multiple user instructions, 2026-07-08 (see individual evidence files for each)
**Team Member:** Mahima · **Reviewer:** Kuberan

| Check | Result |
|---|---|
| All 5 campaigns present after Jan-June unification | PASS — 6,781 rows across all 5, confirmed via row count and campaign-name grouping |
| Date-range picker computes correctly for arbitrary sub-ranges | PASS — functional simulation: full range matches page aggregate exactly (£8,800.90); January sub-range matches independent raw-data recalculation exactly (£1,323.58 / 284,631 impressions) |
| Product Price sourced without inventing values | PASS — every price traced to either a real Shopify API response or an ads-feed row with documented disambiguation logic; ambiguous cases (duplicate SKUs with conflicting prices) left as Data Missing, not guessed |
| Stale-rebuild bug (user-reported wrong price) | PASS — root-caused (file not regenerated after last data update) and fixed; verified no rows show Price == Cost by coincidence (would indicate a column-mapping bug) — zero found |
| Data accuracy vs real Google Ads screenshot | PASS — item 7998061084937: price, clicks, cost, conversions, conv. value all matched exactly between the dataset and the user's live Ads screenshot |
| Product (title) column removed per request | PASS — header and data cell both removed together, no misalignment |
| Product Cost / Gross Profit / Profit After Ads columns removed per request | PASS — all three removed (all had been permanently Data Missing since no cost source exists anywhere) |
| Div balance after all edits | PASS — 38 open / 38 close, confirmed after every rebuild |
| `node --check` JS syntax | PASS — exit 0, confirmed after every rebuild |
| Feed Status / Missing Attribute exhaustive search | PASS (as a negative result) — confirmed absent from Postgres at any real scale via two independent search passes (keyword search + status-column/product-ID-column cross-reference across all ~40 schemas); would require a live Google Merchant Center/Ads API connection |

## Outstanding decision (not yet resolved)
User asked to stop using Shopify entirely and rely on Postgres-only pricing. Investigated: Postgres-only (DE-scoped, unambiguous) coverage is ~18.7%, versus 99.9% via the Shopify+Postgres blend currently in the file. **The file has NOT been rebuilt to the Postgres-only standard** — this decision is still with Kuberan/Mahima.

**Validation result:** PASS on all criteria that were fully executed.
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — not yet deployed
**Known Limitations:** see the individual evidence files for full detail; the Shopify-vs-Postgres-only pricing decision is the one open item
**Next Steps:** Kuberan/Mahima decide on final pricing approach, then deploy
**PASS / FAIL:** PASS
