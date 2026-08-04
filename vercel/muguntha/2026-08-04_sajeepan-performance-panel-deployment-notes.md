# Deployment Notes — Muguntha Employee Performance Dashboard: Sajeepan Panel (2026-08-04)

**Project:** `digital-marketing-member-pages` (Vercel, org `digitalmarketing69140951-sys-projects`)
**Production URL:** https://digital-marketing-member-pages.vercel.app
**Page:** `/pages/muguntha.html`
**API:** `/api/muguntha` (now accepts `?employee=sonya|sajeepan`), `/api/sales25`, `/api/salesuk` (both already supported `group=sajeepan`)

**Deploy this session:** 1 production deploy (`vercel --prod --yes`) covering:
1. `api/muguntha.js` generalized to accept `?employee=` and branch between Sonya and Sajeepan config.
2. `api/salesuk.js` — added `SAJEEPAN_PRODUCT_IDS_UK` export.
3. `pages/muguntha.html` — added `#panel-sajeepan`, `#sajeepanFilters`, parameterized the shared JS.
4. 19 new snapshot files under `api/data/muguntha-sajeepan-*.json`.

**Deployment result:**
```
"readyState": "READY"
"url": "https://digital-marketing-member-pages-fc3tvj8y2.vercel.app"
Aliased: https://digital-marketing-member-pages.vercel.app
```

**Function count:** unchanged — `api/muguntha.js` already existed; this deploy only extended its logic, no new serverless functions added.

**Snapshot regeneration:** `api/data/muguntha-sajeepan-2025-{01..12}.json` and `api/data/muguntha-sajeepan-2026-{01..07}.json` (19 files, new) — computed directly via SQL (ledsone-db-mcp) against `google_ads.campaign_performance` (own cost) and `google_ads.product_performance` (DM 46 product-share cost + DM 46 full campaign cost), same JSON schema as `muguntha-sonya-*.json`. 2026-08 intentionally not snapshotted (current live month, always queried live per `CURRENT_LIVE_MONTHS`/`LIVE_2026`).

**Live verification (curl, post-deploy):**
- `/api/sales25?group=sajeepan&month=2025-01` → `success:true`, `orderTotalSum:6533.11`
- `/api/salesuk?group=sajeepan&month=2026-03` → `success:true`, `orderTotalSum:16835.27`
- `/api/muguntha?employee=sajeepan&month=2025-01` → `cacheStatus:"static-snapshot"`, `totalCost:2561.91`
- `/api/muguntha?employee=sajeepan&month=2026-03` → `cacheStatus:"static-snapshot"`, `totalCost:6361.91`
- `/api/muguntha?employee=sajeepan&month=2026-07` → `cacheStatus:"static-snapshot"`, `totalCost:7286.92`
- `/api/muguntha?month=2025-01` (Sonya, no `employee` param — regression check) → unchanged values (`totalCost:692.09`, `cacheStatus:"static-snapshot"`)
- Deployed page HTML grep: `panel-sajeepan` × 3, `DM Dashboard` × 2 — both present.

**Rollback:** standard `vercel rollback` if needed; no schema/DB changes were made (Postgres queries are read-only SELECTs).
