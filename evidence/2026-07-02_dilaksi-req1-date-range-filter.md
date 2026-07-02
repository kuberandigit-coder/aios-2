# Evidence — Dilaksi Req 1: Date-Range Filter (60/45/30/15/7 days)

**Date:** 2026-07-02 · **Requirement:** 1 · **Team member:** Dilaksi (SEO) · **Owner/reviewer:** Kuberan
**Purpose:** Add a date-range filter (60 / 45 / 30 / 15 / 7 days) to the Req 1 GA4 organic landing page report at `pages/dilaksi.html`.

## What was done
1. **Fetched all 5 windows live from GA4 Data API** (service account, property 408110563, Organic Search only, true rolling windows ending today):
   - Script: `reports/dilaksi/data/2026-07-02_req1-ga4-multiwindow-fetch.py`
   - Data: `reports/dilaksi/data/2026-07-02_req1-ga4-organic-windows.json`
   - Per window: overall totals + top 200 landing pages; metrics: sessions, active users, engagement rate, engagement duration, pages/session, purchases, purchase revenue.

| Window | Landing pages | Sessions | Revenue (£) |
|---|---|---|---|
| 60 days | 4,564 | 16,023 | 16,500.69 |
| 45 days | 3,695 | 11,658 | 11,237.99 |
| 30 days | 2,771 | 7,760 | 7,420.62 |
| 15 days | 1,597 | 3,627 | 3,791.43 |
| 7 days | 902 | 1,717 | 1,875.42 |

2. **Rebuilt `pages/dilaksi.html`** (builder: `reports/dilaksi/data/2026-07-02_req1-page-builder.py`; old page backed up at `reports/dilaksi/data/2026-07-02_req1-dilaksi-page-backup.html`):
   - Filter buttons 60/45/30/15/7 days (default 30); cards + top-50 table re-render per window from embedded JSON.
   - Engagement Rate, Avg Engagement Time and Pages/Session now shown with real GA4 values (were "N/A — not in database" in the old PostgreSQL-export version). Purchases column added.
   - GSC top-query mapping (49 pages) carried over from the previous page; footnote explains its fixed 30-day GSC window.
3. **Deployed:** `vercel deploy --prod --yes` → `dpl_2AuAB3Jk6EKCNPhv2bXN2v3uqD2G` READY; live verified (HTTP 200, all 5 buttons + all 5 datasets present). Req 2 page unaffected (HTTP 200).

## Guardrails
No invented data — every number fetched live from GA4 on 2026-07-02. Old page preserved as backup. Other member pages, EOD, Blog tool, Shopify themes untouched; read-only access.

**Status:** PASS
