---
title: Kamsi Sales Tables — Restrict to Confirmed Organic-Sales Definition
requirement_id: SUK-KAMSI-SALES-2
type: evidence
date: 2026-07-17
---

# Title
Kamsi Sales Tables — Restrict to Confirmed Organic-Sales Definition

# Purpose
The two detail tables on the Kamsi tab of `sales.html` ("channel breakdown"
and the per-order/line-item table) previously showed **every** traffic
channel a Kamsi order could arrive through, including Google Ads / Paid
Search, Social, Email, Affiliate, and non-AI "Other" — channels the user
never asked to see on this dashboard. The top summary cards
("Total Kamsi Orders" etc.) were already correctly restricted to the
6-group `combinedSummary` definition; the two detail tables were not.

# Business Question
User confirmed in chat (2026-07-17): the correct definition for what
counts as Kamsi's organic sales is exactly the 6 groups already used to
build `combinedSummary` server-side — **Fully Organic, First-Session
Organic, Direct, Referral, No Journey Data, and AI Tools** — and asked
that both detail tables show only orders/line items belonging to these
6 groups, nothing else.

# Change Made
`reports/digital-marketing-member-pages/pages/sales.html`:
- Added client-side `kGroupOf(order)` — classifies each order into one of
  the 6 approved groups (using the same rules as the server's
  `combinedSummary` construction in `api/sales-kamsi.js`: `journeyStatus
  === 'FULLY_ORGANIC'` / `'FIRST_SESSION_ORGANIC'`, or `channel === 'Direct'
  / 'Referral' / 'No Journey Data' (+ Unknown/Attribution Pending
  variants)`, or `channel === 'Other'` with an AI-tool source match) — or
  returns `null` (excluded) for Google Ads/Paid Search, Social, Email,
  Affiliate, and non-AI Other.
- `kcFlatRows()` now filters out any order where `kGroupOf()` returns
  `null` before building the line-item table.
- Replaced the old `channelBreakdown` (server-provided, all 8 raw
  channels) rendering with a new client-side `kcGroupBreakdown()` that
  aggregates only the 6 approved groups directly from the already-filtered
  `allKamsiOrders` list — guarantees the two tables and the top summary
  cards are always internally consistent (same source rows, same
  filtering logic).
- Both tables' "Channel" column/label renamed to "Group" and now display
  the group name (e.g. "Fully Organic") instead of the raw Shopify-derived
  channel, since "Organic Search" previously conflated Fully Organic and
  First-Session Organic into one row.
- CSV export column renamed `Channel` → `Group`, filename changed from
  `..._kamsi-all-channels-sales-...csv` to `..._kamsi-organic-sales-...csv`.
- Explanatory sub-text above the channel-breakdown table updated to state
  the 6 included groups and the 4 excluded channels explicitly.

# Verification
`kcGroupBreakdown()` sums `item.quantity` / `item.grossSales` /
`item.discounts` / `item.refunds` per group from the same `matchedItems`
arrays the server used to compute `combinedSummary`, `fullyOrganicSummary`,
`directSummary`, `referralSummary`, `noJourneySummary`, and
`chatgptSummary` — so the new table's per-group totals are expected to
reconcile exactly with those existing server-computed summary numbers
(spot-checked arithmetically against January's `combinedSummary.grossSales
= 7901.97`, which equals the sum of the 6 group summaries already
verified in this session's chat).

Not live-browser-tested in this session (no Chrome tool session open) —
recommend the user load `sales.html` → Kamsi tab → each month tab and
confirm the "Total Kamsi Orders" card, the group-breakdown table's summed
orders count, and the line-item table's distinct order count all agree,
before treating this as fully validated.

# Files Modified
`reports/digital-marketing-member-pages/pages/sales.html`

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Code change complete, pending live-browser verification and user
confirmation before deploy/push.
