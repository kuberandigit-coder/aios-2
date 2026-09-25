# Evidence — Task 15 (Hetheesha): Structured Data Validation, ledsone.fr

**Date:** 2026-09-25
**Prompt:** [[2026-09-25_task15-structured-data-validation_original-prompt]]
**Validation:** [[2026-09-25_task15-structured-data-validation_validation]]
**Handover:** [[2026-09-25_task15-structured-data-validation_handover]]

Built in `dm-dashboard` (branch `dev-work`), left uncommitted for review. Not
deployed. Read-only toward Shopify and the live site.

## What was built

- Backend package `backend/app/dev_tasks/structured_data_validation/`:
  `schema`, `discovery` (sitemap), `extract` (JSON-LD / microdata / RDFa),
  `shopify_products` (bulk + single lookup), `validators` (rule engine), `gsc`
  (URL Inspection), `state` (fix workflow + re-validation), `pipeline`,
  `scheduler`, `authorization`, `router`. Route prefix
  `/api/dev/structured-data-validation` (15 routes).
- Page `frontend/src/admin/pages/dev-tasks/StructuredDataValidation.jsx` + `.css`
  (eight tabs), registered in `taskRegistry.js`, `DevLayout.jsx`,
  `AdminLayout.jsx`, `SalesSyncMonitor.jsx`.
- Database (app DB, additive): `structured_data_validation_runs`, `_url_results`,
  `_issues`, `_issue_state`, `_issue_history`, `_url_rechecks`, `_gsc_inspections`.
- Sync Monitor job scope `structured-data-validation` (weekly, resumes after a restart).

## Data sources actually used

| Source | Use |
|---|---|
| ledsone.fr public sitemap index and child sitemaps | URL list (never invented) |
| Live page HTML of each URL | JSON-LD, microdata, RDFa |
| Shopify Admin API (`ledsone_fr`, read-only GraphQL) | handle, title, vendor, description, images, variants, shop currency |
| Google Search Console URL Inspection API (dedicated ledsone.fr service account) | rich results verdict / detected items for a bounded sample |
| Task 13 page inventory table | cross-check counts only |

The Search Console UI "Enhancements" reports have no public API and are not read.

## Live smoke check (small, real data) — 2026-09-25

Two runs of a deliberately small sample (13 URLs, then 9 URLs: homepage,
collections, products, blog articles, pages), 3 and 2 Search Console inspections.
All rows written to the shared database were deleted afterwards; a count of every
new table returned 0 (the tables themselves remain, empty).

- Sitemap discovery worked: 6 child sitemaps, no errors. Shop currency read from
  Shopify: EUR; 1,117 products read.
- Extraction worked on real pages (Article/BlogPosting/Organization on blogs,
  FAQPage/Organization/Product on products).
- Search Console URL Inspection returned real results for 3 + 2 URLs, no quota
  problem, and its rich-results messages were converted into issues.
- The fix workflow, CSV export (12 columns, exact header), server-side 401 for a
  missing or invalid token, URL detail and a single-URL re-validation ran.

### Real findings on ledsone.fr (not fabricated; shown by the module)

1. **Invalid availability values.** Product offers output `availability` as
   `http://schema.org/farce` and `http://schema.org/hors de gamme`, which are not
   valid schema.org values (looks like the text was translated). Flagged HIGH
   `invalid_availability`; Search Console independently reported
   `Invalid enum value in field "availability"` for Product snippets and
   Merchant listings. Origin (theme vs app) is not determinable from the page.
2. **No BreadcrumbList** on any of the sampled collection, product or blog pages
   (MEDIUM `missing_breadcrumb`).
3. Product pages lack `shippingDetails`, `hasMerchantReturnPolicy`, `mpn`,
   `gtin` (LOW/MEDIUM); Article schemas lack `datePublished`, `dateModified`,
   `image`; the homepage Organization has no `logo` and no `WebSite` schema.

The 9–13 URL samples are not the whole site; percentages must not be inferred.

## Not verified

Full crawl of about 1,300 URLs, the full Sync Monitor job, the dashboard in a
browser, authorized (non-401) writes, deployment, Hetheesha's UAM access.
