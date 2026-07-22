---
title: Theekshy Google Ads Tab — New UK Staff Member Added
date: 2026-07-22
type: evidence
---

# Title
Sales Dashboard (`reports/digital-marketing-member-pages/pages/sales.html`) — added a new live tab for Theekshy, a UK Google Ads team member who joined in March 2026, matching orders by exact `utm_term = theekshy`, covering March–June (historical) + July (live).

# Purpose
User requested a new staff tab for Theekshy, distinct from Sajeepan (both UK Ads team), using a different attribution rule (exact `utm_term` match, not campaign-name match).

# Business Question
Which Shopify orders on `ledsone.co.uk` belong to Theekshy's Google Ads campaigns, and can staff/the user see her sales on the same live dashboard as the other Ads team members?

# Requirement Source
Live user instructions:
1. "create a new tab for theeksy , she is also uk ads team and her utm term is THEEKSHY , find theekshy sales she join on march so start from march month tab to June and July live" — full requirement: new tab, UK store, `utm_term=THEEKSHY` exact match, month range March–June + July live (no January/February, since she joined in March).
2. "save aios" — this documentation.

# Sources Checked
- Shopify Admin GraphQL API, store `ledsone.co.uk` (`ledsone.myshopify.com`), via the deployed `/api/sales-sukirtha-de?staff=theekshy-ads` endpoint (reuses the `SHOPIFY_UK_ADMIN_TOKEN` Vercel server-side env var already set up for Sajeepan).

# Implementation

## API — `api/sales-sukirtha-de.js`
- Added `theekshy-ads` to the `staff` parameter resolution, the `isUkStaff` check (now `sajeepan-ads` OR `theekshy-ads`), and the snapshot-name mapping (`theekshy-uk-ads`).
- Added a new `staff === 'theekshy-ads'` handler block, structurally identical to Thasitha's (single-term `Set` match, not Sajeepan's campaign-name match, per this specific requirement: "her utm term is THEEKSHY"): an order matches if its first-session `utm_term` exactly equals `theekshy` (case-insensitive).
- `staff.department` set to "Google Ads (Paid Search)", `store: 'ledsone.co.uk'`, timezone `Europe/London` — same as Sajeepan.

## New Theekshy tab — `pages/sales.html`
Added a full tab mirroring the Thasitha/Sajeepan pattern, with distinct `tk`-prefixed globals/functions (`TK_DATA`, `tkLoad`, `tkSelectMonth`, `tkRenderAll`, `tkcRenderTable`, `tkGroupExportCsv`, etc.) to avoid any collision with existing tabs.
- Tab button placed immediately after Sajeepan's in the top nav.
- **Month tabs: March–June (historical) + July (live) only** — no January/February tabs, since she joined the team in March 2026. This differs from every other UK/DE staff tab, which all start January.
- Cards, campaign summary table (grouped by `utm_term`, same as Thasitha), full line-item table with session-detail expand rows, filters, and CSV export — same structure as the other Ads tabs.
- Footnote explicitly documents the March join date and the `utm_term=theekshy` matching rule.

## Reusable snapshot tool updated
Added `'theekshy-ads': 'theekshy-uk-ads'` to `scripts/generate-snapshots.js`'s `SNAPSHOT_NAME_BY_STAFF` map (the permanent snapshot-generation tool built earlier today for Sajeepan) so her historical months can be snapshotted the same way once needed.

# Files Modified
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de.js` — `theekshy-ads` staff resolution, `isUkStaff` check, snapshot-name mapping, and new handler block.
- `reports/digital-marketing-member-pages/pages/sales.html` — new Theekshy tab button, tab content block (March–June + July month tabs only), and JS module.
- `reports/digital-marketing-member-pages/scripts/generate-snapshots.js` — added Theekshy to the staff→snapshot-name map.

# Evidence Location
This file.

# Validation Result
See `validation/sales/2026-07-22_theekshy-ads-tab-new-uk-staff-validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production (`vercel --prod`). Live data check on March (her first month) was in progress when this was saved — see Next Step.

# PASS / FAIL
PASS (scope: tab built and deployed per exact user spec). Live financial totals not yet independently confirmed — see Next Step.

# Next Step
1. Confirm live March–July data returns real matched orders (`utm_term=theekshy`) once a live check completes — the store-wide monthly fetch for `ledsone.co.uk` takes 40-90+ seconds per month, same known slowness as Sajeepan's tab before its snapshot fix.
2. Consider running `node scripts/generate-snapshots.js theekshy-ads` (March-June only, since Jan/Feb don't apply to her) once initial data is confirmed correct, to get the same speed benefit as Thasitha/Sajeepan.
3. Git commit/push — pending explicit user permission per repo's standing rule.
