# Handover — Dilaksi Requirement 2: Product Priority Guidance

**Title:** Requirement 2 handover for GPT/Kuberan/Mani
**Purpose:** Continue this work without verbal explanation.
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days), 5 collections
**Team member:** Dilaksi · **Team:** SEO
**Business question:** SEO prioritisation of products/categories.
**Task date:** 2026-07-02 · **Owner/reviewer:** Kuberan

## Where things stand
- `pages/dilaksi.html` now has TWO sections: Requirement 1 (GA4 organic report, completed, untouched) and Requirement 2 (Product Priority Guidance — **placeholder, "Data pending"**, approved 7-column structure, SEO priority marked "logic pending approval").
- Standalone copy: `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`.
- **Why placeholder:** PostgreSQL has no per-SKU 30-day sales, no verified COGS margins, keyword demand only at keyword level, organic sessions only for 14 pilot pages, and no approved SEO priority rule. Full proof: evidence file below. Policy: never invent values.

## To finish Requirement 2 (Option B spec — give to data team)
1. Shopify per-SKU UK sales, daily. 2. Verified COGS per SKU. 3. Semrush volume mapped keyword→URL→SKU. 4. GA4 organic sessions per product daily (fill raw_data.ga4_landing_page_daily — currently 0 rows). 5. SEO-team-approved priority rule as a view.
Then run the reusable build prompt: prompts/dilaksi/dilaksi-requirement-2-product-priority-member-page-prompt.md.

## Deploy status
Live Vercel site (digital-marketing-member-pages.vercel.app) still serves the pre-Requirement-2 page. Redeploy = `vercel deploy --prod --yes` from the project folder — needs approval.

**PostgreSQL source checked / Files created:** see closure + evidence files
**Evidence path:** evidence/dilaksi/dilaksi-requirement-2-product-priority-postgresql-evidence.md
**Validation result:** PASS (placeholder) · **Status:** DELIVERED (C) + SPECIFIED (B)
**Known limits:** no data until pipeline lands.
**Next step:** deploy approval → pipeline build → populate.
**PASS/FAIL rule:** future population PASSes only with verified sources + approved rule.
