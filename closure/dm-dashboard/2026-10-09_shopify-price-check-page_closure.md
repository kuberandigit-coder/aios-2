# Closure — Shopify Price Check Page

**Date:** 2026-10-09 · **Evidence:** `evidence/dm-dashboard/2026-10-09_shopify-price-check-page_evidence.md`

## Completed

- Page built, registered under Development Task nav (both Dev and Admin layouts), Dev Kuberan badge applied,
  no individual staff member named anywhere in title/route/UI.
- Business Database 2 Balance Price source verified column-by-column and row-count-verified (732/1,808 SKUs,
  matches the user's reported figure).
- Backend engine verified end-to-end against real data (not mocked) — see evidence doc for exact output.
- CSV export verified real, correct columns, no secrets.
- Frontend build verified (`npx vite build` succeeded, page bundles into its own chunk).
- User Access Management: no new code needed — `tools.DevShopifyPriceCheck` added to
  `frontend/src/taskRegistry.js`'s `TOOLS` list, which `UserAccessManagement.jsx` already renders generically
  for every entry (confirmed by reading that file — it maps over `TASKS`/`TOOLS`, no per-tool registration
  code). Backend access is enforced the same generic way via `make_task_auth`, confirmed by reading
  `core/task_auth.py` and matching its exact usage pattern from `geo_visibility/router.py`.

## Partially completed / honestly unverified

- **Did not click through the page in a running browser session.** The Vite build succeeding confirms no
  syntax/import errors, not that every filter/button/modal behaves correctly on screen. Recommend a quick
  manual pass before calling this production-ready.
- **Did not run an automated test suite** — none exists for dev-task pages in this repo (checked: no
  `*.test.jsx` / pytest files reference other dev tasks either), so there was nothing to "run and report
  actual results" against. This is consistent with the rest of the dev-tasks folder, not a gap specific to
  this task.
- **Did not verify the User Access Management grant flow by actually logging in as a non-admin staff member**
  and confirming the page is hidden/shown correctly — only confirmed the registration code path is identical
  to every other working dev task.

## UPDATE 2026-10-09 (same day) — PPC source found, corrects the section below

The "no PPC source exists" finding below was **wrong** — an initial search missed it. A follow-up diagnosis
found `blos.account_ppc_settings` (business DB 2), a real category-wise PPC rate table. Fee Factor and Final
Price now compute for 433 of 732 balance-priced SKUs. Full details:
`evidence/dm-dashboard/2026-10-09_shopify-price-check-ppc-source-fix_evidence.md`.

~~## Known, permanent data gap (not a bug — confirmed absent from both business databases)~~ **— superseded,
see update above.**

~~- No category-wise PPC rate source exists. Every record is flagged MISSING_INPUT for this; 0 SKUs can reach
  a calculated Final Price until someone supplies/confirms a PPC-rate source.~~ **PPC source found —
  `blos.account_ppc_settings`. 426/732 balance-priced SKUs now match a rate.**
- **No approved OK-tolerance setting exists.** Still true — OK status is never assigned by this build. If/when
  a tolerance is approved, it goes in `backend/app/dev_tasks/shopify_price_check/engine.py`'s
  `APPROVED_OK_TOLERANCE_PCT` constant.
- **New gap found during the fix:** 266 of 732 balance-priced SKUs still have no PPC match (uncategorized, or
  their category isn't one of the 78 rated ones) — correctly left `MISSING_INPUT`, not defaulted.
- **New observation:** all 78 rated categories for the `ledsone` account currently share the identical rate
  (24.3%) — worth confirming with whoever owns `blos.account_ppc_settings` whether that's expected.

## Staff handover prompt

"The Shopify Price Check dev-task page is live under Development Tasks. It reads Balance Price AND category-wise
PPC from Business Database 2 (`blos.listing_channel_price_v1` + `blos.account_ppc_settings`), and current price
from Business Database 1. **Final Price now computes for 433 SKUs** (confirmed live). Remaining gap: 266
balance-priced SKUs have no PPC-rated category yet, and no approved OK-tolerance exists so OK status is never
shown — both are data-source gaps, not bugs. Click 'Run Report' (now a background job, won't 502) to refresh."

## Status

**Backend: done, live-verified, including the PPC fix.** **Frontend: built and build-verified.** **Data: PPC
source found and wired in; OK-tolerance still the one real remaining blocker, surfaced clearly in the UI.**
