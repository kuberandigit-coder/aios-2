# Closure — Sales 2026 UK: Shopify Actuals tab bug chain

Date: 2026-09-22
Owner: Piranav (original feature), fixes by dm-dashboard dev tooling
Reviewer: Kuberan
Repo: dm-dashboard (this chain crossed both `main` and `dev-work` — see
handover.md for the standing-rule note)

## Status: COMPLETE

A 5-bug chain (frontend never polled a slow backend job; a stale
pre-rewrite cache; a hard-timeout fix that itself deadlocked; a missing
`read_reports` Shopify scope; a wrong ShopifyQL column name) was fully
root-caused, fixed one layer at a time, deployed, and **confirmed live
in production** — 9 months of real 2026 GBP sales data returning
correctly in ~1 second.

## What was built/fixed

1. Frontend polling loop for the BackgroundJob "computing" state.
2. A hard 45s timeout on the ShopifyQL call, fixed after its own first
   version deadlocked (`shutdown(wait=True)` -> `shutdown(wait=False)`).
3. Corrected ShopifyQL column name (`sales_reversals` -> `returns`),
   verified by testing every column individually against the real live
   API.
4. (Access, not code) `read_reports` scope granted by the user.

## Key files

`frontend/src/admin/pages/Sales2026.jsx`, `backend/app/sales.py`

## Commits

`6ce8b8e`, `f08b1c5`, `477a977` — all deployed, confirmed live.

## Known limitations

None remaining for this tab.
