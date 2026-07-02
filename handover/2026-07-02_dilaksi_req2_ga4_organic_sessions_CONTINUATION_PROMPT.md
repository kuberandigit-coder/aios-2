# CONTINUATION PROMPT — Dilaksi Req 2 GA4 Organic Sessions (session hit usage limit)

**Title:** Handover prompt for a fresh Claude session · **Date:** 2026-07-02 · **Requirement number:** 2
**Team member:** Dilaksi · **Team:** SEO · **Owner/reviewer:** Kuberan
**Purpose:** Continue adding GA4 Organic Sessions to the Req 2 all-products page without re-discovery.

## State when interrupted (all verified)
- GA4 Data API WORKING: key `C:\Users\PC\.keys\ga4-service-account.json`, property 408110563, lib installed. Fetch already ran: **2,768 organic landing pages, last 30 days** → saved permanently at `reports/dilaksi/data/2026-07-02_req2-ga4-organic-landing-30d.csv` (sessions, users, engagement_rate, engagement_duration, pages/session, revenue). Fetch script: `...data/2026-07-02_req2-ga4-fetch-script.py`.
- Page builder: `reports/dilaksi/data/2026-07-02_req2-page-builder.py` (paths inside point at old scratchpad — update paths to reports/dilaksi/data/ when reusing).
- Handle extraction in progress: page 1 saved (`...data/2026-07-02_req2-handles-p1.json`, 602/1,231; pendant-lights hasNextPage=true, cursor `eyJsYXN0X2lkIjo4MTA5ODkyNTAxNzU0LCJsYXN0X3ZhbHVlIjoiMjAyMy0xMi0xMSAxMToyMTo0My4wMDAwMDAifQ==`).

## Remaining steps
1. Shopify MCP GraphQL: fetch pendant-lights handles pages 2–4 (`products(first:250, after:cursor){legacyResourceId handle}`).
2. Join GA4 CSV → products: strip querystrings, match `/products/<handle>` and `/collections/*/products/<handle>`, sum sessions per product.
3. Add blue "Organic Sessions" badge per product on `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` (existing design; 0 for unmatched). Sync `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`.
4. Footer note: organic sessions from GA4 Data API (service account, true last-30-days, Organic Search only).
5. AIOS new dated files (evidence/validation/closure/handover/source-map/vercel) + commit + push (aios-2 main).
6. Deploy: `cd reports/digital-marketing-member-pages` → `vercel deploy --prod --yes` (CLI logged in) → verify live → report table + GREEN/AMBER/RED.

## Guardrails
No invented data; Requirement 1 (pages/dilaksi.html), other member pages, EOD, Blog tool, Shopify themes untouched; read-only connectors. Out of scope: Profit Margin (COGS pending), SEO Priority (rule approval pending).

**PASS/FAIL:** PASS when every product shows a real GA4-sourced organic-sessions value (or 0), evidence saved, deployed and verified.
