---
title: Source map — Mahima/Jeffri/FR onboarding/Thasitha tabs, race-condition fix
date: 2026-07-21
type: source-map
---

# Purpose
Map of exactly which files/functions were touched for this block, for fast future navigation.

# Backend — `reports/digital-marketing-member-pages/api/sales-sukirtha-de.js`
- `STORE_DOMAIN_FR` / `TOKEN_FR` — new constants for ledsone.fr.
- `shopifyGraphQL(query, variables, retryState, storeDomain, token)` — refactored to accept store overrides (previously DE-only).
- `fetchOrdersForMonth(monthConfig, retryState, storeDomain, token)` — refactored similarly.
- `handleOrganic()` — `staff` resolution chain extended: `mahima-ads-term`, `jeffri-ads`, `hetheesha-organic`, `thivagini-ads`, `thasitha-ads`; snapshot filename mapping extended to match.
- New staff branches (each a self-contained `if (staff === '...')` block returning its own payload): `jeffri-ads`, `thasitha-ads`, `hetheesha-organic`, `thivagini-ads` — the latter uses a shared `isHetheeshaOrganicGroup(row, journey)` helper so the two FR tabs always partition the store's full order set.
- `MAHIMA_EXCLUDED_PRODUCT_IDS` — pre-existing, reused for Mahima's product-scoped views (not changed this block).

# Frontend — `reports/digital-marketing-member-pages/pages/sales.html`
- Tab buttons + `showStaffTab(n)` dispatcher — extended for Jeffri, Hetheesha, Thivagini, Thasitha.
- Per-tab HTML blocks + `<script>` sections added: `jaLoad`/`jaRenderAll` (Jeffri), `heLoad`/`heRenderAll` (Hetheesha), `tvLoad`/`tvRenderAll` (Thivagini), `thLoad`/`thRenderAll` (Thasitha).
- Race-condition fix: sequence-token pattern (`let xLoadSeq = 0; const seq = ++xLoadSeq;`) applied to every load function on the page (Kamsi, Dilaksi, both Sukirtha tabs, Mahima both sub-tabs, Jeffri, Hetheesha, Thivagini, Thasitha) — replaced the old `if (xLoading) return;` blocking guards, verified via grep that zero remained after the fix.

# Static data — `reports/digital-marketing-member-pages/api/data/`
- New: `jeffri-de-ads-sales-2026-0{1-6}.json`, `mahima-de-ads-term-sales-2026-0{1-6}.json`, `thasitha-de-ads-sales-2026-0{1-4}.json` (05/06 completed in the next block).

# Data flow (for any new staff Google Ads tab)
Shopify Admin GraphQL (`ORDERS_QUERY`, paginated) → `classifyOrderJourneyOrganic(order)` (session classification) → `buildSukirthaOrderRowEmail(order, journey)` (row shape, store-wide) → utm_term/medium match against staff's confirmed identifier Set → `summarizeRows(rows)` (aggregation) → JSON payload → frontend `fetch()` → render functions → DOM.
