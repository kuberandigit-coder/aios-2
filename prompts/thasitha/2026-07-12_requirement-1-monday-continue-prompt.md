---
task: Thasitha Requirement 1 — Live Data Refresh (Monday Continue Prompt)
date: 2026-07-12
team_member: Thasitha
---

## Purpose
Reusable prompt to resume the Thasitha Req1 live-data refresh after the scheduled
6-hourly auto-refresh cron job was interrupted mid-run on 2026-07-11 (a tool call was
rejected). Paste this into a new session to continue.

## Prompt

Continue the Thasitha Requirement 1 live-data refresh for the LEDSone AIOS project.

Working directory: C:\Users\PC\OneDrive\Desktop\kuberan web

Context: reports/digital-marketing-member-pages/pages/thasitha.html is a static HTML
dashboard (Google Ads campaign performance for campaigns 23765634627 "THT" and
23791285134 "MT", group_name='Thasi') that embeds pre-computed data from
google_ads.campaign_performance in Postgres. It was last refreshed with data through
2026-07-10 (MAX_DATE), default view range ending 2026-07-09 (DEFAULT_END). A scheduled
6-hourly auto-refresh was set up but a tool call got interrupted mid-run on 2026-07-11,
so the page has NOT been refreshed since 2026-07-10.

Do this:
1. Use ledsone-aios-mcp (search_files/read_file) if needed to confirm schema, then
   ledsone-db-mcp (execute_sql) to pull fresh daily data for both Thasi campaigns from
   google_ads.campaign_performance (date, campaign_id, impressions, clicks, ctr, cost,
   conversion_value, conversions, cpc, cpa, acos, roas) from 2026-04-20 through the
   latest available date.
2. Rebuild thasitha.html in place — same structure (DAY lookup, CAMPAIGNS array,
   computeRange/computeDaily, Aggregate/Daily View toggle defaulting to Daily View with
   Date as first column, ROAS Action bands, summary cards). Only refresh embedded data,
   MAX_DATE, and date-picker max. Set DEFAULT_END to one day behind the new MAX_DATE.
3. Validate: node --check on the extracted <script> block, div-balance check unchanged.
4. If valid, deploy via the established two-repo workflow: commit+push to
   kuberandigit-coder/aios-2, sync+commit+push into a fresh clone of
   digitalmarketing69140951-sys/Staff-requirements (never use a local piranav_aios
   folder), then `vercel --prod --yes` from reports/digital-marketing-member-pages/,
   then verify live via curl against
   https://digital-marketing-member-pages.vercel.app/pages/thasitha.html.
5. Ask before re-enabling the recurring 6-hourly auto-refresh job, since the last one
   hit a permission interruption — recommend checking why before turning it back on.

## Status
Saved for reuse. Not yet executed.

## Next step
Paste this prompt on Monday (or whenever the refresh needs to resume) to continue.
