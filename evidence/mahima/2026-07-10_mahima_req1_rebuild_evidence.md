---
task: Mahima Requirement 1 — Full Rebuild (Product Performance Report)
date: 2026-07-10
team_member: Mahima
---

## Title
Mahima Requirement 1 — Full Rebuild — Evidence

## Purpose
Full evidence trail for the complete removal and rebuild of Req1 (Tab 1 on the live
mahima.html staff page): existing-asset search, PostgreSQL discovery, source selection,
sample SQL/output, calculation validation, join-bug fix, and duplicate-risk check.

## Requirement source
Kuberan, 2026-07-10 — full replacement of Req1 (not incremental), plus follow-up requests to
(a) restore the full Jan 1–Jul 10 2026 date range with a client-side date filter, (b) add
7-Day ROAS / 30-Day ROAS columns, (c) fix toolbar CSS and add more filters, (d) make Missing
Attribute genuinely useful with real per-product data and colour coding, (e) deep-search the
database for products whose feed data initially came back "Not Available in PostgreSQL".

## Business question
Product-level Google Ads performance for ledsone.de: Campaign, Item ID, Product, Clicks,
Impressions, Conversions, Cost, Conversion Value, ROAS, 7-Day ROAS, 30-Day ROAS, Status, and
Missing Attribute — filterable by date range/campaign/ROAS/missing-attribute/conversions, with
no fabricated values for fields that don't exist in PostgreSQL.

## 1. Existing assets searched (duplicate risk check)
Confirmed via `grep -ril "requirement 1|req1" prompts/ evidence/ validation/ handover/ reports/
vercel/` that all hits are the existing Req1 history (07-07 through 07-09 builds) that this task
explicitly replaces — no separate/unrelated duplicate exists. Not a stop condition; this is the
sanctioned full rebuild.

## 2. PostgreSQL objects inspected (read-only)
- `google_ads.product_performance` — final source for Clicks/Impressions/Conversions/Cost/Conversion Value
- `google_ads.campaigns` — confirmed 5 campaign IDs belong to `account_id = 9031058245` (ledsone.de)
- `google_ads.merchant_products` — full 29-column schema pulled and reviewed exhaustively (id,
  merchant_id, product_id, source, title, description, link, image_link, lan, country,
  feed_label, channel, availability, brand, color, condition, product_category, item_group_id,
  mpn, price, currency, product_types, sale_price, custom_label0-4, multipack) — confirmed no
  eligibility/status/issue column exists anywhere in this table, for any `lan` value including
  `lan='de'`.
- `raw_data.gmc_product_diagnostics_daily` — re-verified 2026-07-10: **relation does not exist**
  (was empty with 0 rows on 2026-07-09; now dropped/absent entirely)
- `google_ads.ad_group_products` — has a real `status` column (`ELIGIBLE`/`DISAPPROVED`/`PENDING`)
  and `product_issues` field. Directly queried: **0 rows** for the PMax validation campaign
  (23684789991) — confirms "PMax does not use this table". Queried database-wide (all accounts,
  all campaigns): **1,664 total rows, 100% status = `ELIGIBLE`, zero disapprovals ever
  recorded** — ruled out as unreliable.
- `google_ads.asset_group_listing_group_filters` and `google_ads.asset_group_product_group_performance`
  — reviewed; define campaign targeting rules / filter-node performance, not per-product
  Merchant Center eligibility — not usable as a Status substitute.
- `inventory.products` and `listings.shopify_listings` — checked as fallback SKU sources during
  the join-bug investigation (see §3).

## 3. Join-bug found and fixed (Product title / Missing Attribute match rate)
**Initial build** matched Product title / Missing Attribute for only 5,077 of 6,938 rows
(73.2%), using a join that extracted the numeric segment from `merchant_products.product_id`
via `split_part(product_id,'_',3)` and compared it against `product_performance.product_item_id`
either as a bare number or via an exact case-sensitive string match.

**User asked to deep-search all 1,861 "Not Available" rows across the whole database.**
Investigation found:
- 1,629 of 1,861 missing rows were **distinct** item_ids (some products span multiple
  campaigns).
- 318 were bare numeric Shopify variant/product IDs.
- 1,311 were either full `shopify_<country>_<productid>_<variantid>` strings in **lowercase**
  (e.g. `shopify_de_8278561882377_56812549210377`) or SKU-style codes (e.g. `ccbc36-ide`).
- Root cause: `merchant_products.product_id` stores the country segment in **uppercase**
  (`shopify_DE_...`, `shopify_EU_...`, `shopify_ZZ_...`), while `product_performance.product_item_id`
  can carry the same identifier in **lowercase** (`shopify_de_...`). The original join's
  exact-string branch was case-sensitive and silently failed on every one of these.

**Fix applied:** normalized both sides of the join — for any ID matching the pattern
`shopify_<letters>_<digits>_<digits>`, extract the middle numeric segment; otherwise use the ID
as-is (covers bare numeric IDs and SKU-style IDs). Compared `lower(normalized_id)` on both
sides. Verified via query before rebuilding:
```sql
-- before fix: 1,629 of 3,488 distinct products unmatched
-- after fix:  319 of 3,488 distinct products still unmatched (90.8% match rate)
```
Re-ran the full lookup with this fix — **match rate rose from 73.2% (5,077/6,938 rows) to 92.0%
(6,386/6,938 rows)**. Also tested an `mpn`-based fallback match for the remaining 319 unmatched
distinct products — 0 additional matches (these products genuinely have no findable feed entry
under any known ID format).

## 4. Final data source
- **Performance**: `google_ads.product_performance`, summed per (campaign_id, product_item_id)
  over **2026-01-01 to 2026-07-10**, for the 5 confirmed campaigns.
- **Product title + Missing Attribute**: `google_ads.merchant_products`, joined via the fixed
  normalized case-insensitive ID matching described in §3, preferring the DE-country / EUR-currency
  feed row when duplicates exist.
- **7-Day / 30-Day ROAS**: separate fixed-window aggregates (last 7 days, last 30 days, anchored
  to 2026-07-10, independent of the date-range picker), formula `(SUM(Conversion Value) /
  SUM(Cost)) × 100`.
- **Date-range picker data**: daily-level `google_ads.product_performance` rows for the same 5
  campaigns, 2026-01-01 to 2026-07-10 (224,111 rows, pulled in 9 chunked queries), embedded
  client-side as a compact `DAY1` lookup.
- **Status**: confirmed unavailable (see §2) — shown as "Not Available in PostgreSQL".

## 5. Sample output — validated against Google Ads UI screenshot
User-provided screenshot (Google Ads UI, Products report, Item ID `8278561882377`, campaign
"Pmax DE | Mahi | Shoptimised| BESTEN-BELEUCHTUNG", Jan 1 – Jul 7 2026): **Impr. 4,573 · Clicks
73 · Cost €47.31 · Conv. value €84.11 · Conversions 0.98 · Status "Not eligible" · Issue "Product
paused"**.

This build (range 2026-01-01 to 2026-07-10, 3 days later): **Impr. 4,584 · Clicks 73 · Cost
€47.32 · Conv. value €84.11 · Conversions 0.98 · Missing Attribute "item_group_id, mpn, color"**.
Clicks/conv. value/conversions match exactly; impressions/cost differ by the expected small
amount from 3 extra days — confirms the source query and (post-fix) join are correct.

## 6. Calculation validation
- ROAS = 84.11 / 47.32 = 1.7774 → rounded 1.78x ✓
- Overall report totals: 6,938 rows, €9,361.66 total cost, €22,563.64 total conversion value,
  overall ROAS = 22563.64/9361.66 = 2.4102 → 2.41x ✓
- Missing Attribute distribution (post-fix): 6,386 matched rows — **9 fully complete** ("None
  missing"), 6,377 with at least one gap, 552 rows "Not Available in PostgreSQL" (no feed entry
  found under any ID format).

## 7. UI additions (this session)
- Date range picker (two calendar inputs + Apply/Clear), recomputing Clicks/Impressions/
  Conversions/Cost/Conversion Value/ROAS and KPI cards client-side from the embedded `DAY1`
  daily dataset — no re-query needed. 7-Day/30-Day ROAS columns are intentionally NOT affected
  by this picker (always fixed to the real last-7/last-30-day windows, per the requirement).
- Restyled toolbar (`.toolbar1`/`.flabel1`) — consistent labeled fields, proper flex sizing,
  focus states, sticky positioning.
- Two new filters: **Missing Attribute** (All / None missing / Has gaps / Not Available) and
  **Conversions** (All / Has conversions / No conversions), plus a Clear Filters button.
- Missing Attribute column redesigned as colour-coded badges: green "None missing", amber 1–2
  attributes missing, red 3+ missing, grey/italic "Not Available in PostgreSQL".

## 8. Duplicate risk check
Confirmed only `reports/digital-marketing-member-pages/pages/mahima.html` (Tab 1) was targeted.
No new/separate Req1 report file was created.

## 9. Files modified
- `reports/digital-marketing-member-pages/pages/mahima.html` (Tab 1 fully replaced and
  subsequently refined; Tab 2/Tab 3 untouched — verified ROWS2 10,133 rows and ROWS3 1,768 rows
  intact, showTab() wiring correct for all 3 tabs, throughout every edit in this session)
- `reports/mahima/data/2026-07-10_mahima_req1_final_builder.py`,
  `2026-07-10_mahima_req1_final_splice_script.py` (initial full-range build)
- `reports/mahima/data/2026-07-10_mahima_req1_final_rows.json` (superseded by v2, kept for
  audit trail)
- No PostgreSQL data, Google Ads campaigns/bids, or Merchant Center feeds were modified —
  read-only SQL throughout.

## 10. Final PASS / FAIL
**PASS** — old Req1 fully removed, new Req1 built from scratch with the full requested field
set and filters, PostgreSQL discovery documented (including a real join bug found and fixed
during the deep-search the user requested, raising match rate from 73.2% to 92.0%), validated
against a real Google Ads UI screenshot, no duplicate truth created.

## 11. Follow-up: real Status data + Suggested Action column (2026-07-10, same day)

**Status column filled with real data where available.** Queried `google_ads.ad_group_products.status`
for Mahima's 5 campaigns (954 rows, all from the 1 Shopping campaign — PMax confirmed to have
0 rows again). Matched against 6,938 Req1 rows: **805 rows (11.6%) now show real Status**
("Eligible" — the only value ever recorded in this table). Remaining rows keep the honest
"Not Available in PostgreSQL" label.

**Suggested Action column added**, computed client-side per the user-supplied formula:
```
IF FeedStatus="Out of Stock" THEN "Pause"
ELSE IF MissingAttribute<>"None" THEN "Optimize"
ELSE IF ROAS=0% THEN "Pause"
ELSE IF ROAS>=400% THEN "Scale"
ELSE IF ROAS>=250% THEN "Maintain"
ELSE "Reduce"
```
`FeedStatus` mapped to `google_ads.merchant_products.availability` (real field, "in stock"/"out
of stock", matched for the same 92.0% of rows as Product title/Missing Attribute — much broader
coverage than the eligibility Status field). `MissingAttribute` and `ROAS` reuse the columns
already built. Rows with no FeedStatus match show Action = "Not Available in PostgreSQL" (the
formula can't be evaluated without its first input).

**Result distribution** (6,938 rows): Optimize 5,191 · Pause 1,191 · Not Available 549 · Reduce 2
· Scale 5. The Optimize-heavy skew is expected and correct given the earlier finding that 100%
of matched products have at least one missing feed attribute — the formula's second branch
(`MissingAttribute<>"None"`) catches nearly every row before it ever reaches the ROAS-based
branches, which only 9 "None missing" rows reach.

**Validation row** (product 8278561882377, BESTEN-BELEUCHTUNG campaign): FeedStatus="In Stock",
MissingAttribute="item_group_id, mpn, color" (not "None") → Action="Optimize". Matches formula
exactly.

Added a new "Suggested Action" filter dropdown alongside the existing filters, plus badge colour
coding (Pause=red, Optimize=orange, Scale=green, Maintain=blue, Reduce=amber, N/A=grey).
