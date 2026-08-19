## Purpose
Document why Sonya's January 2025 "Ads Cost" figure changed after today's snapshot sync fix (see [[2026-08-19_snapshot-sync-root-cause-fix]]), and the decision made about it.

## What happened
Before today's snapshot sync fix, `api/data/muguntha-sonya-2025-01.json` was completely missing from the deployed Staff-requirements worktree, so every request fell through to a **live** Google Ads query. That live query — using Sonya's *current* owned-product-ID list — computed DM 46 campaign cost of £559.91 (Total Cost £982.14).

After syncing the snapshot file from aios-2 (generated 2026-08-04), the same month now correctly serves from that snapshot: DM cost £269.86 (Total Cost £692.09). Own cost (£422.23) is unaffected — only the DM 46 product-attributed portion differs.

## Root cause of the discrepancy
DM 46 campaign cost is attributed to Sonya by matching Google Ads product-performance rows against her owned-product-ID list (`SONYA_PRODUCT_IDS_UK`). That list has evidently changed (products reassigned/added to her portfolio) between 2026-08-04 (when the snapshot was generated) and today — so a live query now pulls in a different set of matching products than the snapshot captured.

## Decision (Kuberan, 2026-08-19)
Keep the snapshot as the historical record for closed months — do NOT regenerate/recalculate historical DM-cost snapshots against current ownership rules. This matches the existing invariant used everywhere else on this dashboard: once a month is closed and snapshotted, its figures don't change retroactively just because attribution rules evolve later.

## Status
No code change required — this is already the correct/intended behavior following today's snapshot sync fix. Documented so a future session doesn't mistake this for a bug.

## Reviewer
Kuberan
