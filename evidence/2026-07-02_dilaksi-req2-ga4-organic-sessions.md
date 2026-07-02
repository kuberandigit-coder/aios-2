# Evidence — Dilaksi Req 2: GA4 Organic Sessions on All-Products Page

**Date:** 2026-07-02 · **Requirement:** 2 · **Team member:** Dilaksi (SEO) · **Owner/reviewer:** Kuberan
**Purpose:** Add a real, GA4-sourced "Organic Sessions" badge to every product on the Req 2 all-products page.

## What was done
1. **Handle extraction completed** via Shopify Admin GraphQL (`collectionByHandle("pendant-lights").products(first:250, after:cursor){legacyResourceId handle}`):
   - Page 1 (previous session): `reports/dilaksi/data/2026-07-02_req2-handles-p1.json` (602 products, c1–c5)
   - Page 2: `reports/dilaksi/data/2026-07-02_req2-handles-p2.csv` (229 products)
   - Page 3: `reports/dilaksi/data/2026-07-02_req2-handles-p3.csv` (230 products)
   - Page 4: `reports/dilaksi/data/2026-07-02_req2-handles-p4.csv` (131 products, `hasNextPage=false` — pagination complete)
2. **GA4 join** in `reports/dilaksi/data/2026-07-02_req2-page-builder.py`:
   - Source: `2026-07-02_req2-ga4-organic-landing-30d.csv` (GA4 Data API, service account, property 408110563, Organic Search channel only, true last 30 days, 2,768 landing pages)
   - Query strings stripped; matched `/products/<handle>` and `/collections/*/products/<handle>`; sessions summed per product.
3. **Badge added** (blue `.og` pill, grey `.og0` when 0) per product; header chip + footer source note added.
4. Builder paths repointed from old scratchpad to permanent `reports/dilaksi/data/` (keyword map + Semrush volumes).
5. Page regenerated and synced to `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`; deployed to Vercel production.

## Verification numbers
- Unique product IDs in catalog CSV: **1,182** (1,231 rows incl. cross-collection duplicates) — **0 unresolved handles**
- Badges rendered: **1,231/1,231** (447 badge instances nonzero; **420 unique products** with organic sessions > 0)
- Total organic landing sessions attributed to catalog products: **1,360**
- GA4 CSV contained 1,609 distinct product handles (rest are non-catalog/other collections)

## Deployment
- `vercel deploy --prod --yes` → `dpl_4ebN2CxkeRXN1GhfS4BESMf2fsRD` → READY
- Live: https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req2-all-products.html (HTTP 200, 1,231 og badges present, GA4 footer note present)

## Guardrails respected
No invented data (every value from GA4 CSV or true 0); Requirement 1 page, other member pages, EOD, Blog tool, Shopify themes untouched; read-only Shopify/GA4 access. Out of scope: Profit Margin (COGS pending), SEO Priority (rule approval pending).

**Status:** PASS
