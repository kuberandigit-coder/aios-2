# Capabilities — 2026-08-07

## Capability — Cost Dashboard: Confirmed-Source-Only Cost Attribution

**Date:** 2026-08-07
**Owner:** Kuberan
**Project:** digital-marketing-member-pages (`pages/cost.html`)
**Status:** Live, deployed, pending business-owner spot-check

### Capability

A business-facing cost dashboard that only shows a cost category when a real, confirmed data
source exists for it — explicitly marking any category with no real source as **N/A**, never
estimated or guessed, following a prior Phase 1 discovery/audit that determined which cost
categories actually have a traceable source in this system.

### Concrete cost-attribution rules established (reusable business rules)

- **VAT**: `salesuk.js`/`sales25.js` already computed per-order VAT internally but discarded it —
  exposed via `combinedSummary.vat` rather than recomputing it a second way.
- **Transaction Fee**: a genuine, previously-unused order-linked source —
  `accounting.shopify_transactions.fee` — summed per employee's exact attributed order set via
  `shopify_order_id`, scoped to the correct `sub_source`.
- **Product Cost**: an explicit, user-confirmed business rule — 20% of Gross Sales (before
  discounts/refunds) — computed client-side from existing Gross Sales figures, documented as a
  rule, not presented as a real cost-ledger figure.
- **CSS, Meta Ads Cost, Subscription Fee**: explicitly N/A — no source exists anywhere in this
  system for these, confirmed by the prior audit, never backfilled with a guess.

### A real bug found as a side effect of this work

While building this dashboard, found `sales25.js` (2025) was missing a product-ownership exclusion
rule that `salesuk.js` (2026) already had (added 2026-07-30) — every 2025 DM-campaign order
containing a Sonya/Sajeepan-owned product was being misattributed to the generic DM-Ad bucket
instead of routed to the correct owner. Fixed in `sales25.js`. Worth checking for this same class
of "parallel 2025/2026 codepaths silently drifting out of sync" issue in any future dual-year
feature on this project.

### Originating task

`evidence/sales/2026-08-07_cost-dashboard-launch.md`

### Reuse

The "only show a category with a confirmed source, mark everything else N/A explicitly" principle
is reusable for any future financial/reporting dashboard on this project — the alternative
(silently estimating a missing figure) is the specific failure mode this capability avoids.

### Limitations

The Product Cost rule (20% of Gross Sales) is a stated business rule, not a verified actual cost —
the task's own "Next step" explicitly asks whether a real cost source can ever be found to replace
it. This capability record does not resolve that; it documents the current, intentional
approximation.
