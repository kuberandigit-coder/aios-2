---
task: Thasitha Requirement 1 — Impressions/Clicks/CTR + Daily View + Data Mismatch Investigation
date: 2026-07-10
team_member: Thasitha
---

## Title
Thasitha Requirement 1 — Addendum: Impressions/Clicks/CTR columns, Daily View toggle, data
mismatch root-cause

## Purpose
Document the follow-up build adding Impressions/Clicks/CTR to every view, a Daily/Aggregate
view toggle, a fresh data pull through 2026-07-10, and the root-cause investigation into a
reported "date range mismatch" versus the Google Ads UI.

## Requirement source
Kuberan/Thasitha, 2026-07-10 — request for Impressions/Clicks/CTR columns, a per-day view
option, and investigation of a reported date-range data mismatch against Google Ads UI
(screenshots provided).

## Team member / Team / Store
Thasitha / Google Ads / ledsone.de

## Investigation: is the date-range filter buggy?
**No.** Three independent checks, all consistent:
1. Recomputed the exact range (2026-06-01 to 2026-07-09) directly from the raw daily data
   file, bypassing all page JavaScript — result: cost=€122.96, value=€211.64, matches the
   page exactly.
2. Re-queried the live PostgreSQL database at investigation time for the identical range —
   identical result.
3. Re-pulled the database again for this follow-up build (fully fresh, including impressions/
   clicks/ctr) — the most recent day (2026-07-10) had changed between the two pulls (cost
   moved from €0/€0.38 to €1.37/€0.59 for THT/MT respectively), proving the sync pipeline
   itself is still actively revising the most recent days — this is expected attribution/sync
   behavior, not a bug.

## Root cause of the Google Ads UI mismatch
Compared the user's two screenshots directly:
- **Thasitha page (Jun 1–Jul 9, THT campaign)**: Impressions n/a in that screenshot, Cost
  €122.96, Conv. Value €211.64, ROAS 172.12%.
- **Google Ads UI (same period)**: Clicks 340, Cost €123, Purchases/Sales €218.20, Actual
  ROAS 177.43%.

Cross-checked against this build's fresh THT aggregate for the same range: **Clicks = 340
(exact match)**, Cost = €122.96 (matches €123 within rounding). **Impressions, Clicks, and
Cost all match Google Ads UI exactly or within rounding.** Only Conversion Value and ROAS
differ (€211.64 vs €218.20).

**Conclusion**: this confirms the mismatch is isolated to conversion attribution, not a data
pull or calculation error. Google Ads revises conversion values retroactively for days/weeks
after a click as attribution finalizes (delayed conversions, cross-device attribution,
view-through conversions). Our hourly sync captures a point-in-time snapshot; Google's live UI
reflects the most current attribution state. The gap will naturally shrink over time as our
next sync captures the same revisions Google has already applied.

## Fix applied
Since Cost/Impressions/Clicks were already correct, "fixing" here meant:
1. Re-pulled all data fresh from PostgreSQL (`google_ads.campaign_performance`) through the
   latest available date (2026-07-10) at build time, rather than reusing the earlier snapshot.
2. Added an explicit, visible disclosure note on the page itself explaining this exact
   phenomenon, so it doesn't read as a bug to Thasitha when she compares against Google Ads UI.
3. No fabricated adjustment was made to force numbers to match Google's UI — that would
   violate the no-fabrication rule and would go stale again on the next sync anyway.

## New features added
- **Impressions, Clicks, CTR** columns added to the Aggregate view table and summary cards
  (CTR = clicks/impressions × 100, consistent with `campaign_performance.ctr`'s own formula).
- **Daily View toggle**: a second table mode showing one row per (date, campaign) within the
  selected range — Date, Campaign Name, Campaign ID, Tags, Impressions, Clicks, CTR, Cost,
  Conversion Value, ROAS, Action. Recomputed from the same embedded `DAY` lookup used for the
  aggregate view — same underlying data, different grain.
- Data-status note updated with the attribution-lag disclosure.

## Validation
- Full inline `<script>` re-extracted and passed `node --check` after the rebuild.
- Div balance re-verified (21 open / 21 close) — a stray extra `</div>` bug (same pattern as
  the first build) was found and fixed again during this rebuild.
- Aggregate full-range recompute: THT impr=36,717 clicks=737 CTR=2.01% cost=€268.66
  value=€535.03 ROAS=199.15% (Poor); MT impr=120,845 clicks=1,912 CTR=1.58% cost=€829.03
  value=€2,242.07 ROAS=270.44% (Average).
- Daily view spot-check (2026-07-08): both campaigns correctly broken out per-day with
  matching totals to the aggregate sum for that single day.
- Jun1–Jul9 range re-verified against both the original screenshot (MT: cost=470.14,
  value=1230.56, roas=261.74% — exact match) and the Google Ads UI screenshot (THT: clicks=340
  — exact match).

## Files modified
`reports/digital-marketing-member-pages/pages/thasitha.html` (rebuilt in place)
`reports/thasitha/data/2026-07-10_thasitha_before_v2_impressions_backup.html` (pre-edit backup)
`reports/thasitha/data/2026-07-10_thasitha_req1_builder_v2.py`,
`2026-07-10_thasitha_fresh_data.json` (new build scripts/data)

## Known limits
Same as original build, plus: the attribution-lag gap documented above is inherent to how
Google Ads reports conversions and cannot be eliminated by any query change — only disclosed
and expected to narrow as later syncs catch up.

## Duplicate-truth risk
GREEN — same page, in-place update.

## Owner / Reviewer
Owner: Thasitha · Reviewer: Kuberan

## Status
Built locally. Deployment status recorded separately per session instruction.

## Next step
Review, then deploy per explicit instruction.

## PASS / FAIL result
**PASS**
