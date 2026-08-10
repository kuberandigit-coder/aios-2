# Evidence — Muguntha Dashboard: Kamsi/Dilaksi/Jefri Tabs + Performance & Cost Fixes (2026-08-05)

**Purpose:** Record of `muguntha.html`/`api/muguntha.js` changes made 2026-08-05, continuing the multi-member build started 2026-08-04.

---

## 1. Kamsi tab added (`6e92906`)
SEO/Organic role, £0 ad cost by design (same pattern as other non-ad-spend roles). Full 2025–2026 snapshot backfill generated.

## 2. Dilaksi tab added (`4a86e51`)
Same SEO/Organic, £0-ad-cost pattern as Kamsi. Backfilled missing `sales25-dilaksi` 2025 snapshots that were absent before the tab could show full-year data.

## 3. Jefri tab added (`149f1d4`, `21426b4`, `e2fb798`)
DE-store member: Google Ads account `9031058245`, 5 named campaigns. Sales computed **including** tax+shipping per explicit user request — differs from the UK members' net-of-tax convention, documented in the tab's footnote. Backfilled `2025DE.html` to full year and fixed stale 2026 snapshots, wired both into `muguntha.html`. Corrected same day (`e2fb798`): cost was scoped to only 5 hardcoded campaign IDs instead of the full "Jefri" campaign group (61 campaigns) — fixed to use the full group.

## 4. Sales definition fix — netSales (`5b75d75`)
Sonya/Sajeepan/Kamsi were showing raw order-total Sales on `muguntha.html`, inconsistent with the Net Sales (excl. tax/shipping/discounts/refunds) figure already shown for the same staff on `salesuk.html`. Switched to `netSales` so both dashboards agree.

## 5. Performance fixes
- `4fb9fb4`: lazy-load member tabs instead of eagerly loading Sonya+Sajeepan+Kamsi (120 requests) on every page load.
- `af3a0c3`: capped concurrent fetches per `loadAll()` at 5 per group instead of firing all 20 at once.
- `823f9d4`: `api/muguntha.js` DM cost query was timing out — replaced non-sargable `split_part()`/`to_char()` SQL filters with a date-range filter plus JS-side product matching.

## 6. Refresh scoping fix (`69e061a`)
"Refresh (live)" was force-refreshing all 20 months instead of just the current live month. Scoped correctly to the live month only. Backfilled missing `sales25-kamsi` 2025-02..12 snapshots discovered missing during this fix.

## 7. DM cost removal for Kamsi/Dilaksi (`49ee86a`)
Removed DM 46 campaign cost entirely for Kamsi/Dilaksi (previously only zeroed, not removed) — both are SEO/Organic roles with no ad spend by design, so any nonzero DM cost line was misleading.

---

## Files touched
- `reports/digital-marketing-member-pages/pages/muguntha.html`
- `reports/digital-marketing-member-pages/api/muguntha.js`
- `reports/digital-marketing-member-pages/pages/2025DE.html`
- `reports/digital-marketing-member-pages/api/data/sales25-{kamsi,dilaksi}-2025-*.json`
- `reports/digital-marketing-member-pages/api/data/muguntha-jefri-*.json`

## Deployment
Incremental production deploys throughout the session, per the project's deploy-then-verify-then-push workflow.

**Status:** PASS — all changes deployed and spot-verified live via curl against `/api/muguntha`, `/api/sales25`, `/api/salesde`.
**Reviewer:** Muguntha (pending review)
**Next step:** Remaining members (Sajeepan panel finishing touch, Theekshy, Jackson, Hetheesha, Thivajini) still placeholder-only — deferred per prior instruction.
