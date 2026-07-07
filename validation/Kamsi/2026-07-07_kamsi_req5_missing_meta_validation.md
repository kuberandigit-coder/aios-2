# Validation — Kamsi Requirement 5: Missing Meta Title & Meta Description Detection

**Title:** Validation checklist for Kamsi Req 5
**Purpose:** Confirm the task meets every stated validation requirement
**Requirement Source:** Kamsi Google Sheet sample / screenshot provided by Kuberan
**Business Question:** Which Shopify product pages are missing manually added SEO meta title or meta description?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only
**External Sources Checked:** None (GA4/GSC excluded)

| Check | Result |
|---|---|
| Existing assets checked | PASS — searched all `*/Kamsi/` folders and every existing HTML page; no prior meta-title/description report found |
| Duplicate risk documented | PASS — none found; documented in evidence file |
| Shopify connector used read-only | PASS — `bulkOperationRunQuery` (a query, not a mutation against product data); confirmed store `ledsone.co.uk` before pulling |
| All Shopify product pages included | PASS — 5,179 products, matching the full catalog size seen in prior Dilaksi/Kamsi Req2/Req4 work on the same store |
| Product pages only included | PASS — query scoped to `products` root field only, no other resource types |
| PostgreSQL not used as final source | PASS — not queried at all for this task |
| SEO title field captured correctly | PASS — `seo.title` from Shopify Admin GraphQL, spot-checked against raw JSONL |
| SEO description field captured correctly | PASS — `seo.description`, spot-checked |
| Product title captured correctly | PASS — `title` field |
| Product description captured correctly | PASS — `descriptionHtml`, HTML-stripped and normalized before comparison and display |
| Auto-generated meta title rule applied | PASS — normalized SEO title vs. normalized product title, case-insensitive |
| Auto-generated meta description rule applied | PASS — normalized SEO description vs. full normalized description AND vs. first-160-char normalized description |
| Action Needed condition applied correctly | PASS — ordered if/elif chain matching task's priority order exactly; tie-break behavior documented in evidence |
| Search works | PASS — filters against product title, page URL, and description (debounced 180ms, same fix pattern as Dilaksi Req2/Kamsi Req4) |
| Filters work | PASS — Collection Type dropdown, Action Needed dropdown, Missing Meta Title Yes/No/All, Missing Meta Description Yes/No/All, all combine with AND logic |
| Sorting works | PASS — click-to-sort on every column header, ascending/descending toggle with arrow indicator |
| CSV export works | PASS — client-side Blob download of the currently filtered/sorted dataset, all 10 required columns |
| Last updated timestamp added | PASS — max `updatedAt` across all products shown in page header |
| AIOS files saved | PASS — prompt, evidence, validation (this file), handover, vercel notes, plus the HTML report and data scripts |
| No deployment performed | PASS — no `vercel deploy` command run for this task |

## Data-integrity spot check
```
total products: 5179
Title states  -> blank: 848, auto: 6, ok: 4325
Desc states   -> blank: 1406, auto: 9, ok: 3764
Missing Meta Title: 854 | Missing Meta Description: 1415 | Both Missing: 795 | OK: 3705
```
KPI cards on the page match these exact figures (verified via `re.search` against the generated HTML).

## Table column completeness
Confirmed all 10 required columns present in both the CSV export and the on-page table: Page URL, Collection Type, Product Title, Product Description, Meta Title, Meta Description, Title Length, Description Length, Last Updated, Action Needed.

**Validation result:** PASS
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed — not deployed
**Known limitations:** carried over from evidence file (tie-break rule documented, archival copies of Req 1–3 not updated with new tab link, Collection Type tag-fallback lightly exercised)
**Next step:** Kuberan review; deployment approval if desired
**PASS / FAIL:** PASS
