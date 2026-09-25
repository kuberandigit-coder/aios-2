# Handover — Task 15: Structured Data Validation (ledsone.fr)

**Owner:** Hetheesha  **Reviewer:** Kuberan
**Date:** 2026-09-25
**Status:** Implementation Complete — Manual Verification Pending. Not deployed,
not committed in `dm-dashboard` (left for review). No closure record.
Evidence: [[2026-09-25_task15-structured-data-validation_evidence]] ·
Validation: [[2026-09-25_task15-structured-data-validation_validation]]

## What was built

A Development Task that discovers every URL in ledsone.fr's public sitemap,
extracts JSON-LD / microdata / RDFa, validates it against live Shopify data and
the site's own pages, adds a bounded Google Search Console URL Inspection sample,
and tracks fixes with a re-validation workflow. Read-only toward Shopify.

## Files

- Backend: `backend/app/dev_tasks/structured_data_validation/` (`schema`,
  `discovery`, `extract`, `shopify_products`, `validators`, `gsc`, `state`,
  `pipeline`, `scheduler`, `authorization`, `router`), registered in
  `dev_tasks/__init__.py`.
- Frontend: `frontend/src/admin/pages/dev-tasks/StructuredDataValidation.jsx` +
  `.css`; edits to `taskRegistry.js`, `dev/DevLayout.jsx`, `admin/AdminLayout.jsx`,
  `admin/pages/SalesSyncMonitor.jsx`.
- Also in the working tree from the earlier credential task (needed by this one):
  `backend/app/google_client.py` (`get_gsc_ledsone_fr_access_token`, `_FILE`
  fallback) and root `.gitignore` (service-account key patterns).
- Tables: `structured_data_validation_{runs,url_results,issues,issue_state,issue_history,url_rechecks,gsc_inspections}`.

## Sources and logic

- Sitemap → URL list and template (Homepage, Collection, Product, Blog/Article, Page) by path.
- Shopify (`ledsone_fr`) bulk-read once per run: handle, title, vendor,
  description, images, variants (sku, barcode, price, availableForSale), shop currency.
- Priorities: HIGH = missing/invalid Product schema, wrong price/currency/availability,
  duplicate or conflicting Product schema. MEDIUM = important Merchant warnings and
  missing eligibility fields. LOW = recommended fields. NO ACTION = no issue.
- Issue key = normalized URL + schema type + field + issue code; state and
  history live in separate tables so they survive every new run.
- Re-validation: one page fetch + one Shopify lookup; a still-present issue that
  was Fix required / Ready for recheck / Failed (or the one clicked) becomes
  FAILED, a gone issue becomes PASSED. A failed fetch never marks anything PASSED.
- GSC: `POST searchconsole.googleapis.com/v1/urlInspection/index:inspect` with the
  dedicated `GSC_LEDSONE_FR_SERVICE_ACCOUNT`; default 100 URLs per run (env
  `SDV_GSC_SAMPLE`), HIGH-issue URLs first, then a rotating sample per template;
  24 h cache; stops cleanly on quota. The Search Console UI Enhancements reports
  have no API and are not read.
- Dashboard reads always use the newest COMPLETE run.

## Routes (`/api/dev/structured-data-validation`)

GET `/overview`, `/run/status`, `/template-audit`, `/product-issues`,
`/organization`, `/breadcrumbs`, `/duplicates`, `/gsc`, `/fixes`, `/url-detail`,
`/issue-history`, `/export.csv`; protected: POST `/run`, PATCH `/issues/status`,
POST `/revalidate`.

## UAM — how to give Hetheesha access

The task key is `tools.DevStructuredDataValidation` (label "Development —
Structured Data Validation (ledsone.fr)", under the Hetheesha owner in
`taskRegistry.js`). No access grant was written. After deploy, an admin opens
User Access Management and ticks that task for Hetheesha. Writes (run,
status, re-validate) are enforced on the server: admin/dev role, or that grant.

## Deployment steps (not performed)

1. Review and commit the `dm-dashboard` changes on `dev-work`, then deploy.
2. The tables are created on first use (`ensure_schema`, once per process).
3. Sync Monitor → "Dev — Structured Data Validation" → Run Now (or the page's
   "Run validation"). Expect several minutes for about 1,300 URLs.
4. Tick Hetheesha in UAM.

## Known issues / limits

- Only a bounded sample is inspected in Search Console; other URLs show no GSC data.
- Breadcrumb URLs are compared with the sitemap, not fetched.
- Theme-vs-app origin of duplicate/invalid schema cannot be determined from the page.
- Theme asset inspection was not attempted (no theme scope confirmed); reported as not done.
- The sitemap also lists `/agents.md`; it is validated as a Page and shows
  "no structured data".
- A backend restart mid-run interrupts it; the Sync Monitor job resumes.
- Ratings/reviews are only flagged as unverifiable; support cannot be checked from the page.

## Real findings to act on (from the small smoke sample)

Invalid product availability values (`farce`, `hors de gamme`) confirmed by Google;
no BreadcrumbList; missing shipping / return policy; Article dates and image;
homepage Organization logo. Re-run the full job to see the true site-wide counts.

## Manual checks remaining

1. Run the job from the Sync Monitor; confirm success and the URL count.
2. Open the page as Hetheesha and as a user without access.
3. Walk all eight tabs: filters, sort, pagination, the detail drawer.
4. Set an issue to Fix required → Ready for recheck → Re-validate; confirm
   PASSED / FAILED and the history.
5. Export CSV and check the 12 columns.
6. Confirm the GSC tab wording and the sample counts.
