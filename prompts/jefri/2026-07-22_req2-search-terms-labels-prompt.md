---
title: Jefri Requirement 2 — Search Terms Labels, original build prompt + tag-logic revision prompt
date: 2026-07-22
type: prompt
---

# Prompt 1 — Original build (2026-07-22)
Role: Senior Full Stack Developer + PostgreSQL Analyst + AIOS Documentation Engineer.
Objective: Build Jefri Requirement 2 as a live HTML dashboard section classifying Google Ads Search Terms into Hero/Villain/Zombie/Sidekick using live PostgreSQL data. Full spec included: discovery-first (search AIOS assets, check Req2 doesn't already exist, read-only DB inspection via ledsone-db-mcp), required columns (Search Term, Match Type, Clicks, Impressions, CTR, Avg CPC, Cost, Conv. Value, Conversions, Cost/Conversion, ROAS, Tag), original tag rules (Hero: clicks>=3 & ROAS>=400%; Villain: clicks>=3 & ROAS<400%; Zombie: clicks=0 OR cost=0 OR conversions=0; Sidekick: else), table features (search/sort/filter/CSV/responsive/sticky header/badge colors), rolling last-90-days live data (no hardcoding), 4 validation examples, and full AIOS output requirements (prompts/evidence/validation/reports/handover for jefri).

# Prompt 2 — Tag logic revision (2026-07-22, same day)
Role: Senior Google Ads Dashboard Developer.
Objective: Update ONLY the Tag column logic — explicitly do not touch UI design, table layout, API structure, SQL queries, or AIOS folder structure. Replaced rules:
- Hero: Clicks >= 3 AND ROAS >= 400%
- Villain: Clicks >= 3 AND (ROAS < 400% OR Conversions = 0)
- Zombie: Impressions > 0 AND Clicks = 0
- Sidekick: Clicks BETWEEN 1 AND 2 AND ROAS >= 400%
- No match: tag left empty
Included ROAS formula confirmation ((Conv Value / Cost) × 100, 0 if Cost=0, round to 2 decimals) and 6 new validation examples, notably resolving the earlier build's Hero/Villain boundary ambiguity at exactly ROAS=400% (Example 2: clicks=763, ROAS=400%, conversions=2 → Hero, confirming the boundary is inclusive on the Hero side).

# Why two prompts, one file
Per this repo's AIOS convention, the revision request explicitly said not to change AIOS folder structure and to continue documenting under the same jefri/ files — both prompts are recorded together here since they describe one continuous requirement (Req2), not two separate tasks.
