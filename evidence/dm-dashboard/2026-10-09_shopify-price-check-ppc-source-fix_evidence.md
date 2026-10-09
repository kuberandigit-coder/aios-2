# Evidence — Shopify Price Check: PPC Source Found, Fee Factor/Final Price Now Compute

**Date:** 2026-10-09 · **Requested by:** Kuberan · **Follow-up to:** `2026-10-09_shopify-price-check-page_evidence.md`

## Correction to the earlier finding

The earlier evidence doc and the page's own UI stated "no category-wise PPC-rate table exists in either
business database." **That was wrong — an initial search missed it.** A re-diagnosis (this task) found it.

## Phase 1–3: Root cause trace

1. **Balance Price (PC) blanks:** the original query aggregated `max(recommended_price)` across all 4 brand
   channels (`dcvoltage`, `electricalsone`, `ledsone`, `vintageinterior`) per SKU via `GROUP BY sku`. This was
   not the bug for blanks (732/1,808 always had a value) but it did mean the reported category/price could
   come from a *different* channel than the one PPC would later be matched against — a latent correctness bug,
   fixed by switching to one consistent channel (`channel='ledsone'`, the primary store) for Balance Price,
   category, and PPC lookups together.
2. **PPC % = N/A, Fee Factor/Final Price = dashes:** root cause was genuinely "no PPC source" **in the first
   pass** — but a second, more targeted search (`information_schema.columns` for `column_name ILIKE '%ppc%'`
   across business DB 2, not just DB 1) found:
   - **`blos.account_ppc_settings`** (business DB 2) — 1,485 rows total, 310 for `platform='shopify-uk'`,
     columns `account_name`, `product_category`, `ppc_general_pct`, `updated_by`, `updated_at`. Confirmed real:
     `updated_by='admin'`, most recent `updated_at` 2026-10-06. **Not historical Google Ads spend** — a
     maintained settings table.
   - Rate format confirmed: whole-number percentages (`24.3` = 24.3%, not `0.243`) — divided by 100 in code.
   - A second, coarser table, `blos.shopify_expense_rules` (7 rows), has 3 general `"PPC percentage for
     <account>"` rows (25% for ledsone, 16% for electricalsone, 25% for DCVoltage) — not category-specific, not
     used (the category-level table is more precise and covers the same accounts).

## Phase 2: Balance Price matching — verified counts

| Metric | Count |
|---|---|
| Total SKUs (channel=ledsone, platform=shopify, site=UK) | 1,808 |
| SKUs with a Balance Price (`recommended_price`) | 732 |
| Matched to a real Shopify UK listing (business DB 1) | 1,557 of 1,808 total |
| Duplicate/ambiguous keys | **0** — confirmed clean per `(sku, channel)`; the original "4 rows per SKU" is
  the 4-channel structure, not a data error |

## Phase 3: PPC source — verified counts

| Metric | Count |
|---|---|
| Categories with a rate (`account_ppc_settings`, platform=shopify-uk, account=ledsone) | 78 |
| Balance-priced SKUs (732) whose collection matches a rated category | **426** |
| Rate value range found | min 0.243 (24.3%), max 0.243 (24.3%) — **every rated category for `ledsone` currently
  has the identical rate**; this is a real characteristic of the data as stored, not a bug in the matching
  logic |

## Phase 4: Fee Factor / Final Price — now computing for real

Live run against real data (both business DBs):

```
totalRecordsChecked: 1808
skusWithValidBalancePrice: 732
shopifyListingsMatched: 1557
missingBalancePrice: 1076
missingRequiredInputs: 1438   (was 1808 before this fix)
invalidFeeFactor: 0           (no PPC rate found high enough to push Fee Factor <= 0)
skusWithPpcRate: 677
skusWithFeeFactor: 433
skusWithFinalPrice: 433
lowCount: 326
highCount: 44
okCount: 0                    (still correct -- no approved OK tolerance exists)
ppcSourceAvailable: true
```

Manually verified one real row (`CBFF200BM`): Balance Price £2.49, PPC 24.3%, Fee Factor
`1 − 0.20 − 0.015 − 0.243 = 0.542`, Final Price `(2.49 + 0.25) / 0.542 = £5.06` — current price £4.59, diff
`4.59 − 5.06 = −£0.47`, status `LOW`. Matches the system's own computed output exactly.

## Phase 5: UI validation

- PPC column now shows a real percentage where matched, or a specific reason (`"Category-wise PPC % not
  available for this SKU's collection"` vs `"...SKU has no collection to match against"`) where not — never an
  unexplained N/A.
- Step 3/4/5 workflow indicators now reflect real computed counts (`ppcSourceAvailable`, `skusWithFeeFactor`,
  `skusWithFinalPrice`) instead of a proxy that didn't match reality.
- New KPI cards: "SKUs With PPC Rate", "Final Price Calculated".
- Summary counts cross-checked against the displayed/filtered dataset (LOW filter returned exactly 326,
  matching `summary.lowCount`).

## Remaining blockers (honest)

- **266 of 732 balance-priced SKUs** still have no PPC match (no rated category, or no category at all) —
  correctly left as `MISSING_INPUT`, not defaulted.
- **OK status still never assigned** — no approved tolerance exists; this is unchanged from the original build.
- **All 78 rated categories currently share one identical rate (24.3%)** for the `ledsone` account — worth
  flagging to whoever owns `blos.account_ppc_settings`, since it means "category-wise" isn't yet differentiating
  by category in practice, even though the mechanism correctly supports it.
- Only the `ledsone` channel is used for Balance Price/PPC in this page; `dcvoltage`, `electricalsone`,
  `vintageinterior` channel data in the same table is not reflected here — a deliberate, documented scope choice
  (see `engine.py`'s `PRIMARY_CHANNEL` comment), not an oversight, but worth confirming is the right scope.

## Files changed

`backend/app/dev_tasks/shopify_price_check/engine.py` (PPC lookup added, channel-scoped Balance Price query),
`frontend/src/admin/pages/dev-tasks/ShopifyPriceCheck.jsx` (UI text, KPI cards, step-indicator logic updated to
match).

## Tests executed

Direct function calls against both live business databases (not mocked): `fetch_ppc_rates()`, `build_records()`,
`summarize()`, `get_results()` with status/PPC filters, manual arithmetic verification of one real row. No
automated test suite exists for this page (consistent with the rest of the dev-tasks folder — none exists for
any of them). `npx vite build` succeeded.

## Status

**Fixed and live-verified locally.** Not yet deployed to the production server at time of writing — same
deploy flow as before (merge `dev-work` → `main`, then the GitHub Actions auto-deploy, confirmed newly set up
this session).
