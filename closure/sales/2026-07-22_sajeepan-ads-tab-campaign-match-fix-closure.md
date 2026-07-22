---
title: Sajeepan Google Ads Tab — Campaign-Match Fix closure
date: 2026-07-22
type: closure
---

# Title
Closure — Sajeepan Google Ads attribution fix and new live dashboard tab (2026-07-22).

# Purpose
Close out today's Sajeepan work with a clear record of what shipped, what's confirmed, and what's still open.

# Completed & Deployed
- Diagnosed why the user's earlier flag ("sajeepan is not finished and not correct") was accurate: the original `utm_term`-only matching rule missed ~96% of her real January orders (2 of 55 confirmed real orders caught).
- Fixed root cause in `api/sales-sukirtha-de.js`: matching now keys on `utm_campaign` (11 confirmed campaign names, case-insensitive exact/prefix match) instead of `utm_term`.
- Built and deployed the missing Sajeepan tab in `pages/sales.html`, placed next to Thasitha's tab, covering January–June (historical) and July (live), mirroring the existing Thasitha tab pattern exactly (cards, campaign summary, line-item table with session drill-down, filters, CSV export).
- Deployed to Vercel production; live tab reachable and wired to the corrected endpoint.

# Remaining Work
1. Only January was deep-audited (per explicit user instruction) before the fix was applied broadly — February–July totals have not yet been independently spot-checked.
2. One unlisted-but-similar campaign, `Shop_SJ_PMax-25` (1 order in January), was flagged to the user but not included — awaiting a decision.
3. No static snapshot files generated yet for Sajeepan's Jan–Jun (unlike Thasitha/Hetheesha/Thivagini) — every historical month currently re-fetches live from Shopify; may need the same speed fix if tab loads prove slow.
4. Git commit/push not yet done — this repo's standing rule requires explicit user permission before pushing; today's changes are live on Vercel production only.

# Files Modified
See evidence file: `evidence/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-evidence.md`.

# Evidence Location
`evidence/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-evidence.md`

# Validation Result
PASS (scope: root cause + fix correctness + deployment) — see `validation/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-validation.md`. Multi-month financial reconciliation flagged as open follow-up, not a failure.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, closed pending git push permission.

# PASS / FAIL
PASS

# Next Step
1. Confirm with user whether to git commit/push today's work.
2. Spot-check Feb–Jul totals against Shopify/Google Ads where possible.
3. Decide on the `Shop_SJ_PMax-25` campaign inclusion question.
4. Generate static snapshots for Sajeepan's Jan–Jun if tab load speed becomes an issue.
