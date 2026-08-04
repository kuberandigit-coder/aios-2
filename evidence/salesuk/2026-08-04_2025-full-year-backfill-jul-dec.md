# Evidence — sales25.js/sales25.html: 2025 Full-Year Backfill (Jul–Dec)

**Purpose:** Extend `api/sales25.js`'s 2025 coverage from Jan–Jun only to the full calendar year (Jan–Dec), so `sales25.html` and `muguntha.html` can both report on Sonya (and all other groups) for every 2025 month.

**Files modified**
- `reports/digital-marketing-member-pages/api/sales25.js` — `SUPPORTED_MONTHS` extended from `['2025-01' .. '2025-06']` to the full `['2025-01' .. '2025-12']`. No new attribution logic — same order-fetch/journey-classification code already used for Jan–Jun, just whitelisted for 6 more months.
- `reports/digital-marketing-member-pages/pages/sales25.html` — month selector/tab list extended to include July–December.

**Files created (snapshots, 42 total — 6 months × 7 groups)**
- `api/data/sales25-{dm-ad,meta,sonya,sajeepan,sukirtha,organic,not-assigned}-2025-{07,08,09,10,11,12}.json`
- Generated via the existing `scripts/bulk-sales25-refresh.js <month>` tool (hits the live deployed endpoint with `?refresh=1`, one group at a time, 15s cooldown), same mechanism already used for the Jan–Jun backfill on 2026-07-29.

**Reused (no duplication)**
- Order fetch, journey classification, group-assignment rules — 100% identical code path already confirmed for Jan–Jun; only the month whitelist changed.
- Static-snapshot fast-path pattern in `handleGroup()` — already existed, unchanged.

**Deployment**
- Deployed twice: first to make the extended `SUPPORTED_MONTHS` live (so Shopify could be queried directly for the new months while snapshots were being generated), then again after all 42 snapshot files were written, so the fast static-snapshot path serves them instead of live Shopify queries.
- Final production URL: https://digital-marketing-member-pages.vercel.app

**Status:** PASS — all 12 months of 2025 now supported and snapshotted for all 7 groups.
**Reviewer:** pending
**Next step:** none outstanding for this specific task; `muguntha.html`'s own Sonya-cost dashboard (separate but related) was extended to match in a follow-on task the same day — see `evidence/muguntha/2026-08-04_full-session-summary.md`.
