## Purpose
Build a full Performance tab for Mahima on `pages/muguntha.html`, matching the other DE-store tabs (Jefri, Sukirtha, Thasitha), reusing her already-established Sales algorithm.

## Business Question
Kuberan: "analysis the staff id performance page in the muguntha.html here with the mahima ids create for mahima , already done for uk staff now need for de staff starts with mahima and you know about the mahima sales alogic also so create" — following the earlier product-ID list update (660 → 678 IDs) and the Sukirtha tab build.

## Investigation
- Confirmed via direct DB query (`ledsone-db-mcp`): `group_name='Mahima'`, `account_id=9031058245` (same DE account as Jefri/Thasitha/Sukirtha), 16 campaigns, real ad spend across the full 2023-2026 history (£83.24 to £2,745.57/month) — unlike Sukirtha, she has genuine Google Ads cost to show, not just a tool-cost share.
- Confirmed her Sales already has an established, dedicated endpoint: `?staff=mahima-total` in `salesde25.js`/`sales.js` — product-scoped to her owned product IDs (`MAHIMA_EXCLUDED_PRODUCT_IDS`, just updated to 678 entries), every channel except Social/Email (confirmed not hers, permanently excluded 2026-07-21). No new attribution logic was written — reused exactly as-is.

## Fix
- `api/muguntha.js`: added `EMPLOYEES.mahima` (same shape as Jefri — `isJefri: true`, `groupName: 'Mahima'`, `accountId: 9031058245` — real ad-spend query, no DM-46 concept).
- `pages/muguntha.html`: generalized the DE-routing map (`DE_STAFF_ROUTING`) to include Mahima (`staffValue: 'mahima-total'`); added a `DE_ADS_ROLE_MEMBERS` set (Jefri, Mahima) so her cost popup shows "Ads Cost" (real spend + Discount/Refund from her orders, no Transaction Fee/Subscription Fee — same DE-only treatment as Jefri) rather than the AI-tools-cost branch Kamsi/Dilaksi/Sukirtha use; full panel HTML (cards, table, methodology footnote); nav/filters/export wiring.
- Generated 38 static snapshot files (19 months sales via `mahima-total`, 19 months cost) for fast page load, matching every other member.

## Files Modified
- `api/muguntha.js`, `pages/muguntha.html`

## Files Created
- 19x `api/data/mahima-de-total-sales-YYYY-MM.json`
- 19x `api/data/muguntha-mahima-YYYY-MM.json`

## Status
PASS — live-verified real data (March 2025: cost £1,545.43, exact match to a direct DB query; sales 231 orders, €3,665.02 netSales), response time confirmed ~1.1s after snapshot generation.

## Reviewer
Kuberan
