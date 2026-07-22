---
title: Theekshy Google Ads Tab — New UK Staff closure
date: 2026-07-22
type: closure
---

# Title
Closure — new Theekshy Google Ads dashboard tab, UK store (2026-07-22).

# Purpose
Close out today's Theekshy tab addition with a clear record of what shipped and what's still open.

# Completed & Deployed
- Added a new `theekshy-ads` staff mode to `api/sales-sukirtha-de.js`: `ledsone.co.uk`, exact `utm_term=theekshy` match (case-insensitive, first session only).
- Added a new Theekshy tab to `pages/sales.html`, placed next to Sajeepan's, covering **March–June (historical) + July (live)** only, since she joined the team in March 2026 — no January/February tabs.
- Updated the reusable snapshot-generation tool (`scripts/generate-snapshots.js`, built earlier today for Sajeepan) to also support Theekshy, so future speed-fix snapshots need no script changes.
- Deployed to Vercel production.

# Remaining Work
1. Live financial totals (Gross Sales, Net Sales, Orders) for March–July have not yet been independently confirmed — a live fetch was requested but not completed before this save.
2. No static snapshots generated yet for Theekshy's historical months (March–June) — every visit currently re-fetches live from Shopify (same ~40-90s-per-month slowness Sajeepan's tab had before its fix).
3. Git commit/push not yet done — this repo's standing rule requires explicit user permission before pushing; today's changes are live on Vercel production only.

# Files Modified
See evidence file: `evidence/sales/2026-07-22_theekshy-ads-tab-new-uk-staff-evidence.md`.

# Evidence Location
`evidence/sales/2026-07-22_theekshy-ads-tab-new-uk-staff-evidence.md`

# Validation Result
PASS (scope: implementation correctness + deployment) — see `validation/sales/2026-07-22_theekshy-ads-tab-new-uk-staff-validation.md`. Live data confirmation flagged as the immediate next step.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, closed pending git push permission and live data confirmation.

# PASS / FAIL
PASS

# Next Step
1. Confirm live March–July data returns real matched orders once a live check completes.
2. Run `node scripts/generate-snapshots.js theekshy-ads 2026-03 2026-04 2026-05 2026-06` for the speed fix once data is confirmed correct.
3. Confirm with user whether to git commit/push today's work.
