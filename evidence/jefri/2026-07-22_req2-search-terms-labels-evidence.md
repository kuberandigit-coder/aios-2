---
title: Jefri Requirement 2 — Search Terms Labels, evidence
date: 2026-07-22
type: evidence
---

# Title
Jefri Requirement 2 — a new "Search Terms Labels" dashboard section (`pages/jefri.html`, Requirement 2 tab) classifying Google Ads search terms into Hero/Villain/Zombie/Sidekick using live PostgreSQL data, rolling last 90 days.

# Requester
Jefri (Google Ads)

# Business Question
Which search terms driving Jefri's Google Ads campaigns should be scaled (Hero), monitored/paused (Villain), ignored (Zombie), or watched (Sidekick), based on real click/conversion/ROAS performance?

# Requirement Source
Full spec prompt (see `prompts/jefri/2026-07-22_req2-search-terms-labels-prompt.md`), followed same-day by a tag-logic-only revision prompt from the user.

# Discovery (before writing any code)
1. Searched existing AIOS assets: `prompts/jefri/`, `evidence/jefri/`, `validation/jefri/`, `reports/jefri/`, `handover/jefri/`, and the live `pages/jefri.html` — confirmed only Requirement 1 (Product Status Labels) existed; **no Requirement 2 existed anywhere** (grepped `pages/jefri.html` for "Requirement 2"/"jefri-search-terms"/"Search Terms Labels" — zero matches before this build). No duplication.
2. Read-only PostgreSQL inspection via `mcp__ledsone-db-mcp__search_objects` (schema/column listing only, no data mutation at any point):
   - `google_ads.campaign_search_term_data` — Shopping/Search campaigns: `search_term, match_type, impressions, clicks, conversions, conversions_value, cost, campaign_id, ad_group_id, date`
   - `google_ads.pmax_campaign_search_term_data` — Performance Max campaigns: same core columns (no `ad_group_id`)
   - Confirmed Jefri's 5 campaign IDs (same list already used by Req1, `ledsone.de`): `23141810147, 23411228109, 22539594891, 23473840779, 23340277562` — a mix of Shopping and PMax campaign types, so both tables are UNIONed.

# Implementation

## API — `api/requirement.js`
New isolated IIFE module `jefriSearchTermsHandlerModule`, dispatched via `fn=jefri-search-terms` (added to the existing `fn=` dispatcher, one new line — Req1's dispatch line untouched).
- **Its own separate `pg.Pool` instance** (not shared with Req1's module) so this new feature can never affect Req1's already-working database connection, per the "do not modify other dashboard functionality" instruction in the revision prompt.
- Query: UNION ALL of both search-term tables, filtered to the 5 campaign IDs, `date >= CURRENT_DATE - INTERVAL '90 days'`, re-aggregated with `GROUP BY search_term, match_type` (a term can appear via both Shopping and PMax, kept as separate rows since Match Type differs).
- Derived metrics computed server-side: CTR (clicks/impressions×100), Avg CPC (cost/clicks), Cost/Conversion (cost/conversions, null if 0 conversions), ROAS ((conv_value/cost)×100, 0 if cost=0) — all rounded to 2 decimals.
- **Tag logic (final version, per the same-day revision)**:
  ```js
  function classifyTag(clicks, impressions, cost, conversions, roas) {
    if (clicks >= 3) {
      if (roas >= 400) return 'Hero';
      if (roas < 400 || conversions === 0) return 'Villain';
    }
    if (impressions > 0 && clicks === 0) return 'Zombie';
    if (clicks >= 1 && clicks <= 2 && roas >= 400) return 'Sidekick';
    return '';
  }
  ```
- Response includes `success`, `staff`, `reportPeriod` (label "Last 90 Days"), `source` (scope + tables), `summary` (counts per tag), `rows` (full array), `meta.generatedAt`.

## First deployment bug found and fixed
Initial version added `ssl: { rejectUnauthorized: false }` to the new pool config (not present in Req1's working pool) — this broke the DB connection entirely (`"Server not configured or database unreachable"`). Root-caused by comparing against Req1's exact working pool config and removing the extra option. Confirmed fixed: live endpoint returned `success:true` with 50,768 real search-term rows afterward.

## UI — `pages/jefri.html`
Added a Requirement 1 / Requirement 2 tab bar at the top of the page (new, since the page previously had no tabs — Req1 was the entire page). Req1's existing markup/script were left completely untouched, just wrapped in a `div#req1Tab`. New `div#req2Tab` (hidden by default, lazy-loads on first click) contains:
- Header: title "Search Terms Labels", subtitle "Last 90 Days", scope description.
- 5 summary cards (Total Terms, Heroes, Villains, Zombies, Sidekicks), reusing Req1's existing card CSS classes (`.card.hero/.villain/.zombie/.sidekick`).
- Table: Search Term, Match Type, Clicks, Impressions, CTR, Avg CPC, Cost, Conv. Value, Conversions, Cost/Conversion, ROAS, Tag — with sticky header (`position:sticky` on `<thead>`), click-to-sort columns, live search box, Tag filter dropdown, CSV export button, pagination (50/100/250/500 rows/page).
- Tag badges color-coded: Hero green, Villain red, Zombie grey, Sidekick blue (per spec), untagged rows show a plain em-dash.
- New JS block, entirely `r2`-prefixed identifiers (`R2_ALL`, `r2Load`, `r2Render`, `r2FilteredRows`, `r2ExportCsv`, etc.) — verified zero collisions with Req1's existing unprefixed script via `grep` before writing.
- One script-ordering bug caught and fixed during build: the tab-switch script referenced `R2_LOADED` before its declaration (which lived in a later `<script>` block) — moved the `let R2_LOADED = false;` declaration into the first (tab-switching) script block.

# Validation
See `validation/jefri/2026-07-22_req2-search-terms-labels-validation.md` for full validation detail, including the resolved Hero/Villain boundary conflict between the original and revised specs.

# Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js` — new `jefriSearchTermsHandlerModule`, new `fn=jefri-search-terms` dispatch line, tag logic updated once same-day per the revision prompt (removed the intermediate version's Zombie-first evaluation order, replaced with the final Hero/Villain/Zombie/Sidekick/untagged order above).
- `reports/digital-marketing-member-pages/pages/jefri.html` — new Requirement 1/2 tab bar, new `div#req2Tab` section, new `r2`-prefixed JS block.

# Evidence Location
This file.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user (Jefri to confirm the dashboard matches his real workflow needs).

# Status
Deployed to Vercel production. Live-verified: `pages/jefri.html` (200), `/api/requirement?fn=jefri-search-terms` (200, `success:true`, 50,768 real rows, summary counts: 44 Hero / 396 Villain / 47,052 Zombie / 62 Sidekick / ~3,214 untagged under the final tag rules).

# PASS / FAIL
PASS

# Next Step
1. Git commit/push — pending explicit user permission per repo's standing rule.
2. Sync to `Staff-requirements` repo (same manual process used throughout today's session).
3. Confirm with Jefri whether the large Zombie count (47k of 50.7k terms) matches his expectations, or whether the 90-day window / campaign scope needs adjusting.
