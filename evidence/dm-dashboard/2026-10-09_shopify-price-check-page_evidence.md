# Evidence — Shopify Price Check Page (Final Price vs Current Shopify Price)

**Date:** 2026-10-09 · **Requested by:** Kuberan · **Project:** DM Dashboard (common dev task, not owned by any individual staff member)

## What was built

A new Development Task page: **"Shopify Price Check — Final Price vs Current Shopify Price"**, registered
alongside the existing 15 dev tasks (Content Gap Analysis, GEO Visibility, Meta Audit, etc.), using the exact
same conventions discovered by reading the real repo first (not assumed):

- Nav/routing: `frontend/src/devTasksRegistry.js` (shared sidebar list for both Dev and Admin layouts) and
  `frontend/src/taskRegistry.js` (User Access Management's grantable-tools list) — one new entry added to each,
  matching every existing dev task's exact shape.
- Dev badge: reused the existing `.jreq-dev-badge` CSS class and `Dev: <b>Kuberan</b>` markup verbatim from
  `GeoVisibility.jsx` — no new badge component created.
- Backend auth: reused `core/task_auth.py`'s `make_task_auth("tools.DevShopifyPriceCheck")` /
  `require_any_login` — the same shared factory every other dev task uses, not a new permission system.
- Page styling: reused existing `jreq-*` CSS classes (cards, pills, tablebox, pagination, select, summarybox) —
  no new CSS added.

## Business Database 2 — verified Balance Price source

Table: `blos.listing_channel_price_v1` (database `order_management_copy`), filtered `platform='shopify' AND
site='UK'`. Verified by live query (not assumed):

- Exact column confirmed: `recommended_price` (the "Balance Price" / calculated output; `must_reach_gbp` is a
  separate floor value, not the same thing).
- **732 of 1,808** distinct Shopify UK SKUs in that table have `recommended_price` populated (confirmed count,
  matches the user's "700+ SKUs" claim).
- Cross-checked against business DB 1 (`listings.shopify_listings`, site=UK): **1,557 of 1,808** SKUs match a
  real listing; of the 732 balance-price SKUs specifically, **551** match and have a current price.
- No duplicate-key issue: the table's apparent "4 rows per SKU" is structural (4 brand channels — dcvoltage,
  electricalsone, ledsone, vintageinterior), not a data error. This task reports at SKU level and takes
  `max(recommended_price)` per SKU as a documented, non-invented choice (see `engine.py` docstring).
- Used as-is, never recalculated or overwritten — `engine.py` reads it, does not write to it.

## Fee Inputs — confirmed, not invented

- No category-wise PPC-rate table exists anywhere in either business database (confirmed by direct schema +
  column-name search across both DBs, 2026-10-09). The page never defaults this to 0% — every record is
  explicitly flagged `MISSING_INPUT` with the reason stated, both in the UI and the CSV export.
- No payment-fee-rule table exists in either business database. VAT (20% UK) and the Shopify fee (1.5% + £0.25,
  Advanced plan, online standard cards) are fixed constants, shown with their source in the UI's Step 3 panel.
- No approved OK-tolerance setting exists anywhere in the codebase (checked: no config file, no env var, no
  settings table). The OK status is therefore **never assigned** by this build — confirmed in `engine.py` and
  live-tested (0 OK rows in the real run below).

## Verified end-to-end (real data, not mocked)

Ran the full pipeline directly against both live business databases (no HTTP mocking):

```
records: 1808
summary: {totalRecordsChecked: 1808, skusWithValidBalancePrice: 732,
shopifyListingsMatched: 1557, missingBalancePrice: 1076,
missingRequiredInputs: 1808, invalidFeeFactor: 0, lowCount: 0,
highCount: 0, okCount: 0, businessDatabase2Available: true}
```

`missingRequiredInputs = 1808` (100%) is correct and expected: since no verified PPC source exists, every
record is flagged `MISSING_INPUT` for PPC and no SKU currently reaches a calculated Final Price. This is the
honest, confirmed state of the data — not a bug.

CSV export verified: 1,808 real data rows, correct 18-column header, no secrets, no fabricated rows (327,986
bytes, spot-checked first row).

`npx vite build` succeeded; the new page compiled into its own lazy chunk (`ShopifyPriceCheck-*.js`), confirming
no syntax/import errors.

## Files created

- `backend/app/dev_tasks/shopify_price_check/__init__.py`
- `backend/app/dev_tasks/shopify_price_check/schema.py`
- `backend/app/dev_tasks/shopify_price_check/engine.py`
- `backend/app/dev_tasks/shopify_price_check/router.py`
- `frontend/src/admin/pages/dev-tasks/ShopifyPriceCheck.jsx`

## Files modified

- `backend/app/core/db.py` — added `BUSINESS_DATABASE_2_URL` pool (`get_business2_conn()`,
  `business2_available()`), optional (app still boots if unset), separate from the existing required
  `BUSINESS_DATABASE_URL` pool.
- `backend/app/dev_tasks/__init__.py` — registered the new router + schema-init call, same 2-line pattern as
  every other dev task.
- `frontend/src/devTasksRegistry.js`, `frontend/src/taskRegistry.js` — one new entry each.
- `.env` (not committed, no value exposed here) — `BUSINESS_DATABASE_2_URL` was added by Kuberan directly.

## Status

**Backend: complete and live-verified against real data in both business databases.**
**Frontend: complete and build-verified; not yet clicked through in a running browser session this pass** (dev
server click-through, User Access Management grant UI verification, and Jest/automated test run are open items
— see closure doc for the honest list of what remains unverified).
