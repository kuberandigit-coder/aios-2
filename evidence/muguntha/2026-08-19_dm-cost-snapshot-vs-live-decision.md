## Purpose
Document why Sonya's January 2025 "Ads Cost" figure changed after today's snapshot sync fix (see [[2026-08-19_snapshot-sync-root-cause-fix]]), and the decision made about it.

## What happened
Before today's snapshot sync fix, `api/data/muguntha-sonya-2025-01.json` was completely missing from the deployed Staff-requirements worktree, so every request fell through to a **live** Google Ads query. That live query — using Sonya's *current* owned-product-ID list — computed DM 46 campaign cost of £559.91 (Total Cost £982.14).

After syncing the snapshot file from aios-2 (generated 2026-08-04), the same month now correctly serves from that snapshot: DM cost £269.86 (Total Cost £692.09). Own cost (£422.23) is unaffected — only the DM 46 product-attributed portion differs.

## Root cause of the discrepancy
DM 46 campaign cost is attributed to Sonya by matching Google Ads product-performance rows against her owned-product-ID list (`SONYA_PRODUCT_IDS_UK`). That list has evidently changed (products reassigned/added to her portfolio) between 2026-08-04 (when the snapshot was generated) and today — so a live query now pulls in a different set of matching products than the snapshot captured.

## Decision (Kuberan, 2026-08-19) — REVISED, see below
Initial decision: keep the snapshot as the historical record for closed months, matching the invariant used elsewhere on this dashboard (closed months don't change retroactively).

**Superseded same day**, once Kuberan noticed the same product-ownership-list change that fixed Sales (2026-08-07 commit `c8e9f2210`, "sales25.js: Sonya/Sajeepan 2025 Sales was missing DM 46 product-owned orders") had NOT been applied to the DM Cost snapshots — meaning Sales and Cost for the same month were computed against two different product lists. That's an internal inconsistency, not a legitimate "frozen historical record" — so Kuberan asked to regenerate DM Cost to match.

## Fix
Wrote a one-off script (`regen-muguntha-snapshots.js`, run then discarded — not committed to the repo) that called `/api/muguntha?employee={member}&month={month}&refresh=1` live for Sonya and Sajeepan across 2025-01 through 2026-07 (19 months each, 38 total), and overwrote each `muguntha-{member}-{month}.json` snapshot with the fresh response.

Result: 16 of Sonya's 19 months had a materially different (roughly 2-3x higher) DM cost after regeneration — e.g. January 2025: £269.86 → £559.91. Sajeepan's months and Sonya's most recent 2026 months (May-July) were unchanged, meaning those snapshots already reflected the current product list.

## Evidence
- Live-verified after regeneration + deploy: `/api/muguntha?employee=sonya&month=2025-01` returns `dmProductCost: 559.91`, `totalCost: 982.14`, `cacheStatus: static-snapshot` — matching the live-query figure from before the original snapshot-sync fix, now correctly frozen as the new snapshot.
- Committed and pushed to both repos: Staff-requirements (commit 8dd49cf), aios-2 (commit 1e37a99).
- Deployed to production, verified live.

## Status
PASS — Sales and DM Cost now use the same (current, corrected) product-ownership list for every regenerated month.

## Reviewer
Kuberan
