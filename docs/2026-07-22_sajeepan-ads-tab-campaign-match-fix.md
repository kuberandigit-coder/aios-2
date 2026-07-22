---
title: 2026-07-22 Daily Log — Sajeepan Google Ads Tab Fix + Deploy
date: 2026-07-22
type: daily-doc
---

# Summary
Fixed Sajeepan's Google Ads sales attribution on `reports/digital-marketing-member-pages/pages/sales.html`, which the user had flagged as "not finished and not correct." Root cause: the original rule matched orders by exact `utm_term`, but real Shopify data showed Google Ads doesn't pass the literal tracking-template text into `utm_term` for most of her campaigns — a January deep-audit found it caught only 2 of 55 real orders. Switched matching to `utm_campaign` (her 11 confirmed campaign names), built and deployed the missing live Sajeepan tab (Jan–Jun + July live), mirroring the Thasitha tab.

# What Shipped
- Root-cause audit: parsed 11 user-provided Google Ads tracking-template URLs, cross-checked all 2,400 January orders' real first-session UTM data by both campaign name and term — confirmed campaign-name matching is the reliable key (55 real orders vs. 2 caught by the old term rule).
- Fixed `api/sales-sukirtha-de.js`: replaced `SAJEEPAN_TERMS` (utm_term Set) with `SAJEEPAN_CAMPAIGNS` + `isSajeepanCampaign()` (utm_campaign exact/prefix match).
- Added the missing Sajeepan tab to `sales.html` — full month range Jan–Jun (historical) + July (live), cards, campaign summary, line-item table with session drill-down, filters, CSV export.
- Deployed to Vercel production (`vercel --prod`); confirmed live.

# Not Yet Done
- Feb–Jul totals not independently spot-checked (only January was deep-audited, per explicit user request, before the fix went out).
- One unlisted-but-similar campaign (`Shop_SJ_PMax-25`, 1 January order) flagged to user, not yet decided.
- No static snapshots generated yet for Sajeepan's historical months (every visit re-fetches live from Shopify).
- Git commit/push — awaiting explicit user permission.

# Full Detail
See `evidence/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-evidence.md`, `validation/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-validation.md`, and `closure/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-closure.md`.
