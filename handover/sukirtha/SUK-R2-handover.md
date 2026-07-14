---
title: SUK-R2 — Handover
requirement_id: SUK-R2
type: handover
---

# Title
SUK-R2 — Duplicate Listing & Price Check — Handover

# Requirement ID
SUK-R2

# Purpose
Hand over the completed, live Requirement 2 dashboard for review/next steps.

# Requirement Source
`prompts/sukirtha/SUK-R2-duplicate-listing-price-check-prompt.md`

# Business Question
Which ledsone.de variants share a SKU across listings, and do those
listings have different prices?

# Shopify Store
ledsone.de (ledsone-de.myshopify.com)

# Shopify Objects and Fields Checked
`Product{id,title,handle,status,updatedAt}`,
`ProductVariant{id,title,sku,price,compareAtPrice,updatedAt}`

# Data Grain
One row per Shopify variant.

# SKU Normalisation Rule / Duplicate Rule / Price-Mismatch Rule
See `evidence/sukirtha/SUK-R2-shopify-source-map.md` for full detail.

# Completed
- Discovery phase run and returned before any file changes (existing
  Sukirtha assets, tab structure, Requirement 2 status, Shopify field
  availability, sample duplicate data, duplicate-truth risk against the
  2026-07-01 static report and Kamsi Req6).
- Full-catalog Shopify pull (2,568 products / 10,578 variants) via
  read-only `bulkOperationRunQuery`.
- Requirement 2 tab added to `pages/sukirtha.html` — tab-nav added at the
  top of the page; Requirement 1 fully preserved, verified live.
- New serverless endpoint `api/sukirtha-req2-duplicate-check.js` — makes
  the dashboard genuinely live (fetches fresh from Shopify on every page
  load), using `SHOPIFY_ADMIN_TOKEN` stored as a Vercel Production
  environment variable (Sensitive) — never in any repo file or client code.
- All required UI elements built: 9 summary cards, 6 filters + search,
  sortable/paginated table with all 14 required columns, expandable
  "+N more" panel for SKUs with 3+ listings, CSV export matching filtered
  results.
- Deployed to Vercel production
  (`https://digital-marketing-member-pages.vercel.app/pages/sukirtha.html`),
  live endpoint tested end-to-end (200 OK, numbers match the offline pull
  exactly: 1,101 duplicate SKUs, 742 price mismatches, 613 compare-at
  mismatches).
- Div-balance and JS-syntax validated after every structural edit.

# Remaining Work
- **Peer review** — Sajeesan (technical), Tamil Selvan (queryability), SEO
  Lead (business) sign-off is pending; PASS/FAIL in validation report is
  the build-side self-check, not their approval.
- **Git commit/push** — not yet done in this exchange; per the task's file/
  git control rules, push requires separate written approval.
- The July 1 static duplicate-SKU report and this live dashboard now both
  exist for the same store — flagged in `SUK-R2-data-quality-summary.md`
  for a decision on whether to retire the static one.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`
(new). Backing data:
`reports/sukirtha/data/2026-07-14_suk-r2_bulk_products.jsonl`,
`2026-07-14_suk-r2_parse_and_detect.js`,
`2026-07-14_suk-r2_variant_rows.json`, `2026-07-14_suk-r2_sku_groups.json`.

# Evidence Location
`evidence/sukirtha/SUK-R2-*.md` (4 files)

# Validation Result
PASS — `validation/sukirtha/SUK-R2-validation-report.md` (25/25 checklist
items).

# Owner
Sukirtha

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead — pending

# Status
Deployed, live, closed pending peer review and git push approval.

# Known Limitations
100-variants-per-product pagination cap on the live endpoint (no current
product approaches this); €0.00 compare-at values treated as populated,
not null (matches raw Shopify data).

# Duplicate-Truth Risk
Documented and disclosed to the requester before build — see
`evidence/sukirtha/SUK-R2-data-quality-summary.md`.

# Parent AIOS Candidate Status
Not promoted — reusable pattern flagged only.

# PASS / FAIL
PASS

# Next Step
Reviewer sign-offs, then git push on explicit approval.

---

## Update (2026-07-14, later same day) — Sajeepan sync + index.html counts + UI refinement

**Part A — completed and deployed:**
- Pulled `pages/sajeepan.html` (Requirement 1 — Google Ads PMax Product
  Intelligence Dashboard) from the Staff-requirements GitHub repo into this
  project.
- Moved Sajeepan from "Awaiting Requirements" to "Active Dashboards" in
  `index.html` (1 Report Live).
- Updated Sukirtha's own listing in `index.html` to "2 Reports Live"
  (Req1 + Req2).
- Recalculated all `index.html` header stats: Active Dashboards 9→10, Live
  Reports 28→30, Awaiting Requirements 3→2, Updated date bumped to
  2026-07-14.
- Deployed to Vercel production and verified live (200 OK, correct counts
  confirmed via curl).
- Committed and **pushed to GitHub** on explicit user instruction
  (`git push origin main`, commits `75e1651` and `667d917`), including the
  new `api/sukirtha-req2-duplicate-check.js` file.

**Part B — built, not yet deployed:**
- UI refinement round (Additional Listings filter, professional detail-
  panel layout, one-line live-updating summary cards) — see
  `evidence/sukirtha/SUK-R2-shopify-source-map.md` "Update" section for
  full detail. Built and locally validated only; not deployed to Vercel,
  not committed to git. Awaiting explicit deploy confirmation.

# Status (updated)
Requirement 2 core feature: live in production, pushed to GitHub.
Requirement 2 UI refinement round: built locally, pending deploy approval.
`index.html` member-directory updates: live in production, pushed to
GitHub.

# Files Modified (this update)
`reports/digital-marketing-member-pages/pages/sajeepan.html` (synced from
Staff-requirements), `reports/digital-marketing-member-pages/index.html`
(counts + Sajeepan promotion), `reports/digital-marketing-member-pages/pages/sukirtha.html`
(UI refinement, uncommitted).

# Next Step (updated)
1. User confirms "deploy" for the pending UI refinement round.
2. Commit + push that refinement once deployed and confirmed working.
