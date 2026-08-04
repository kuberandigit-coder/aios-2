# Evidence — Muguntha Employee Performance Dashboard (Sonya)

**Purpose:** Management dashboard comparing Sonya's monthly performance, 2025 vs 2026, with Sales incl. tax+shipping, ADS Cost, Net, ROAS, Target Achievement, Status.

**Files created**
- `reports/digital-marketing-member-pages/pages/muguntha.html`
- `reports/digital-marketing-member-pages/api/muguntha.js`

**Files modified**
- `reports/digital-marketing-member-pages/home.html` (added Management section, link to muguntha.html)
- `reports/digital-marketing-member-pages/vercel.json` (registered api/muguntha.js as a function)

**Reused (no duplication)**
- Sales (incl. tax + shipping): existing `/api/sales25?group=sonya&month=YYYY-MM` (2025, Jan–Jun) and `/api/salesuk?group=sonya&month=YYYY-MM` (2026, Jun–Aug) — read `combinedSummary.orderTotalSum` (Shopify `currentTotalPriceSet`, already inclusive of tax+shipping — no new attribution logic written).
- Postgres connection pattern (`getPool()` via `DATABASE_URL`/`PGHOST` env, no SSL) — copied from `api/requirement.js`.
- Page CSS/layout — copied from `sales25.html`/`sales2.html`.

**New (only what didn't exist)**
- `api/muguntha.js`: sums `google_ads.campaign_performance.cost` for campaigns where `campaign_name ILIKE '%sonya%'` (verified 21 real campaign names all contain "Sonya", across UK/US/Ireland/Spain Google Ads accounts) grouped by month. This is Sonya's ADS Cost — nothing else in the codebase computed this.

**Evidence of correctness**
- Live API check: `GET /api/muguntha?months=2025-01,2025-02,2026-08` → `{"2025-01":675.66,"2025-02":606.53,"2026-08":629.08}`, matches direct SQL run via ledsone-db-mcp before implementation.
- Live sales check: `GET /api/sales25?group=sonya&month=2025-01` → `orderTotalSum: 12648.26`, `ordersCount: 339`.
- Page loads at `/pages/muguntha.html` → HTTP 200.

**Deployment:** https://digital-marketing-member-pages.vercel.app/pages/muguntha.html (Vercel prod, project `digital-marketing-member-pages`)

**Status:** PASS — scoped to Sonya only per user instruction (2026-08-04). Multi-employee expansion deferred until user requests it.

**Reviewer:** Muguntha (pending review)
**Next step:** Muguntha reviews numbers against the Google Sheet screenshot she provided; extend to other employees once cost-table pattern is confirmed acceptable.
