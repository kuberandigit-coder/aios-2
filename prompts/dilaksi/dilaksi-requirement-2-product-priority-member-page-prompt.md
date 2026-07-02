# Prompt — Dilaksi Requirement 2: Product Priority Guidance (Reusable)

**Title:** Build/refresh Requirement 2 on the Dilaksi member page
**Purpose:** Reusable prompt for populating the pending Requirement 2 section once data exists.
**Requirement source:** Google Sheet — "Product Priority Guidance — Sample (Last 30 Days)"; collections: wall-light, plugin-lighting, table-lamps, spider-light, pendant-lights
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?
**Task date:** 2026-07-02 · **Owner/reviewer:** Kuberan

## Option B pipeline extension spec (prerequisite — data team)
Load into PostgreSQL before this report can carry data:
1. **Shopify per-SKU UK sales, daily** (order line items: sku, qty, net revenue £, date) → enables true last-30-days Sales (£).
2. **Verified COGS per SKU** → real Profit Margin (replace the 20%-cost interim proxy).
3. **Semrush search volume mapped keyword→product URL→SKU** (extend development.seo_organic_baseline with a SKU mapping) → Demand (searches/mo).
4. **GA4 organic sessions per product page, daily** (fill raw_data.ga4_landing_page_daily, currently 0 rows) → Organic Sessions.
5. **Approved SEO Priority rule** signed off by SEO team (e.g. weighted score of sales/margin/demand/sessions) stored as a view — do NOT let the report invent it.

## Reusable build prompt (run when 1–5 exist)
> Verify each of the 5 sources exists and is fresh (read-only). Query SKUs belonging to the 5 collections, last 30 days. Populate the Requirement 2 section in BOTH `reports/digital-marketing-member-pages/pages/dilaksi.html` and `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`: 7 columns (Category, SKU, Sales £, Profit Margin, Demand, Organic Sessions, SEO Priority), 4 summary cards, Total/Avg row, generated date, source + limits notes. Do not touch Requirement 1. Update evidence/validation, re-run link check, commit, and request deploy approval.

**PostgreSQL source checked:** see evidence file (22 schemas; no adequate source yet)
**Files created/modified:** member page section (placeholder), standalone report (placeholder), AIOS set
**Evidence path:** evidence/dilaksi/dilaksi-requirement-2-product-priority-postgresql-evidence.md
**Validation result:** PASS as placeholder (see validation file)
**Status:** ACTIVE — waiting on pipeline extension
**Known limits:** placeholder carries no data by policy.
**Next step:** Data team implements items 1–5; SEO team approves priority rule.
**PASS/FAIL rule:** PASS if populated only from verified PostgreSQL sources with approved priority rule; FAIL if any value is invented.
