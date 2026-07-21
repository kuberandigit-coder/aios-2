---
title: Mahima Tab (Organic sub-tab) — sales.html
date: 2026-07-20
type: evidence
---

# Title
Mahima Tab — Organic Sub-Tab Added to LEDSone Sales Dashboard

# Purpose
Add a new "Mahima" staff tab to `reports/digital-marketing-member-pages/pages/sales.html`
with two planned sub-tabs (Organic, Ads). Organic is scoped to exactly the
Shopify Product IDs previously identified as `MAHIMA_EXCLUDED_PRODUCT_IDS`
in `sales-sukirtha-de-organic.js` (products excluded from Sukirtha's DE
organic sales because they belong to Mahima). Ads sub-tab is a placeholder
only, per explicit user instruction ("now mahima organic only").

# Business Question
Give Mahima her own organic-sales view for ledsone.de, scoped to the
products she owns — same channel-classification definition Kamsi/Dilaksi/
Sukirtha already use (Fully Organic, First-Session Organic, Direct,
Referral, No Journey Data, AI Tools).

# Requirement Source
User conversation, 2026-07-20: user asked to extract the Mahima product-ID
list (previously found excluded from Sukirtha's DE organic dashboard) and
build a new Mahima tab; confirmed store = ledsone.de only; confirmed scope
= Organic sub-tab only for now, Ads later.

# Implementation

**Attempt 1 (reverted):** built a standalone `api/sales-mahima-de-organic.js`
(inverse of `sales-sukirtha-de-organic.js` — includes instead of excludes
the Mahima product IDs). Deploy failed: Vercel Hobby plan caps Serverless
Functions at 12 per deployment; the project was already at 12, and the new
file made 13.

**Attempt 2 (shipped):** deleted the standalone file. Merged Mahima's logic
into the existing `api/sales-sukirtha-de-organic.js` via a `?staff=mahima`
query parameter:
- `buildSukirthaOrderRow(order, journey, staff)` now branches: `staff==='mahima'`
  keeps only line items whose product ID IS in `MAHIMA_EXCLUDED_PRODUCT_IDS`
  (inclusion), default/`sukirtha` keeps the existing exclusion behavior
  unchanged.
- Cache key and static-snapshot filename are now staff-prefixed
  (`mahima:2026-07` vs `sukirtha:2026-07`) so the two staff views never
  collide in the in-memory cache.
- Response payload's `staff`/`source.scope` text switches based on `staff`;
  both `allSukirthaOrders` and `allMahimaOrders` keys are populated with the
  same computed row array so the existing frontend JS (written expecting
  `allMahimaOrders`) works without further changes.
- No new serverless function created — function count stayed at 12.

**Frontend (`sales.html`):**
- New "Mahima" top-level reqtab next to Kamsi/Dilaksi/Sukirtha.
- `showStaffTab()` extended to handle `mahima`; lazy-loads via `mLoad(false)`
  only on first click (not eagerly on page load, unlike Kamsi).
- New `tabMahima` section: header, Organic/Ads sub-reqtabs
  (`showMahimaSub()`), Organic sub-tab has the full Kamsi-style layout
  (KPI cards, group-breakdown table, filterable/expandable line-item
  table, CSV export x2, footnotes). Ads sub-tab is a plain placeholder
  div ("Ads sub-tab — not built yet.").
- New M-prefixed JS block (`M_DATA`, `mLoad`, `mRenderAll`, `mGroupOf`,
  `mcFlatRows/mcFilteredRows/mcGroupBreakdown/mcRenderAll/mcRenderTable`,
  `mcExportCsv`, `mGroupExportCsv`) mirroring the Kamsi block exactly,
  fetching `/api/sales-sukirtha-de-organic?staff=mahima&month=...`.

# PostgreSQL Sources Checked
Not applicable — Shopify Admin GraphQL only, same as the Sukirtha DE
Organic dashboard this reuses.

# Shopify Sources Checked
Live Shopify Admin GraphQL API, store `ledsone-de.myshopify.com`, via the
existing `SHOPIFY_ADMIN_TOKEN` env var (no new credential).

# Files Modified
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de-organic.js`
  (added `staff` param support; both Sukirtha and Mahima views now served
  from this one function)
- `reports/digital-marketing-member-pages/pages/sales.html` (new Mahima
  tab + Organic sub-tab UI and JS)
- `reports/digital-marketing-member-pages/api/sales-mahima-de-organic.js`
  created then deleted (Hobby-plan function-limit workaround)

# Validation Result
- `node -c` on the modified API file: syntax OK.
- Full `<script>` block extracted from `sales.html` and run through
  `new Function(...)`: no syntax errors.
- Deployed to Vercel production
  (`https://digital-marketing-member-pages.vercel.app`) — confirmed via
  `curl`:
  - `?staff=mahima&month=2026-06` → `success:true`, `staff.name:"Mahima"`,
    `combinedSummary.ordersCount:54`, `allMahimaOrders.length:54`.
  - default (no `staff` param, Sukirtha) `month=2026-06` →
    `success:true`, `staff.name:"Sukirtha"`, `combinedSummary.ordersCount:91`
    — confirms merging the two views into one function did not change
    Sukirtha's existing numbers.
  - Live page HTML confirmed to contain the new Mahima tab button and the
    `staff=mahima` fetch URL.
- Function count re-checked after the merge: 12 (back under the Hobby
  plan's 12-function cap).

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production. Git commit/push pending per
[[feedback_deploy_before_git_push]] (deploy+verify live first, then
commit/push) and CLAUDE.md's default git workflow.

# PASS / FAIL
PASS

# Next Step
- User to review the Mahima → Organic sub-tab live.
- Ads sub-tab definition and data source still need to be specified by the
  user before it can be built (placeholder only for now).
- Git commit + push, pending user confirmation.
