# CONTINUATION PROMPT — Dilaksi Requirements 1–3 (account switch)

**Title:** Handover prompt for a fresh Claude session · **Date:** 2026-07-03 · **Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
**Working directory:** `C:\Users\PC\OneDrive\Desktop\kuberan web` (AIOS repo, github kuberandigit-coder/aios-2, branch main, all work committed & pushed through `86f61cc`)

## Purpose
Continue Dilaksi's Digital Marketing requirements without re-discovery. Follow CLAUDE.md AIOS rules (new dated evidence/validation/closure files per task; commit+push after completed tasks; never invent data).

## Current state — ALL VERIFIED LIVE (https://digital-marketing-member-pages.vercel.app)
- **Req 1 (`pages/dilaksi.html`):** GA4 organic landing report with 60/45/30/15/7-day filter, live GA4 Data API windows. DONE.
- **Req 2 (`pages/dilaksi-req2-all-products.html`):** 1,231 products (5 collections) with Semrush demand, GA4 organic sessions, SEO Priority (approved 6-rule, solid-colour badges), filters: collection / sales / SEO priority / search. DONE. Pending: Profit Margin (COGS not in PostgreSQL).
- **Req 3 (`pages/dilaksi-req3-pages-for-removal.html`):** 5 URLs with GA4 12m organic sessions, GSC 12m impressions, Shopify live status, header/footer/sitemap link check. On the index Dilaksi card as R3. DONE except: **Referring Backlinks = "Pending — Semrush"** (no Semrush connector; needs user's Semrush Backlink Analytics export) and Recommended Action (deferred by requirement).

## Connectors (all working)
- **GA4:** service account key `C:\Users\PC\.keys\ga4-service-account.json`, property 408110563. Scripts in `reports/dilaksi/data/`.
- **GSC:** SAME service account, property `sc-domain:ledsone.co.uk` (Restricted). Working query script: `reports/dilaksi/data/2026-07-03_req3-gsc-test-query.py`.
- **Shopify:** MCP connector (LEDSone UK Ltd, ledsone.co.uk) — read via graphql_query.
- **Vercel:** CLI logged in; deploy = `cd reports/digital-marketing-member-pages` → `vercel deploy --prod --yes` → verify live → only deploy with user approval unless user asks.

## Key data files (`reports/dilaksi/data/`)
Req 2: `2026-07-02_req2-page-builder.py` (single source — rerun to regenerate page incl. SEO priority + log CSV), sales CSV, keyword map, Semrush volumes, GA4 organic 30d CSV, handles p1–p4. Req 3: urls CSV, GA4 12m fetch+CSV, GSC test script + impressions CSV.

## Next likely tasks
1. Req 3: fill Referring Backlinks when user supplies Semrush export → update page (both copies: also `reports/dilaksi/dilaksi-requirement-3-pages-for-removal.html`) → deploy with approval.
2. Req 2: Profit Margin column when COGS lands in PostgreSQL → rerun builder (rules 2/4 of SEO priority activate automatically).
3. Recommended Action column for Req 3 — needs user-approved business rule first (never invent logic).

## Guardrails
Read-only connectors; never invent data; don't touch Req 1/other member pages/EOD/Blog tool/Shopify themes unless asked; AIOS files per task (see CLAUDE.md); PASS/FAIL + RAG in every report.

**PASS/FAIL rule:** Any continued task PASSes only with real connector data (or explicit "Pending" markers), AIOS evidence saved, live verification after deploys.
