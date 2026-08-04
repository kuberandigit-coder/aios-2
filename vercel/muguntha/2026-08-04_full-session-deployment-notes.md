# Deployment Notes — Muguntha Employee Performance Dashboard: Full Session (2026-08-04)

**Project:** `digital-marketing-member-pages` (Vercel, org `digitalmarketing69140951-sys-projects`)
**Production URL:** https://digital-marketing-member-pages.vercel.app
**Page:** `/pages/muguntha.html`
**API:** `/api/muguntha`

**Deploys this session:** ~9 incremental production deploys (`vercel --prod --yes`), one after each logical change:
1. DM cost attribution added (`api/muguntha.js`, `api/salesuk.js` export).
2. 2025-DM-exclusion correction (table columns simplified, 2025 back to own-cost-only).
3. Own+DM bracket display added to 2026 Cost cell.
4. Full sidebar/topbar UI redesign (navy/gold theme).
5. Sidebar populated with all 12 team members (initial per-member-page-link version).
6. Professional color-coding pass (Net/ROAS/Target colors, KPI card accents, typo fix).
7. Nav cleanup (removed Reports section, self-link, per-member links converted to in-page tabs).
8. Sales link added, Back-to-dashboard button removed; `home.html` Muguntha card removed.
9. KPI card trim (12 → 7 cards); final 2025-DM-parity + full-year-2025 fix.

**Function count:** unchanged — `api/muguntha.js` already existed from the original build; this session only extended its logic (DM cost query) and the frontend, no new serverless functions added.

**Snapshot regeneration:** `api/data/muguntha-sonya-2025-{01..12}.json` and `api/data/muguntha-sonya-2026-{01..07}.json` all now include `dmSonyaProductCost`/`dmTotalCost`/`totalCost` fields — Jan-Jun 2025 and all of 2026 were regenerated with DM fields earlier in the day; Jul-Dec 2025 were newly created this session with the same schema, computed directly via SQL (ledsone-db-mcp) rather than round-tripping through the live endpoint, for speed.

**Rollback:** standard `vercel rollback` if needed; no schema/DB changes were made (Postgres queries are read-only SELECTs).
