# Jefri Req2 — Campaign-Wise Breakdown + Filter

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## Purpose

Change Requirement 2 (Search Terms Labels) from a single flat, campaign-blind table into a
campaign-wise view: each search term row now shows which of Jefri's 5 campaigns it belongs
to, with a Campaign filter dropdown and a per-campaign summary table, matching the pattern
already used on Requirement 1.

## Requirement source

Direct request from Jefri, relayed 2026-08-04.

## Business question

Which search terms (and which Hero/Villain/Zombie/Sidekick tags) belong to which of
Jefri's 5 named campaigns?

## Work completed

- **Backend (`api/requirement.js`, `jefriSearchTermsHandlerModule`):**
  - `QUERY_R2` now selects and groups by `campaign_id` in addition to `search_term`/
    `match_type` (previously the UNION of `google_ads.campaign_search_term_data` and
    `google_ads.pmax_campaign_search_term_data` was aggregated *across* all 5 campaigns,
    discarding which campaign each term came from — a term appearing in 2 campaigns is
    now correctly 2 rows instead of 1 merged row).
  - Added a local `JEFRI_CAMPAIGNS` id→name lookup inside this module (Req2's closure is
    intentionally isolated from Req1's — Req1's own `JEFRI_CAMPAIGNS` constant lives inside
    a *different* IIFE and isn't reachable from here; discovered live via a `JEFRI_CAMPAIGNS
    is not defined` error on first deploy, fixed by duplicating the 5-campaign id/name list
    into this module).
  - Every row now carries `campaignId` and `campaignName`.
  - Added `campaignSummary` (per-campaign totals: total terms, Hero/Villain/Zombie/Sidekick
    counts) and `campaignList` (for populating the filter dropdown) to the response payload.
- **Frontend (`pages/jefri.html`, Req2 tab):**
  - Added a "Campaign" `<select>` filter next to the existing Tag filter and search box,
    populated from `campaignList`.
  - Added a per-campaign summary table above the main search-terms table.
  - Added a "Campaign" column to the main table (between Match Type and Clicks).
  - Wired the Campaign filter into `r2FilteredRows()`, and added the campaign column to
    both the on-page render and the CSV export.
  - Table `colspan` values bumped from 12 to 13 to account for the new column.

## Files created or modified

- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/jefri.html`
- `reports/digital-marketing-member-pages/api/data/jefri-search-terms-snapshot.json` (regenerated)

## PostgreSQL source checked

`google_ads.campaign_search_term_data`, `google_ads.pmax_campaign_search_term_data` — same
two tables Req2 already used; only the query's `GROUP BY` and `SELECT` list changed to
retain `campaign_id`.

## Evidence

Live verification after deploy (2026-08-04), `?refresh=1`:
- `campaignList`: 5 campaigns returned.
- `campaignSummary`: per-campaign row counts, e.g. `Shopping | Jeff | Shoptimised | AOVU15
  | TROAS | DE -12/05` → 32,697 terms (40 Hero / 341 Villain / 30,231 Zombie / 60 Sidekick).
- Total rows: 57,633 (up from the prior flat count of 51,416 — the increase reflects both
  fresh live data and terms that appear in more than one campaign now being split into
  separate rows instead of merged).
- Static snapshot (`jefri-search-terms-snapshot.json`) regenerated and confirmed to match
  the live shape (`success:true`, 5 campaigns, 57,633 rows).

## Validation

See `validation/jefri/2026-08-04_req2-campaign-wise-filter-validation.md`.

## Known limitations

- Because rows are now split per campaign, a term appearing in 2+ campaigns shows up as
  multiple rows — "Showing X of Y terms" now counts campaign-term pairs, not unique terms.
  This is the intended behavior for a campaign-wise view but is a change from the old
  cross-campaign-merged count, worth flagging to Jefri if he compares totals to the old page.
- Tag classification (`classifyTag`) is computed per campaign-term row now, not on the
  cross-campaign merged total — a term that was, say, a Villain overall (merged) could
  show as Hero in one campaign and Villain in another. This is correct for a campaign-wise
  breakdown but is a behavior change from before.

## Next step

None outstanding — feature is live and verified. Confirm with Jefri that the per-campaign
row-count and tag behavior described above matches what he expected from "campaign wise."

## PASS / FAIL

PASS — deployed to production, live-verified, static snapshot regenerated, synced to both
`aios-2` and the staff repo.
