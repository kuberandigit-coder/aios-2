# Prompt Used — Jefri Requirement 1: Product Status Labels

**Title:** Jefri Req1 build prompt
**Purpose:** Record the exact GPT-authored implementation prompt executed by Claude Code for this requirement, per AIOS governance.
**Requirement source:** `What_I_Need_To_Improve_ADS_Performance - Jefri.csv` (section "T - 01, Product Status Labels")
**Team member:** Jefri
**Department:** Google Ads
**Business question:** Which advertised products are Heroes, Villains, Zombies or Sidekicks based on their current Google Ads product performance?
**Status:** Implemented (build complete), deployment blocked — see [[2026-07-20_stop-conditions]]

## Prompt (verbatim, as issued by GPT)

The full ROLE/OBJECTIVE/BUSINESS CONTEXT/TAGGING RULES/POSTGRESQL CONNECTION/
etc. prompt is preserved in the session transcript. Key parameters extracted:

- Owner: Jefri · Supporting AIOS staff: Kuberan
- Root: `C:\Users\PC\OneDrive\Desktop\kuberan web`
- Target file: `pages/jefri.html` (do not create a second dashboard)
- Required columns: Product ID, SKU, Product URL, Image, Price, Status,
  Current Stock, Impressions, Clicks, Conv. Value, Cost, ROAS, Tag
- Tag rules: Hero/Villain/Zombie/Sidekick/Unclassified exactly as specified
- ROAS = (Conv. Value / Cost) × 100, zero-cost handled without division errors
- Date range: last 90 complete days, from latest available performance date
- Architecture: browser → `/api/jefri/product-status` → PostgreSQL (server-side only)
- Never expose credentials in HTML/JS/Git/evidence/screenshots

## Files created/modified
- `reports/digital-marketing-member-pages/pages/jefri.html`
- `reports/digital-marketing-member-pages/api/jefri/product-status.js`
- `reports/digital-marketing-member-pages/package.json` (new — first npm dependency, `pg`)
- `reports/digital-marketing-member-pages/index.html` (moved Jefri card to Active Dashboards)

## Owner/Reviewer
Coordinator: Kuberan · Business validator: Jefri · Technical reviewer: Kuberan or assigned developer

## PASS/FAIL rule
PASS only once deployment blockers below are resolved and Jefri confirms the live dashboard. See [[2026-07-20_stop-conditions]] and [[2026-07-20_validation-results]].
