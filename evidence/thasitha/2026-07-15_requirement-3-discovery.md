---
title: Thasitha Requirement 3 — Campaign Product Overlap, CPC Inflation, Retention Analysis — Discovery Evidence
requirement_id: THASITHA-R3
date: 2026-07-15
status: STOPPED (discovery-only — no build performed)
---

## Purpose
Discovery evidence for Thasitha Requirement 3 (campaign product overlap /
CPC inflation / retention analysis), executed per the GPT-issued execution
brief pasted into this session on 2026-07-15. Documents why the task was
**stopped** at the mandatory discovery phase per the brief's own STOP
CONDITIONS, rather than built with invented assumptions.

## Team member / Department / Store
Thasitha / Google Ads / ledsone.de

## Requirement source checked
The GPT execution brief pasted directly into this session (verbatim, ~600
lines) is the only Requirement 3 source. No separate written requirement
document exists in `prompts/`, `evidence/`, or the `Staff-requirements`
GitHub repo — confirmed via repo-wide grep for "Requirement 3" scoped to
Thasitha (zero hits) before this session began.

## Existing assets checked (Step 1–8 of mandatory discovery)
- `prompts/`, `evidence/`, `validation/`, `handover/`, `reports/`,
  `vercel/` — grepped for: campaign overlap, SKU overlap, CPC inflation,
  auction conflict. Zero hits under `thasitha/`; one incidental hit in
  `reports/digital-marketing-member-pages/pages/hetheesha.html`
  (unrelated report, different staff member).
- `ledsone-aios-mcp` knowledge base — searched "campaign overlap", "CPC
  inflation", "SKU overlap", "auction conflict", "campaign passport",
  "truth registry", "product action queue" — **zero results for all
  seven terms.**
- `Staff-requirements` local folder — does not exist locally (GitHub-only
  repo, confirmed in a prior session on 2026-07-15).
- **Duplicate-truth risk: GREEN.** No prior Requirement 3 work, no
  existing overlap/CPC-inflation report of any kind exists anywhere in
  this AIOS repo or knowledge base. This is genuinely net-new work — no
  risk of creating a second source of truth.

## PostgreSQL environments inspected
Both approved environments were inspected (read-only, no writes made):
- `ledsone-aios-mcp` (knowledge base / schema docs)
- `ledsone-db-mcp` (live PostgreSQL query)

## PostgreSQL objects checked
- `google_ads.campaigns` — full campaign registry for `account_id = 9031058245` (ledsone.de): **196 total campaigns**, of which **15 currently ENABLED** (12 PERFORMANCE_MAX, 3 SHOPPING), 181 PAUSED/REMOVED.
- `google_ads.ad_group_products` — the only "current SKU eligibility" table in the database (status: ELIGIBLE/DISAPPROVED/PENDING). **1,664 rows total, all status=ELIGIBLE.**
- `google_ads.asset_group_listing_group_filters` — PMax's targeting-tree equivalent (SUBDIVISION/UNIT_INCLUDED/UNIT_EXCLUDED nodes).
- `google_ads.product_performance` — Date × Campaign × Product daily performance (10.1M rows), the only source with per-SKU-per-campaign cost/click/conversion history.
- `google_ads.merchant_products` — feed content (title/image/link/price/availability), no status field.
- Full `information_schema` view enumeration — **zero views exist anywhere in this database.**
- Confirmed absent by name search: any table/view matching `%registry%`, "campaign passport", "truth registry", "product action queue" — none of the candidate objects named in the execution brief exist under any name.

## Current-overlap source — BLOCKED (this is the stop trigger)

The execution brief requires: *"Include campaigns where the SKU is
currently eligible, assigned, or active according to the latest
trustworthy product-campaign mapping"* and explicitly forbids inferring
current assignment from historical performance rows alone.

Tested both candidate "current assignment" sources against the 15 active
ledsone.de campaigns:

1. **`ad_group_products` (Shopping/Search eligibility table)** — covers
   only **2 of the 3** active SHOPPING campaigns (`22539594891`,
   `23926509987`). The third active Shopping campaign
   (`23557913752`, "Mahi Target_ROAS_Experiment") has **zero** rows.
   This table has **zero rows for any of the 12 active PMax campaigns**
   — confirmed both by direct campaign_id filter (0 rows) and by schema
   documentation ("PMax has no ad groups — this table does not apply").

2. **`asset_group_listing_group_filters` (PMax targeting tree)** —
   across all 12 active PMax campaigns, only **2 distinct asset groups**
   have any `UNIT_INCLUDED` node with a specific `product_item_id` set.
   The overwhelming majority of PMax product targeting in this account
   is done by attribute/category/custom-label subdivision, not explicit
   per-product inclusion — so this table cannot serve as a per-SKU
   current-assignment list for PMax campaigns either.

**Conclusion: there is no reliable "SKU is currently assigned to
Campaign X" data source for 12 of the 15 active campaigns (all PMax),
and only partial coverage (2 of 3) for Shopping.** The only remaining
candidate — treating "appeared in `product_performance` within the last
N days" as a proxy for current assignment — is explicitly the kind of
guess the brief forbids ("Do not identify overlap only by... Do not
guess," and recency-of-performance is not the same as
eligible/assigned/active status; a paused listing group can still show
trailing performance rows, and a newly-added product can have zero rows
yet still be currently assigned).

## Baseline CPC / Inflated CPC source
Not evaluated — moot until current-overlap can be established, since the
brief requires CPC inflation only for genuinely-overlapping SKUs.

## Lifetime-performance source
`google_ads.product_performance` (Date × Campaign × Product grain, 10.1M
rows) is a defensible source for lifetime SKU+CampaignID performance
*once* a valid current-overlap SKU list exists — aggregation would be
`SUM(cost)`, `SUM(clicks)`, `SUM(conversions)`, `SUM(conversion_value)`
grouped by `(product_item_id, campaign_id)`, giving `CPC = cost/clicks`
and `ROAS = conversion_value/cost` per the brief's exact formulas. This
part of the brief is buildable — it's blocked only by the missing
current-overlap input.

## Decision
**STOP — per the brief's own STOP CONDITIONS:**
> "current SKU-to-campaign allocation cannot be proven" and
> "historical and current overlap cannot be separated"

Both conditions are met and proven above with live query evidence, not
assumption. No HTML was written or modified. No CPC inflation values
were calculated or invented. No deployment or git push occurred.

## Files created
- This file only:
  `evidence/thasitha/2026-07-15_requirement-3-discovery.md`

## Owner
Kuberan (AIOS) / Claude Code session — execution worker role only.

## Next step
Return this blocker to GPT (the planning/validation layer) per the
brief's instruction. GPT must decide one of:
1. Approve a documented proxy rule for "current assignment" (e.g.
   product_performance activity within the last N days), explicitly
   accepting the resulting AMBER/documented-limitation status, or
2. Request a new sync job be added to the AIOS pipeline against the
   Google Ads API's actual per-product PMax listing-group assignment
   data (would need engineering work outside this session's scope), or
3. Narrow Requirement 3's scope to Shopping campaigns only, where
   `ad_group_products` gives a partial but real current-eligibility
   source (2 of 3 active Shopping campaigns covered).
