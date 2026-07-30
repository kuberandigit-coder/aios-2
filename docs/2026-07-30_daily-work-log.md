# Daily Work Log — 2026-07-30

## Summary
Ported the DE (ledsone.de) sales dashboard to the same order-level, zero-duplication architecture already proven on the UK dashboards, built a full 2025 DE version, split product-owned orders out of the UK "DM Campaigns" tab for two staff members, and reorganized a couple of tabs per user feedback.

## Tasks Completed

1. **`api/salesde.js` / `salesde.html` (2026 DE Sales)** — ported real Jeffri/Thasitha/Mahima/Sukirtha ownership rules from `api/sales.js` (product-ID-based for Mahima) into the order-level `GROUPS` architecture; added Feb–Jul 2026 month tabs; added a "DE Sales" nav tab to `sales.html`. Verified zero duplicates and zero missed orders (aside from legitimately excluded cancelled/test orders) across all 6 months.

2. **UK "DM Campaigns" product-ID split — Sajeepan and Sonya**: added ~1,337 and ~1,750 owned product IDs respectively to `api/salesuk.js`. Any order that would have matched the DM-Ad campaign rule but contains one of their products now routes to their own tab instead. Caught and fixed a real bug along the way: the dashboard serves pre-generated snapshot files, so the code change alone didn't take effect until the `dm-ad`/`sonya`/`sajeepan` snapshots were regenerated for all 7 months. Verified zero overlap between all three tabs, every month, both times. Flagged 3 product IDs the user gave that appear in *both* lists — resolved by giving Sonya priority (checked first in group order) since the user hasn't said otherwise.

3. **Repurposed the whole `salesde` stack for 2025 only**: renamed `api/salesde.js` → `api/salesde25.js` and `pages/salesde.html` → `pages/salesde25.html` (2026 DE is already covered by the per-person tabs on the main `sales.html`, so nothing was lost). Scoped to Jan–Jun 2025 per user request, dropped the Thasitha group entirely (not needed for 2025). Renamed the DE nav tab to "2025 DE". Verified zero duplicates across all 6 months.

4. **Mahima Ads/Organic sub-split** (2025 DE only, per user clarification): her single "Mahima" tab was replaced with two — **Mahima Ads** (ad-campaign-matched only) and **Mahima Organic** (not ad-matched, but contains one of her owned products — including orders with no journey data at all). Ad-click wins on the rare overlap. Verified live: January 2025 showed 0 Mahima Ads / 271 Mahima Organic, meaning her DE presence this month is entirely product-driven, not ad-click-driven — flagged to the user as a real finding, not a bug.

5. **Direct tab split** (UK): "Direct" channel orders were being lumped into the Organic tab on `salesuk.html`. Removed Direct from `isOrganicMatch`, added a new `direct` group in `api/salesuk.js` checked before Organic. First built as a standalone page (`salesuk-direct.html`) with its own nav link, per initial instruction — then corrected per user follow-up to instead add "Direct" as a group tab **inside** `salesuk.html` itself, and removed the standalone page and its `sales.html` nav link entirely. Regenerated `organic`/`direct` snapshots for all 7 months; verified zero overlap every month.

## Files Touched
- `reports/digital-marketing-member-pages/api/salesde25.js` (renamed from `salesde.js`)
- `reports/digital-marketing-member-pages/pages/salesde25.html` (renamed from `salesde.html`)
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/api/assign-order.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `reports/digital-marketing-member-pages/scripts/bulk-salesuk-refresh.js`
- `reports/digital-marketing-member-pages/vercel.json`
- `reports/digital-marketing-member-pages/api/data/salesuk-{dm-ad,sonya,sajeepan,organic,direct}-*.json` (regenerated snapshots)

## Status
All live and verified via curl post-deploy. Synced to both `staff/main` (via the `staff-sync29` worktree) and `aios-2`.

## Outstanding
- Whether the 3 overlapping product IDs between Sajeepan's and Sonya's lists should actually resolve to Sajeepan instead of Sonya — awaiting user confirmation.
- Whether a Mahima-Ads-style rule should exist for DE at all, given 0 ad-matched orders found in January 2025 — awaiting user input on DE-specific ad campaign naming.
