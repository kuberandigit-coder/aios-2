---
task: Request to Sajeesan (Developer) — Postgres DB access for automated Thasitha Req1 refresh
date: 2026-07-13
requested_by: Digital Marketing (AIOS)
requested_from: Sajeesan
status: pending
---

## Purpose

We want to fully automate the daily/hourly refresh of the Thasitha Requirement 1
dashboard (Google Ads Campaign Performance & ROAS Action —
`reports/digital-marketing-member-pages/pages/thasitha.html`) using a free,
serverless GitHub Actions workflow instead of a paid AI agent, so it no longer
consumes any Claude usage per run.

To do this without an AI agent in the loop, the automation script needs its own
**direct, read-only connection string** to the PostgreSQL analytics database
that already holds the synced Google Ads data (schema: `google_ads`, specifically
the `campaign_performance` table). This is the same database currently queried
manually/via MCP connector for this dashboard — we are not asking for new data,
just a way for a scheduled script to reach it directly.

## What we need from Sajeesan

1. **A read-only Postgres connection string** (or the individual pieces: host,
   port, database name, username, password) for the analytics PostgreSQL
   instance holding the `google_ads` schema.
   - Read-only is sufficient — the script only runs `SELECT` queries against
     `google_ads.campaign_performance`. It never writes to the database.
2. **Confirmation the connection is reachable from GitHub Actions runners**
   (GitHub-hosted runners use dynamic public IPs, not a fixed range). Options,
   in order of preference:
   - The database allows connections from any IP with valid credentials (most
     common setup for managed Postgres with strong password/SSL auth), **or**
   - If there's an IP allowlist/firewall, we'd need either a broader allowance
     for GitHub's published IP ranges, or a different connectivity approach
     (e.g. a small proxy/tunnel) — let us know which applies so we can adjust
     the plan accordingly.
3. **Confirmation SSL/TLS requirements** for the connection (e.g. `sslmode=require`),
   if applicable, so the script's connection config matches.

## What this will be used for (scope, so it's easy to review)

- One query, roughly:
  ```sql
  SELECT date, campaign_id, impressions, clicks, cost, conversion_value, conversions
  FROM google_ads.campaign_performance
  WHERE campaign_id IN ('23765634627','23791285134')
  AND date >= '2026-04-20'
  ORDER BY date ASC, campaign_id ASC;
  ```
  (campaigns 23765634627 "THT" and 23791285134 "MT", group_name='Thasi',
  account_id 9031058245 / ledsone.de)
- Runs on an hourly GitHub Actions cron job.
- Rebuilds the static `thasitha.html` dashboard with fresh embedded data,
  commits, and pushes — Vercel's existing Git integration handles the deploy
  automatically.
- The credential will be stored as an encrypted GitHub Actions secret (never
  committed to the repo, never visible in logs or to any AI tool).

## Why this approach (context for review)

Previously this refresh ran as a scheduled Claude Code cloud agent, which
worked but incurred Claude usage on every run (hourly = ~24 runs/day) even
though the actual task — query, rebuild file, validate, commit, push — is
fully deterministic and needs no AI judgment. Moving it to a plain script on
GitHub Actions' free scheduler removes that ongoing cost entirely while
keeping the same behavior.

## Next step

Once Sajeesan provides the connection string (via a secure channel — not
pasted in chat/Slack in plaintext if avoidable, e.g. a password manager share
or added directly as the GitHub secret by Sajeesan), we will:
1. Add it as a GitHub Actions secret in the `Staff-requirements` repo.
2. Build and test the refresh script + workflow.
3. Disable the existing Claude-based scheduled routine.

## Status

Pending — document prepared 2026-07-13, not yet sent.
