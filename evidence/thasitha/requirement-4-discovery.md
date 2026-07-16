---
title: Thasitha Requirement 4 — Shopify Orders vs Google Ads Orders by SKU — Discovery Evidence
requirement_id: THASITHA-R4
date: 2026-07-16
status: STOPPED (discovery-only — no build performed)
---

## Purpose
Mandatory discovery for Requirement 4 per the GPT execution brief pasted
into this session on 2026-07-16. Documents why the task was stopped at
discovery rather than built with invented assumptions — same discipline
applied previously for [[requirement-3-discovery]] (R3 was also stopped
once at discovery, then resumed after clarification; discovery-first is
the established pattern for this project).

## Team member / Department / Store
Thasitha / Google Ads / ledsone.de

## Requirement source checked
1. **Expected path per brief:** `C:\Users\PC\OneDrive\Desktop\kuberan web\Staff-requirements\pages\thasitha.html`
   — **does not exist.** `find` across the entire AIOS root confirms no
   `Staff-requirements` folder exists anywhere in this repo.
2. **Authoritative requirement CSV** — the brief requires reading "Thasitha's
   authoritative requirement CSV" to confirm exact period labels. Searched:
   - `prompts/`, `evidence/`, `validation/`, `handover/`, `reports/`, `vercel/`,
     `closure/`, `docs/` — full-repo grep (case-insensitive) for "requirement 4",
     "req4", "orders (shopify)", "orders (ads)" — **zero hits.**
   - Full filesystem search for any `*thasitha*.csv` — **zero files found.**
   - `ledsone-aios-mcp` knowledge base search for "Thasitha" — **zero results.**
   - **No Thasitha requirement CSV exists anywhere in this project, for any
     requirement (R1, R2, or R3 included).** Confirmed by checking R1/R2/R3
     evidence files: all three were built from GPT/user briefs pasted directly
     into chat sessions, not from a CSV. This project has never used a CSV
     workflow for Thasitha's requirements — the CSV-first mandate in this
     brief does not match this project's actual established process.
3. **Actual live page:** `reports/digital-marketing-member-pages/pages/thasitha.html`
   (confirmed via `find`) — contains Requirements 1, 2, 3, all currently
   live and intact. This is the correct file to extend if/when R4 proceeds
   — the brief's "expected full path" is simply wrong for this repo.

## Existing assets checked (mandatory discovery steps 1–12)
- Checked `prompts/thasitha/`, `evidence/thasitha/`, `validation/thasitha/`,
  `handover/thasitha/`, `reports/thasitha/`, `vercel/thasitha/`, plus
  `closure/thasitha/` and `docs/` — no prior Shopify-vs-Ads order comparison,
  no SKU-order-count definition, no purchase-conversion-action definition
  exists for Thasitha or any other staff member in this repo.
- **Duplicate-truth risk: GREEN.** No prior R4 work exists anywhere. This
  would be genuinely net-new work with no risk of creating a second source
  of truth, provided it's added to the existing live `thasitha.html`.

## PostgreSQL environments inspected
Both approved environments inspected, read-only, no writes:
- `ledsone-aios-mcp` (knowledge base / schema docs)
- `ledsone-db-mcp` (live PostgreSQL query)

## PostgreSQL objects checked (see [[requirement-4-postgresql-source-map]] for full detail)
- `order_management.orders` — Shopify (and other-platform) order header:
  `id`, `order_id`, `status`, `order_date`, `sub_source_id`, `market_place`,
  `total`, etc. `status` has 7 distinct values: Cancelled, Completed, Deleted,
  Hold, Inprogress, New, Refunded — **no approved definition exists anywhere
  in this repo for which of these 7 statuses count as a "valid" order** for
  reporting purposes (this is the Shopify Order Definition blocker below).
- `order_management.order_item_info` — line-item grain: `item_sku`, `real_sku`,
  `item_quantity`, `order_id` FK. Confirmed usable for `COUNT(DISTINCT order_id)`
  per SKU.
- `order_management.source` / `sub_source` — resolves `sub_source_id` to
  platform name (`SHOPIFY`=id 3, `EBAY`=id 2, `AMAZON`=id 1, +14 others).
  Confirmed workable for platform filtering.
- `google_ads.product_performance` — `product_item_id`, `campaign_id`, `date`,
  `conversions` (numeric, fractional). **No `conversion_action` column or
  dimension anywhere on this table** — see [[requirement-4-order-definition]]
  for why this blocks the Ads Order Definition requirement.
- `google_ads.campaigns` — campaign name/id/status/type, reusable from R2/R3.
- **Zero tables anywhere in this database matching `%conversion%`** (confirmed
  via `search_objects` pattern search) — there is no conversion-action registry
  to filter "purchase" conversions from other conversion types.

## Thasitha SKU scope method
Reusable from R2/R3 (already validated, not a new blocker): `account_id =
9031058245` (ledsone.de), campaigns under `group_name = 'Thasi'` — currently
15 ENABLED campaigns (12 PMax, 3 Shopping) per R3 discovery. This scope
method is proven and does NOT need re-validation for R4.

## BLOCKERS (stop triggers)

1. **No authoritative requirement CSV exists** for Requirement 4 (or for
   any prior Thasitha requirement). The brief mandates reading exact period
   labels from a CSV and stopping if they can't be established this way.
   However, the user directly confirmed in this chat session (2026-07-16)
   the exact structure: `SKU | Selling Price | Shopify Orders (past 30
   days) | Ads Orders (past 30 days) | Shopify Orders (past 60 days) | Ads
   Orders (past 60 days) | Shopify Orders (past 90 days) | Ads Orders (past
   90 days) | Campaign name(s)` — and explicitly confirmed the sample SKUs
   in that message were dummy/placeholder values, not real data. **This is
   a real, user-confirmed source — just not a CSV file**, which conflicts
   with the brief's rigid "CSV or stop" instruction. Needs explicit sign-off
   that direct-chat confirmation is an acceptable substitute for a CSV,
   consistent with how R1/R2/R3 were actually approved in this project.

2. **Google Ads Order Definition cannot be proven.** `product_performance.conversions`
   is a single aggregate numeric column with no conversion-action dimension
   anywhere in the database. There is no way to confirm this column
   represents *only* "purchase"/ecommerce-order conversions rather than a
   blend of conversion actions (e.g. also including newsletter signups,
   phone calls, or other configured conversion goals in this Google Ads
   account). The brief explicitly requires this to be confirmed and
   explicitly forbids mixing non-order conversion actions. **This cannot
   be proven from the data available in this database.**

3. **Shopify Order Definition (valid-order rule) is not an approved,
   documented company rule.** `order_management.orders.status` has 7 raw
   values (Cancelled, Completed, Deleted, Hold, Inprogress, New, Refunded).
   No existing AIOS document defines which of these should count toward
   "Shopify Orders" for reporting (e.g., does "Hold" count? Is "Refunded"
   fully excluded, or only if 100% refunded — there's no partial-refund
   flag on this table to distinguish full vs partial). The brief explicitly
   forbids inventing this rule.

## Files created this pass
- [[requirement-4-shopify-vs-ads-orders-prompt]] (prompts/)
- This file (evidence/)
- [[requirement-4-original-column-mapping]] (evidence/)
- [[requirement-4-postgresql-source-map]] (evidence/)
- [[requirement-4-order-definition]] (evidence/)
- [[requirement-4-validation]] (validation/) — records the stop, not a build validation
- [[requirement-4-shopify-vs-ads-orders-report]] (reports/)
- [[requirement-4-handover]] (handover/)
- [[requirement-4-deployment-readiness]] (vercel/) — NOT READY

## Status
STOPPED. `pages/thasitha.html` (actual path:
`reports/digital-marketing-member-pages/pages/thasitha.html`) was NOT
modified. No deployment, no git push performed.

## Next step
Report blockers 1–3 above to the user/GPT for explicit resolution before
any implementation begins.
