---
task: Thasitha Requirement 1 — Campaign Performance & ROAS Action
date: 2026-07-10
team_member: Thasitha
---

## Title
Thasitha Requirement 1 — PostgreSQL Source Map

## Purpose
Document every PostgreSQL object inspected, per-field suitability decisions, and the final
chosen source.

## Requirement source
GPT execution brief, 2026-07-10

## Team member / Team / Store
Thasitha / Google Ads / ledsone.de

## PostgreSQL environments checked
1. `ledsone-aios-knowledge-base` (MCP: `ledsone-aios-mcp`) — schema documentation search
2. `ledsone-db` (MCP: `ledsone-db-mcp`) — live read-only SQL queries and `search_objects`
   introspection

Both approved environments were used together: knowledge-base first to locate candidate
fields, then live DB to verify actual current values.

## Candidate objects inspected

### google_ads.campaigns
- **Database**: ledsone-db (PostgreSQL) · **Schema**: google_ads · **Object type**: table
- **Row grain**: one row per campaign (current state, not historical)
- **Campaign ID field**: `campaign_id` (bigint)
- **Campaign name field**: `campaign_name`
- **Reporting date field**: N/A (not a performance table) — has `start_date`
- **Cost field**: N/A
- **Conversion value field**: N/A
- **Conversion-count field**: N/A
- **Budget field**: `budget` (numeric, "Daily budget in account currency") ✓ used
- **Tag/label field**: none explicit. `feeds` (varchar, documented as "Merchant feed country
  codes linked to this campaign e.g. GB, US") — used as best-available Tags source, with
  caveat (see below)
- **Status field**: `campaign_primary_status`, `campaign_status`
- **Owner/staff field**: `group_name` (varchar, "Internal campaign group name") — **confirmed
  real, explicit ownership field.** ✓ used for campaign scope
- **Store/country/source field**: `account_id` (join to `accounts.account_id`, confirmed
  `9031058245` = ledsone.de, EUR)
- **Latest available date**: N/A (not time-series)
- **Duplicate-row risk**: none — `campaign_id` unique per row
- **Suitability decision**: SELECTED for ownership (`group_name`), Tags (`feeds`, caveated),
  Daily Budget (`budget`)

Full 20-column schema retrieved via `search_objects` (detail_level=full) and reviewed in
full — no other candidate tag/owner columns exist on this table.

### google_ads.campaign_performance
- **Database**: ledsone-db · **Schema**: google_ads · **Object type**: table
- **Row grain**: one row per (date, campaign_id) — **UNIQUE constraint confirmed**
  (`campaign_performance_date_campaign_id_unique`)
- **Campaign ID field**: `campaign_id`
- **Reporting date field**: `date`
- **Cost field**: `cost` (float, "Total cost in account currency — use this for human-readable
  spend values"; `cost_micros` also exists as the raw API value, NOT used)
- **Conversion value field**: `conversion_value` (float, "Total conversion value in account
  currency") — **confirmed monetary**, not a count
- **Conversion-count field**: `conversions` (float, separate field, a count — distinct from
  conversion_value) — this resolves the brief's "verify conversion value vs count" requirement
  definitively: two separate, clearly-typed fields exist, no ambiguity
- **Budget field**: N/A (see campaigns.budget)
- **Tag/label field**: N/A
- **Status field**: N/A (see campaigns table)
- **Owner/staff field**: N/A (see campaigns table)
- **Store/country/source field**: via join to `campaigns.account_id`
- **Latest available date**: 2026-07-10 (confirmed via `max(date)` query)
- **Duplicate-row risk**: none — unique index on (date, campaign_id)
- **Suitability decision**: SELECTED — this is the campaign-level daily performance source
  for Cost, Conversion Value, and Active Days

### Other objects considered and ruled out
- `public.ppc_etl_performance_data` — NOT used. Per the brief's own caution ("do not
  automatically select ... without validating grain"), this table mixes product-level and
  campaign-level rows (seen in Mahima's Req1 history) and was superseded by
  `google_ads.campaign_performance` for clean campaign-level grain in this same project.
  `campaign_performance` has a verified UNIQUE constraint on (date, campaign_id); no
  equivalent verification was available for the legacy table without repeating that
  investigation, and a clean confirmed-unique source was already available.
- `google_ads.google_ads_change_events` — checked for budget/status change history; not
  needed since `campaigns.budget` gives the current valid budget directly.
- `google_ads.ad_group_products`, `asset_group_listing_group_filters` — campaign-structure
  tables unrelated to campaign-level cost/conversion aggregation; not relevant to this
  requirement.
- No `staff` schema table, campaign registry, or tag/label mapping table was found relevant to
  Google Ads campaign ownership — `campaigns.group_name` was the only real match.

## Currency / micros check
`accounts.currency_code` for account_id 9031058245 = **EUR**. `campaign_performance.cost` and
`.conversion_value` are documented and confirmed to already be in account currency (not
micros) — `cost_micros` exists as a separate raw field and was NOT used. No conversion needed.

## Store/country confirmation
All data filtered to `campaigns.account_id = '9031058245'`, independently confirmed as
`account_name = 'ledsone.de'`, `currency_code = 'EUR'`, `market_place = 'DE'` (via
`google_ads.accounts`).

## Campaign ownership method
`google_ads.campaigns.group_name = 'Thasi'` — queried directly:
```sql
SELECT DISTINCT group_name FROM google_ads.campaigns WHERE account_id='9031058245';
-- Jefri, Mahima, Thasi, (null)
```
Exactly 3 named values exist account-wide, confirming this is a genuine, deliberate,
per-staff-member ownership field (not a coincidence or guess). **2 campaigns** have
`group_name = 'Thasi'`:
- `23765634627` — "Pmax | Thasi | Shoptimised | THT | NewProduct | MCV -20/04"
- `23791285134` — "Pmax | Thasi | Shoptimised | MT | Metal Product | MCV -27/04"

This is NOT a campaign-name text search — it is a direct filter on the explicit `group_name`
column, which happens to also be reflected in the campaign name for readability.

## Conversion Value vs Conversion Count — labelling decision
`campaign_performance.conversion_value` is monetary (account currency, EUR). The requirement
screenshot's "Conversion" column with values like €450/€1,228 corresponds to this field.
**UI label used: "Conversion Value"** (not "Conversions"), per the brief's explicit rule.
`conversions` (count) is a separate field, not displayed as a headline metric per the required
column list (only Cost, Conversion Value, ROAS, Action are required table columns).

## PASS / FAIL result
**PASS** — both approved environments inspected, all required field categories documented,
ownership/budget/currency/grain all resolved from real fields, no invented logic.
