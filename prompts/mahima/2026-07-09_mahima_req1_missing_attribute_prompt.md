---
task: Mahima Req1 — "Missing Attribute" column, real Merchant Center / Google Ads product issues
date: 2026-07-09
---

## Instruction received

Implement Mahima Requirement 1 "Missing Attribute" column using the real Google Ads / Google
Merchant Center product issues (e.g. Missing Color, Missing Gender, Missing GTIN, Missing Brand,
Missing MPN, "Multiple: Color, Gender, Age Group", etc).

**Do not invent data.**

Discovery order mandated:
1. Search PostgreSQL (read-only) across `staging_ai`, `cppc_intelligence`, `public`, `raw_data`
   for columns like `issue`, `issues`, `product_issue`, `attribute_issue`, `missing_attribute`,
   `merchant_issue`, `disapproval_reason`, `policy_issue`, `diagnostics`, `product_status`.
2. If PostgreSQL has it, use that source.
3. If not, check for a Google Ads API / Merchant Center API connector.
4. If neither exists, **stop** and report that the requirement needs the Merchant Center
   Products API / Google Ads product status diagnostics, which are not connected.

Update only the Missing Attribute column in `reports/digital-marketing-member-pages/pages/mahima.html`
if and only if a real source is found. AIOS folders (prompts/evidence/validation/handover/reports/vercel)
under `mahima/` must be updated regardless of outcome.
