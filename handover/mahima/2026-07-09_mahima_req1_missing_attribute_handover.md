---
task: Mahima Req1 — Missing Attribute column, real GMC/Google Ads product issues
date: 2026-07-09
status: BLOCKED — pending real data source
---

## What was asked
Replace "Data Missing" in the Missing Attribute column of `mahima.html` with real values
(Missing Color, Missing Gender, Missing GTIN, "Multiple: Color, Gender, Age Group", "None", etc.)
sourced from actual Google Ads / Merchant Center product issue data. No invented data allowed.

## What was found
- The one Postgres table built to hold this exact data, `raw_data.gmc_product_diagnostics_daily`
  (issue_code / issue_description / issue_severity), is **empty (0 rows)**.
- No other table in Postgres holds product-level GMC attribute-issue diagnostics at the right
  grain — closest candidates are campaign/domain-level completeness audits, which are a
  different concept entirely.
- 8 of the 12 required attributes (gender, age_group, gtin, size, size_type, size_system,
  material, pattern) have **no column anywhere** in the database.
- The other 4 (brand, color, mpn, description) do exist as raw feed columns in
  `public.google_merchant_products`, but a simple NULL-check on those is not the same as
  Google's real Merchant Center eligibility diagnostic (which applies category-specific rules)
  and would misrepresent the data if labeled as a real "Missing Attribute" from Google Ads.
- No Merchant Center API or Google Ads API connector/credential exists in this Postgres
  instance.

## Decision
**Stopped per explicit stop conditions.** `mahima.html` was **not modified** — the Missing
Attribute column still correctly shows "Data Missing" for all 6,781 rows.

## What's needed to unblock
One of:
1. A working Merchant Center Products API connection (`productstatuses.list` /
   `productstatuses.get`), which returns real `itemLevelIssues` per product (this is the
   authoritative source for exactly this requirement), with a daily load job into
   `raw_data.gmc_product_diagnostics_daily`, OR
2. A Google Ads Product Status / Shopping Content API feed that surfaces the same
   `destinationStatuses`/`itemLevelIssues` data.

Until one of these is connected, this column cannot be populated with real (non-invented)
values. This is a data-source/API-access gap, not a coding gap — recommend escalating to
whoever owns Merchant Center API credentials for this account.

## Files touched this task
- `prompts/mahima/2026-07-09_mahima_req1_missing_attribute_prompt.md`
- `evidence/mahima/2026-07-09_mahima_req1_missing_attribute_evidence.md`
- `validation/mahima/2026-07-09_mahima_req1_missing_attribute_validation.md`
- `handover/mahima/2026-07-09_mahima_req1_missing_attribute_handover.md` (this file)
- `vercel/mahima/2026-07-09_mahima_req1_missing_attribute_vercel_notes.md`
- No changes to `reports/digital-marketing-member-pages/pages/mahima.html`
