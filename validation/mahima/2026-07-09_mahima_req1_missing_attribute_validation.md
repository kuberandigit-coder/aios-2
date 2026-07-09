---
task: Mahima Req1 — Missing Attribute column, real GMC/Google Ads product issues
date: 2026-07-09
---

## Validation checklist

| Check | Result |
|---|---|
| Searched PostgreSQL across staging_ai, cppc_intelligence, public, raw_data (and all other schemas) for issue/diagnostic columns | PASS — 127 candidate columns reviewed |
| Identified the authoritative table for real GMC product issues | PASS — `raw_data.gmc_product_diagnostics_daily` (issue_code/issue_description/issue_severity) |
| Confirmed that table's row count | 0 rows — empty |
| Checked alternate candidate tables (campaign-domain audits, passport, customer_requirement_extraction_pilot) for product-level attribute-issue fit | PASS — all rejected, wrong grain or wrong domain, documented with reasons |
| Checked live feed table `public.google_merchant_products` for the 12 required attributes as columns | PASS — only 4 of 12 exist as columns (brand, color, mpn, description); 8 of 12 (gender, age_group, gtin, size, size_type, size_system, material, pattern) do not exist anywhere in the database |
| Checked for Merchant Center / Google Ads API connector or credential tables | PASS — 0 found |
| Confirmed no fabrication: did not derive "Missing Gender/GTIN/etc." from absent columns | PASS |
| Confirmed no partial fabrication: did not derive "Missing Color/Brand/MPN/Description" from raw NULL-checks presented as real GMC diagnostics | PASS — rejected as not equivalent to Google's category-aware eligibility rules |
| HTML file `mahima.html` "Missing Attribute" column left unchanged | PASS — still shows "Data Missing" (accurate) |

## PASS / FAIL
**FAIL (by design) — task correctly stopped per explicit stop conditions.** No fabricated
data introduced. Evidence, prompt, and handover docs filed under `mahima/` for 2026-07-09.
