# Jefri Req1/Req2 — Database IP Migration + SSL Fix (Report)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## Title

Database IP Migration + SSL Connectivity Fix (Requirement 1 & 2)

## Purpose

Restore Postgres connectivity for Jefri's Requirement 1 and 2 dashboards after a database
host migration broke both.

## Requirement source

User-reported outage, 2026-08-04.

## Business question

Why are the dashboards down, and how do we get them working on the new database host?

## Work completed

- Diagnosed 3 sequential failure modes via `vercel logs` (missing module, wrong db name,
  network timeout).
- Reverted to old host temporarily to restore service.
- Fixed hardcoded `ssl:false` across all 6 Postgres pools; made SSL configurable via new
  `PGSSL` env var.
- Verified both Requirement 1 and 2 working on the new host with current (today's) data.

## Files created or modified

- `api/requirement.js`

## PostgreSQL source checked

`google_ads.product_performance`, `google_ads.campaign_search_term_data`,
`google_ads.pmax_campaign_search_term_data`

## Status

Completed

## PASS / FAIL

PASS
