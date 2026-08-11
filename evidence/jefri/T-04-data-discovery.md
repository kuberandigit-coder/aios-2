# Jefri T-04 — Data Availability & Source Discovery (DISCOVERY ONLY, no build)

**Title:** Parent Product ID based Google Ads + Shopify product performance analysis — data discovery
**Purpose:** Determine whether all data required for T-04 exists in approved PostgreSQL sources / AIOS assets, before any build work.
**Requester:** Jefri · **Team:** Google Ads / PPC · **Store:** ledsone.de (account_id 9031058245)
**Business question:** For selected Parent Product IDs and a date range, how much total store revenue did each product/variant generate, how much was attributed to Google Ads, how much Ads traffic/spend did it receive, and what % of revenue came from Ads? Must support parent-level rollup and variant-level detail.
**Date run:** 2026-08-11 · **Connection:** `ledsone-db-mcp` (read-only `dbhub_readonly` user) · **Mode:** SELECT/COUNT/DISTINCT only, no writes performed at any point.

---

## Phase 1 — Requirement source

No standalone "T-04" requirement file was found locally (`prompts/jefri`, `evidence/jefri`, `reports/jefri` all inspected — see file listing below). The requirement wording used here is taken verbatim from the discovery prompt itself, per instruction not to invent missing requirements. This matches the same general format/spec style as the requirement CSV referenced for Jefri Req1 (`What_I_Need_To_Improve_ADS_Performance - Jefri.csv`, see `evidence/jefri/2026-07-20_postgres-discovery.md`), but T-04 itself is not present in that file or anywhere else checked.

## Phase 2 — Existing AIOS asset discovery

Checked: `prompts/jefri`, `evidence/jefri`, `validation/jefri`, `handover/jefri`, `reports/jefri`, `vercel/jefri`, plus `reports/digital-marketing-member-pages/pages/jefri.html` and `api/requirement.js`.

| Asset | What it does | Relevant to T-04? |
|---|---|---|
| `evidence/jefri/2026-07-20_postgres-discovery.md` | Original Req1 discovery — proves `google_ads.product_performance`, `listings.shopify_listings`, `listings.shopify_listings_parent_child_mapping`, identifier-format handling (raw ID vs `shopify_de_<parent>_<variant>`) | **Yes, directly reusable** — same identifier-mapping mechanics apply to T-04 |
| `jefriProductStatusHandlerModule` (Req1) | Product status labels (Hero/Villain/Zombie/Sidekick-style), stock, price — Ads-only + live Shopify stock, **no Shopify sales/revenue** | Partial overlap (product↔listing resolution pattern reusable), no duplicate business question |
| `jefriSearchTermsHandlerModule` (Req2) | Search-term level Ads performance (clicks/cost/conv value), **no Shopify sales, no parent rollup** | No overlap |
| Req3 (3-period comparison) | Ads product performance across 3 periods, **no Shopify sales** | No overlap |
| `jefri.html` | Confirmed via grep: no "Total Sales", "Shopify Sales", or `order_item_info` reference anywhere on the page | No existing page answers T-04's business question |

**Grep result** (`Total Sales|Shopify Sales|order_item_info|Sales \(Store\)` in `jefri.html`): **0 matches.**

## Phase 3 — PostgreSQL read-only discovery

Connected via `ledsone-db-mcp`. All statements below are `SELECT`/`information_schema` lookups only — no INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/TRUNCATE was issued at any point in this session.

## Phase 4 — Shopify product sales source

**Table:** `order_management.orders` joined to `order_management.order_item_info`.

`order_management.orders` columns (16 total, relevant): `id, order_id, status, order_date, sub_source_id, market_place, total, sub_total, shipping_cost, tax, discount`.

`order_management.order_item_info` columns (24 total, relevant): `order_id, line_item_id, product_id, variant_id, handle, item_sku, item_title, item_price, item_quantity, real_sku, real_price, real_qty`.

**LEDSone DE Shopify sub_source_id confirmed:**
```sql
SELECT ss.id, ss.name, s.source_name FROM order_management.sub_source ss
JOIN order_management.source s ON s.id=ss.source_id
WHERE s.source_name='SHOPIFY' AND ss.name ILIKE '%de%';
```
→ `sub_source_id = 108`, `name = 'ledsone-de'` (also confirmed distinct from UK=200/104, US=245).

**Order status distribution** (`sub_source_id=108`):
| status | count |
|---|---|
| Completed | 16,949 |
| Refunded | 531 |
| Inprogress | 22 |
| Cancelled | 17 |
| New | 3 |

Filtering `status='Completed'` naturally excludes Refunded/Cancelled/Inprogress/New — matches the existing site-wide convention already used in `api/members-api.js` (`status='Completed'`, and elsewhere `status NOT IN ('Canceled','Cancelled','Refunded','Deleted')`).

**Field completeness** (Completed DE lines since 2025-05-12, Ads data start date): `product_id`, `variant_id`, `item_sku` — **0 NULLs / 0 blanks** out of 13,032 line items. Fully populated, safe to aggregate.

**Revenue definition — TWO candidate definitions exist on this codebase, NOT the same number:**

1. **Gross, per-line-item, Postgres-based** (proven here): `SUM(item_price::numeric * item_quantity::numeric)` WHERE `status='Completed'`. This is the same pattern already used in `api/members-api.js` for other Shopify revenue queries. Does not separately subtract tax/discount at line-item grain (those live only on the order header, `orders.tax`/`orders.discount`, not per line item).
2. **"netSales" (excl. tax), live-Shopify-GraphQL-based** (different data path, proven for a different store/page — Dilaksi UK, `fetchDilaksiSalesLive()` in `requirement.js`): `discountedTotalSet - taxLines`, per line item, via live Shopify Admin GraphQL `orders` query — a 30-day rolling live pull, not a Postgres query, and confirmed used elsewhere with the label "Net Sales" (per stored project memory: "Organic = ... matches Net Sales already used on salesuk.html").

**These two definitions are NOT interchangeable** and were not tested against each other for the same product/period in this session. **NEEDS REVIEW: which "Total Sales (Store)" definition T-04 should use — gross Postgres line-item revenue, or net-of-tax live-Shopify revenue.** Not invented here; flagged for decision.

## Phase 5 — Parent → Variant → SKU relationship

**Tables:** `listings.shopify_listings` (`item_id, sku, is_parent, is_child, all_list, channel, shopify_handle, title`) + `listings.shopify_listings_parent_child_mapping` (`parent_id, child_id` — both reference `shopify_listings.id`, the internal integer PK, **not** `item_id`).

Real sample proof (channel='LEDSone DE'):
```sql
SELECT p.item_id AS parent_product_id, p.shopify_handle, c.item_id AS variant_id, c.sku
FROM listings.shopify_listings p
JOIN listings.shopify_listings_parent_child_mapping m ON m.parent_id = p.id
JOIN listings.shopify_listings c ON c.id = m.child_id
WHERE p.channel='LEDSone DE' AND p.is_parent=1
ORDER BY p.item_id LIMIT 8;
```
→ Parent `10020182327561` ("Vintage Pendelleuchte 2 Kopf...") resolved to 8 real child variants (`50147181854985`/SKU `ENC7316`, `50147181887753`/SKU `ENC4304`, etc.) — proven, not assumed.

- All variants under a parent ARE automatically discoverable (via the mapping table).
- A product CAN have multiple variants (proven, 8 in this example).
- Parent listing rows have `sku IS NULL` by design (SKU lives only on child rows) — confirmed in the earlier Req1 discovery and re-confirmed here.
- Archived/deleted-product effect on the relationship: **not tested in this session** — flagged as untested, not "confirmed clean."

## Phase 6 — Google Ads product data source + Item ID meaning

**Table:** `google_ads.product_performance`. Columns: `product_item_id, parent_id, variation_id, merchant_id, campaign_id, ad_group_id, date, impressions, clicks, conversions, conversion_value, cost, ctr, avg_cpc`.

**Important finding: `parent_id` and `variation_id` columns exist but are NOT usable.** Tested across all 155,661 rows for Jefri's 5 campaigns (last 90 days): `variation_id` is **NULL on 100% of rows**, and `parent_id` **always equals `product_item_id`** (0 rows differ). These two columns carry no real parent/variant signal for this account — do not use them as the mapping mechanism.

**Actual mapping mechanism (same as proven in the 2026-07-20 Req1 discovery, re-verified here):** `product_item_id` is either a raw Shopify ID (product OR variant — distinguished only by joining to `listings.shopify_listings.is_parent`/`is_child`) or the Merchant Center format `shopify_de_<parent>_<variant>` (trailing segment extracted via `split_part`).

**Distinct item ID length distribution** (Jefri's 5,021 distinct `product_item_id` values, last 90 days):
| ID length | Count |
|---|---|
| 0 (blank) | 1 |
| 13 | 438 |
| 14 | 3,342 |
| 16–20 | 1,240 |

13–14 digit IDs (3,780, ~75%) are real Shopify product/variant IDs. **The 1,240 IDs of 16–20 digits are NOT real Shopify identifiers** — confirmed by join failure (see Phase 7) and confirmed to be concentrated entirely in one campaign.

## Phase 7 — Shopify ↔ Google Ads join validation

```sql
-- resolved.shopify_id = product_item_id, or split_part(...) for merchant-center format
LEFT JOIN listings.shopify_listings sl ON sl.item_id = r.shopify_id AND sl.channel='LEDSone DE'
```

| Metric | Count | % of 5,021 |
|---|---:|---:|
| Total distinct Jefri item IDs (last 90d) | 5,021 | 100% |
| Matched a **parent** listing row | 736 | 14.7% |
| Matched a **child/variant** listing row | 3,043 | 60.6% |
| **No match at all** | 1,242 | **24.7%** |

**Unmatched-ID root cause proven, not guessed:** all 1,242 unmatched IDs are 17–20 digits long (real Shopify IDs are 13–14 digits) and are confined **entirely to one campaign**: `23411228109` ("Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26"). Their weight in that campaign is non-trivial: 531 clicks / €138.95 cost / €658.44 conversion value out of that campaign's totals (2,289 clicks / €628.83 cost on matched IDs) — **~19% of that campaign's clicks are on unmatchable IDs.** These are very likely Google's own internal listing-group/asset-group identifiers for a catalog-wide "All Products" PMax target rather than per-product Merchant Center item IDs — not proven further in this session, flagged as a genuine gap, not invented.

**Join Validation Matrix**

| Shopify Field | Google Ads Field | Match Method | Match Rate | Unmatched Count | Risk |
|---|---|---|---:|---:|---|
| `shopify_listings.item_id` (parent or child) | `product_item_id` (direct, or Merchant Center format parsed) | Exact string match after optional `split_part` extraction | **75.3%** (3,779 / 5,021) | 1,242 | **AMBER** — real, quantified gap confined to one campaign's catalog-wide targeting; not a general join failure |

## Phase 8 — Date range validation

| Source | Min date | Max date |
|---|---|---|
| `google_ads.product_performance` (Jefri's 5 campaigns) | 2025-05-12 | 2026-08-11 (today) |
| `order_management.orders` (sub_source_id=108, ledsone-de) | 2020-10-16 | 2026-08-11 (today) |

Both sources are current through today. Ads data begins 2025-05-12 (campaign start, previously documented) — any T-04 start date earlier than that will show 0 Ads rows for the ads side, real absence not a bug (Shopify sales for that earlier period are still fully available). `date BETWEEN start AND end` (Ads, `date` is already a plain date column) and `order_date::date BETWEEN start AND end` (Shopify) both filter correctly without off-by-one risk (checked column types: `product_performance.date` = `date`, `orders.order_date` = `timestamp without time zone`, cast to `::date` before comparing).

## Phase 9 — Calculation validation (real numbers, not synthetic)

Tested for the 3 highest-conversion-value products in Jefri's campaigns, 2026-05-01 to 2026-08-11:

| Product ID | Clicks | Impr. | Ads Cost | Ads Sales | Total Sales (Store, gross) | ROAS | Ads Sales % |
|---|---:|---:|---:|---:|---:|---:|---:|
| 5481828778151 (parent) | 1,329 | 67,512 | €410.87 | €2,174.51 | €1,243.54 | **529.3%** | **174.9%** |
| 5935504687271 (parent) | 1,663 | 117,936 | €389.91 | €981.11 | €850.49 | 251.6% | **115.4%** |
| 41149538107559 (parent) | 678 | 54,588 | €299.56 | €949.86 | **€0.00** | 317.1% | **undefined (÷0)** |

ROAS formula `(Ads Sales / Ads Cost) × 100` computes cleanly and matches expectation for all 3 (no ambiguity in that formula itself).

**CRITICAL FINDING — this is systemic, not a one-off:** Ads Sales exceeds Total Store Sales for **all 3** of the top products tested (two by 15–75%, one has real Ads-attributed revenue against **zero** completed Shopify orders in the same window for that exact product). This means "Ads Sales % of Total Sales" routinely exceeds 100% or is undefined, using these two sources as currently understood. Not invented, not a query bug (both source totals were pulled independently and directly, not derived from each other) — this is a genuine mismatch between Google Ads' own conversion-value attribution (which can use extended click-through windows, cross-device modeling, or count value from touches that don't map 1:1 to a single Postgres-recorded completed order in the exact same window) and the Postgres "Completed order, this exact date range" revenue figure.

**Zero/null handling — not yet a business decision, flagged NEEDS REVIEW:**
- Ads Cost = 0 → ROAS undefined (existing codebase convention elsewhere, e.g. Req6, is to show 0% when cost=0 — but see the null-cost vs real-zero distinction documented in Thasitha R6's evidence; the *same* care needed here).
- Total Sales = 0 with Ads Sales > 0 (proven to occur, see table above) → Ads Sales % is mathematically undefined (÷0), not 0% and not 100% — needs an explicit product decision (show N/A? cap? flag as anomaly?).
- Ads Sales = 0 → ROAS = 0%, Ads Sales % = 0% (unambiguous).
- Missing Google Ads row for a real Shopify variant (proven possible — 1,242 unmatched IDs) → that variant would show Total Sales only, Ads columns blank/0, not silently omitted from the report.
- Missing Shopify row for a real Ads item (not tested for the reverse direction in this session) → flagged untested.

**Parent rollup validated via direct SUM, not average** — mechanically trivial once variant-level rows are correct (SUM of variant Total Sales/Ads Sales/Clicks/Impressions/Cost, then Parent ROAS/Ads Sales % recomputed from the summed totals, exactly as specified). Not independently re-derived with a second live example in this session due to time; the underlying arithmetic is standard SUM/aggregate, low risk.

## Phase 10 — Duplicate truth risk

**GREEN.** No existing Jefri page or AIOS asset combines Shopify Total Sales with Google Ads performance at product/variant/parent level (confirmed via grep across `jefri.html` and all of `evidence/jefri`, `reports/jefri`). Req1/Req2/Req3 are all Ads-only (plus live Shopify *stock*, not sales, for Req1). No conflicting business logic found.

## Phase 11 — Data Availability Matrix

| Requirement Field | Required? | PostgreSQL Source | Table/View | Column | Available? | Join Required? | Date Filter? | Evidence | Risk |
|---|---|---|---|---|---|---|---|---|---|
| Parent Product ID | Yes | `ledsone` | `listings.shopify_listings` | `item_id` (where `is_parent=1`) | Yes | — | No | Phase 5 sample | Low |
| Variant/Product ID | Yes | `ledsone` | `listings.shopify_listings` | `item_id` (where `is_child=1`) | Yes | Via `shopify_listings_parent_child_mapping` | No | Phase 5 sample | Low |
| SKU | Yes | `ledsone` | `listings.shopify_listings` | `sku` | Yes (child rows only — parent rows NULL by design) | Same mapping | No | Phase 5 sample | Low |
| Total Sales | Yes | `ledsone` | `order_management.orders` + `order_item_info` | `item_price × item_quantity` (status filter) | Yes, but **definition ambiguous** (gross vs net) | Join `orders.id = order_item_info.order_id` | Yes, `order_date::date` | Phase 4/9 | **AMBER — needs decision** |
| Ads Sales | Yes | `ledsone` | `google_ads.product_performance` | `conversion_value` | Yes | — | Yes, `date` | Phase 6/9 | Low (field itself is clean; see mismatch finding) |
| Ads Clicks | Yes | `ledsone` | `google_ads.product_performance` | `clicks` | Yes | — | Yes | Phase 6/9 | Low |
| Ads Impressions | Yes | `ledsone` | `google_ads.product_performance` | `impressions` | Yes | — | Yes | Phase 6/9 | Low |
| Ads Cost | Yes | `ledsone` | `google_ads.product_performance` | `cost` | Yes | — | Yes | Phase 6/9 | Low |
| ROAS | Derived | — | (Ads Sales / Ads Cost) × 100 | — | Formula validated | — | — | Phase 9 | Low (formula), **AMBER** (0-cost handling undecided) |
| Ads Sales % | Derived | — | (Ads Sales / Total Sales) × 100 | — | Formula validated but **produces >100% / undefined values with real data** | — | — | Phase 9 | **RED-leaning — needs explicit business decision before build** |

**Join Validation Matrix** — see Phase 7 table above (reproduced): `shopify_listings.item_id` ↔ `google_ads.product_item_id`, 75.3% match rate, 1,242 unmatched (24.7%), concentrated in one campaign's catalog-wide PMax targeting.

## Phase 12 — Existing Asset Matrix

| Existing Asset | Location | What It Does | Reusable? | Duplicate Risk | Recommendation |
|---|---|---|---|---|---|
| Req1 identifier-mapping logic (`jefriProductStatusHandlerModule`) | `api/requirement.js` (~line 9) | Resolves `product_item_id` → Shopify listing (parent/child, Merchant Center format parsing) | Yes | None | **REUSE** the exact identifier-resolution CTE pattern |
| `2026-07-20_postgres-discovery.md` | `evidence/jefri/` | Documents the same source tables T-04 needs (partially) | Yes | None | **REUSE** as the base discovery reference |
| Dilaksi's live-GraphQL netSales pattern (`fetchDilaksiSalesLive`) | `api/requirement.js` (~line 3181) | Alternate "net sales" definition via live Shopify Admin API, different store | Only as a reference for the netSales-vs-gross decision | None (different store) | **NEEDS REVIEW** — cite as the precedent for the "net" definition, do not reuse code directly (wrong store/scope) |
| Req2/Req3 (search terms, 3-period comparison) | `api/requirement.js`, `jefri.html` | Ads-only reporting, no Shopify sales | No overlap | None | N/A |

---

## Missing data / unmatched data (summary)

- **1,242 of 5,021 Google Ads item IDs (24.7%)** cannot be matched to any Shopify listing — confined to one campaign, non-trivial share of that campaign's clicks (~19%). Root cause identified (non-Shopify-format long IDs) but not further resolved.
- **Total Sales definition is ambiguous** — two non-equivalent definitions exist in the codebase (gross Postgres line-item vs net-of-tax live Shopify), never tested against each other for the same product.
- **Ads Sales can exceed Total Store Sales**, including a case of real Ads spend/conversion value against **zero** Shopify sales for the same product/window — proven with 3 real products, not a one-off.
- Parent/child relationship's behavior for archived/deleted products was **not tested** in this session.

## Known limitations

1. `parent_id`/`variation_id` columns on `google_ads.product_performance` are dead weight for this account (always NULL / always equal to `product_item_id`) — must not be used as the parent/variant signal.
2. The unmatched 24.7% of Ads item IDs likely represent Google's own catalog-level listing-group IDs for one specific "All Products" PMax campaign, not real per-product identifiers — needs further investigation if that campaign is in scope for T-04.
3. Ads Sales vs Total Sales mismatch is a genuine cross-source attribution difference (Google's own attribution model vs a fixed Postgres order-date window) — not something a SQL fix alone can resolve; needs a business decision on how to present it (cap %, flag as anomaly, show raw even if >100%, etc).

## Recommendation

**Architecture (once the two AMBER/RED items are resolved):** reuse the exact Req1 identifier-resolution CTE (raw ID / Merchant Center format / parent-child fallback) to build the Parent→Variant→SKU rows, LEFT JOIN `google_ads.product_performance` (date-filtered) for the Ads columns, LEFT JOIN a Total-Sales sub-aggregate over `order_management.orders`+`order_item_info` (date-filtered, `sub_source_id=108`, `status='Completed'`) for the Shopify column, computed at variant grain, then SUM-rolled-up to parent grain in application code (not SQL `GROUP BY ROLLUP`, to keep the "never average" rule explicit and auditable).

**Recommended next step:** do **not** build yet. Two items need an explicit decision from Kuberan/GPT before implementation:
1. Which "Total Sales (Store)" definition to use (gross Postgres line-item vs net-of-tax) — pick one, document it, and note it will differ from other pages that already show netSales elsewhere.
2. How to handle Ads Sales % of Total Sales when it exceeds 100% or divides by zero — this is not a rare edge case, it appeared in 3/3 real top products tested.

## Evidence path
This file: `evidence/jefri/T-04-data-discovery.md`

## Validation path
`validation/jefri/T-04-data-availability-validation.md`

## PASS/FAIL

**Conditional PASS for discovery completeness** (all 12 phases executed, every required field has a proven source or a clearly documented gap, Parent→Variant relationship proven with real data, Shopify↔Google Ads join proven and quantified, date filtering proven for both sources, duplicate truth is GREEN, calculations validated with real numbers). **FAIL for "ready to build"** — two items (Total Sales definition ambiguity; Ads Sales % >100%/÷0 behavior) are unresolved business decisions per the stop conditions ("Shopify sales definition is unclear," "source data has material mismatch") and must not be invented. Do not build until these are decided.
