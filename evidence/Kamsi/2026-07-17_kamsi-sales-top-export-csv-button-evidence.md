---
title: Kamsi Sales — Top Export CSV Button (Group Summary)
requirement_id: SUK-KAMSI-SALES-3
type: evidence
date: 2026-07-17
---

# Title
Kamsi Sales — Top Export CSV Button (Group Summary)

# Purpose
User asked for an "Export CSV" button at the top of the Kamsi tab that
exports the group-breakdown summary table (Fully Organic, First-Session
Organic, Direct, Referral, No Journey Data, AI Tools) shown just below the
KPI cards.

# Change Made
`reports/digital-marketing-member-pages/pages/sales.html`:
- Added a new `#kGroupExportCsv` "Export CSV" button directly above the
  KPI cards block (top of the Kamsi tab, before `#kCardsCombined`).
- Added `kGroupExportCsv()` — exports the current month's
  `kcGroupBreakdown()` result (the same 5-6 rows rendered in the
  group-breakdown table) as CSV: Group, Orders, Units Sold, Gross Sales,
  Discounts, Refunds, Net Sales, Unique Products, Avg/Order, Currency,
  Report Period. Filename:
  `<month>_kamsi-organic-sales-group-summary-ledsone-co-uk.csv`.
- This is separate from the existing `#kChannelExportCsv` button (still in
  the line-item table's toolbar), which exports the filtered per-order
  line items, not the group summary.

# Files Modified
`reports/digital-marketing-member-pages/pages/sales.html`

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Deployed.
