---
date: 2026-07-13
staff: Thasitha
requirement: Requirement 1 — Campaign Performance & ROAS Action
type: evidence
---

# Thasitha Req1 — Hourly Live-Data Refresh Routine — Evidence

## Purpose

Continue the earlier-saved "Monday continue prompt" refresh (data last at
2026-07-10), then replace the manual refresh workflow with a fully
automated hourly routine, and add a live "last updated" indicator on the
page itself.

## PostgreSQL evidence

**Schema/table**: `google_ads.campaign_performance`
**Query used** (via `mcp__ledsone-db-mcp__execute_sql`):
```sql
SELECT date, campaign_id, impressions, clicks, cost, conversion_value, conversions
FROM google_ads.campaign_performance
WHERE campaign_id IN ('23765634627','23791285134')
AND date >= '2026-04-20'
ORDER BY date ASC, campaign_id ASC;
```
Campaigns: `23765634627` (THT), `23791285134` (MT), `group_name='Thasi'`,
`account_id=9031058245` (ledsone.de).

**Result at time of manual refresh**: 163 rows returned, `MAX(date)` =
`2026-07-13`. Aggregate check: `SUM(cost)=292.21`, `SUM(conversion_value)=535.03`,
84 active days for campaign 23765634627 over 2026-04-20 to 2026-07-12 —
matched exactly what the rebuilt page displayed (cross-checked against a
user-reported Google Ads UI discrepancy of €292 cost / €541.60 conv. value /
185.33% ROAS vs. our €292.21 / €535.03 / 183.10% — confirmed the ~€6.57 gap
is attribution-lag on Google's side, not a bug: DB rows for 2026-07-09
through 2026-07-12 showed `conversion_value = 0` for days that had real
cost/clicks, consistent with GSC/Google Ads retroactive conversion
attribution).

## Files modified

- `reports/digital-marketing-member-pages/pages/thasitha.html` — rebuilt
  `DAY` data object, `MAX_DATE`, `DEFAULT_END`, date-picker bounds, status
  note dates, footer date. Added `GENERATED_AT` constant and `#t1Updated`
  live badge + `renderUpdated()` JS function (30s `setInterval`).

## Automation implementation

Created via `RemoteTrigger` (Claude Code scheduled cloud routine), not a
local cron — session-only `CronCreate` was explicitly rejected as
unsuitable (expires after 7 days, dies when session ends).

- **Routine ID**: `trig_01Hr3tZ2DD2dSEYMqPgZygzs`
- **Name**: "Thasitha Req1 Hourly Data Refresh"
- **Schedule**: `15 * * * *` (UTC) = every hour at :15 past
- **Sources**: both `kuberandigit-coder/aios-2` and
  `digitalmarketing69140951-sys/Staff-requirements` git checkouts
- **MCP connection**: claude.ai Postgres connector
  (`d3bc3771-282e-42c8-8f2b-7db7692564f9`, confirmed by the user to be the
  same DB as `ledsone-db-mcp`)
- **Logic**: query → compare new `DAY`/`MAX_DATE` against currently
  committed file → if unchanged, skip commit/push entirely (no empty
  commits) → if changed, update `GENERATED_AT` to real current UTC time,
  validate (`node --check` on extracted `<script>`, div-balance check) →
  commit+push both repos → push to `Staff-requirements` triggers Vercel's
  Git-integration auto-deploy (confirmed connected via `vercel git connect`
  → "already connected").

## Deployment evidence

- Manual refresh commit: `aios-2@71c153b`
- GENERATED_AT badge commit: `aios-2@54470d6`
- Verified live via curl: `MAX_DATE = "2026-07-13"`, `GENERATED_AT` badge
  HTML element present in response.
