# Jefri Req2 — Campaign-Wise Breakdown + Filter (Report)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## Title

Requirement 2 (Search Terms Labels) — Campaign-Wise Breakdown + Filter

## Purpose

Give Jefri a campaign-level view of search term performance instead of one merged table
across all 5 campaigns.

## Requirement source

Direct request from Jefri, 2026-08-04.

## Business question

Which search terms (and Hero/Villain/Zombie/Sidekick tags) belong to which campaign?

## Work completed

- Backend query now groups by `campaign_id`; response includes `campaignList` and
  `campaignSummary`.
- Frontend: Campaign filter dropdown, per-campaign summary table, Campaign column on the
  main table and CSV export.
- Static snapshot regenerated; deployed to production; live-verified.

## Files created or modified

- `api/requirement.js`
- `pages/jefri.html`
- `api/data/jefri-search-terms-snapshot.json`

## PostgreSQL source checked

`google_ads.campaign_search_term_data`, `google_ads.pmax_campaign_search_term_data`

## Status

Completed

## PASS / FAIL

PASS
