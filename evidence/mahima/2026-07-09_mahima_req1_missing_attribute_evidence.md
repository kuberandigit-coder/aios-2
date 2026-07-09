---
task: Mahima Req1 — Missing Attribute column, real GMC/Google Ads product issues
date: 2026-07-09
status: STOPPED — no real source exists
---

## Purpose
Determine whether PostgreSQL (or a connected Google Ads / Merchant Center API) holds real
product-level attribute-issue data (Color, Gender, Age Group, GTIN, Brand, MPN, Size, Size
Type, Size System, Material, Pattern, Description) so the "Missing Attribute" column in
`mahima.html` can be populated with real values instead of "Data Missing".

## 1. PostgreSQL column search (all schemas)
Query:
```sql
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE ANY (ARRAY['%issue%','%missing_attribute%','%disapprov%',
  '%policy_issue%','%diagnostic%','%product_status%','%attribute_issue%'])
ORDER BY table_schema, table_name, column_name;
```
127 matching columns returned across `cppc_intelligence`, `cppc_staff_ui`, `daily_task`,
`growth_protection_engine`, `ph_action_board`, `raw_data`, `staging_ai`, `wayfair_catalog`.
Full result list saved in session transcript. The only column set that is actually named for
Merchant Center product-level diagnostics is:

- `raw_data.gmc_product_diagnostics_daily` — columns `issue_code`, `issue_description`, `issue_severity`

## 2. Tables inspected in detail

| Table | Rows | Relevant? | Finding |
|---|---|---|---|
| `raw_data.gmc_product_diagnostics_daily` | **0** | Yes — this IS the correct table for real GMC product issues | Completely empty. Re-confirmed 2026-07-09 (previously confirmed empty on 2026-07-08/09 in `reports/mahima/2026-07-09_postgres_developer_request_feed_status_missing_attribute.md`). |
| `staging_ai.cppc_pmax_campaign_digital_twin_enrichment_gap_v1` | 95 | No | Campaign-level "domain intelligence" completeness audit (e.g. "Campaign Metadata" domain missing_attribute_count), not product-level GMC attribute issues. Owner=Mahima but wrong grain. |
| `staging_ai.cppc_pmax_domain_enrichment_opportunity_v1` | 95 | No | Same source family as above, campaign-domain grain. |
| `staging_ai.cppc_pmax_campaign_digital_twin_rows_v1` | 193 | No | `merchant_center_issue` column exists but only two distinct values in the whole table: `NULL` and the literal string `'no_disapproval_or_diagnostics_source'` — i.e. this table itself documents that no diagnostics source exists. |
| `staging_ai.cppc_pmax_campaign_passport_v1` | 47 | No | `merchant_product_status` present but campaign-passport grain, not per-product attribute issue. |
| `staging_ai.customer_requirement_extraction_pilot` | 100 | No | `missing_attributes_json` relates to customer-service message parsing pilot, unrelated domain (not PPC/GMC). |
| `staging_ai.google_feed_field_discovery_v1` | 17 | Supporting evidence only | Field-existence audit (2026-06-11) confirms `gtin`, `mpn`, `brand`, `product_type`, `google_product_category`, `custom_label_0..4` did not exist/were empty in the `ppc_performance` source at that time (`issue_status = DATA_MISSING_SHOULD_EXIST` / `EMPTY_0PCT`). |

## 3. Direct feed table check — `public.google_merchant_products`
This is the live GMC feed export table (used previously for the "Google Ads Product Status
(proxy)" column). Columns present: `product_id, source, title, description, link, image_link,
lan, country, feed_label, channel, availability, brand, color, condition, product_category,
item_group_id, mpn, price, currency, product_types, sale_price, custom_label0-4, multipack`.

- 498,727 total rows.
- Attributes from Mahima's required list that DO exist as columns here: `brand`, `color`,
  `mpn`, `description` (partial set only).
- Attributes from Mahima's required list that DO NOT exist as columns anywhere in the
  database (checked via `information_schema.columns` across all schemas): `gender`,
  `age_group`, `gtin`, `size`, `size_type`, `size_system`, `material`, `pattern`.
- Null/blank counts for the 4 columns that do exist: `color` 298,436 blank, `mpn` 381,642
  blank, `description` 66,303 blank, `brand` 906 blank (out of 498,727).

**Why this table was not used as the source:** a simple NULL-check on 4 of 12 required
attributes is not equivalent to Google's own Merchant Center policy diagnostics (which apply
category-specific rules — e.g. gender/age_group are only required for apparel items — and
which also cover disapprovals unrelated to blank fields, e.g. policy violations). Deriving
"Missing Gender" or "Missing GTIN" would be **inventing data** for 8 of the 12 required
attributes, since those columns don't exist in Postgres at all, and asserting "Missing Color"
from a raw NULL check without Google's own eligibility rules would misrepresent GMC's actual
diagnostic for the remaining 4. This fails the "DO NOT INVENT DATA" instruction.

## 4. API / connector search
```sql
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_name ILIKE '%merchant_center%' OR table_name ILIKE '%google_ads_connector%'
   OR table_name ILIKE '%api_connection%' OR table_name ILIKE '%api_credential%';
```
Result: **0 rows.** No Merchant Center API or Google Ads API connector/credential table
exists in this database.

## Join keys evaluated
`product_id` (format `shopify_de_<product>_<variant>`) is the common key between
`public.google_merchant_products.product_id` and the `ROWS[].i` field already used in
`mahima.html` for the Google Ads Product Status (proxy) column — same key family confirmed
usable, but moot since no real issue source exists to join to it.

## Products matched / unmatched
Not applicable — no source table contains real Merchant Center product-issue data to match
against the 6,781 product rows in the report (0 of 6,781 can be populated with real values).

## Source selected
**None.** Stop condition triggered.

## PASS / FAIL
**FAIL — STOP.** Per explicit stop conditions: "Missing attributes are unavailable in
PostgreSQL" (true — `raw_data.gmc_product_diagnostics_daily` is empty, 0 rows) and "Merchant
Center API is not connected" (true — no connector/credential table exists). No change made to
`mahima.html`; the "Missing Attribute" column remains "Data Missing", which is the accurate,
non-fabricated value.
