---
title: Sajeepan Google Ads Tab — Campaign-Match Fix validation
date: 2026-07-22
type: validation
---

# Title
Validation — Sajeepan Google Ads attribution rule fix and new live dashboard tab (2026-07-22).

# Purpose
Confirm the root cause of the "not correct" Sajeepan data was real, confirm the campaign-name fix is materially more accurate than the old term-only rule, and confirm the new tab is live and wired to the corrected endpoint.

# Checks Performed

## Root cause confirmation
- Called the live `staff=sajeepan-ads` endpoint for January 2026 before the fix: `matchedOrders: 0` for the specific campaign the user first asked about (`SJ_PMAX_Scale_Heroes_25` / term `GENAI&keyword=GENAI&Content=SJ`), and `matchedOrders: 2` for the full month (both `unnai_nampu`).
- Pulled all 2,400 January orders' first-session UTM fields via a temporary debug flag and cross-checked against the user's 11 given tracking-template URLs by both `utm_campaign` and `utm_term`:
  - Campaign-name match: **55 orders** across 5 campaigns.
  - Old term-only match: **2 orders** (same `unnai_nampu` ones already found).
  - Confirms the old rule missed 53 of 55 real January orders (~96%) — a genuine, quantified bug, not a definitional disagreement.
- Confirmed real `utm_term` values differ from the assumed literal template strings (e.g. `Accessories_sj`/`Klarna_P` campaigns recorded `utm_term: null`; `GCSS_ALL_ROAS_400_SAJEE_PMAX` recorded `ASSET_SJ`/`MODULE`, not the assumed `LIGHTING_SJ&keyword={keyword}`) — explains why campaign name, not term, is the reliable match key.

## Currency check
- Confirmed live API response for `ledsone.co.uk` returns `currency: "GBP"` (previously the dashboard's static footnote text implied EUR in one earlier variant of this tab — verified GBP is what the endpoint actually returns and is what's rendered).

## Code review
- `isSajeepanCampaign()` uses exact-match OR prefix-match (case-insensitive) to correctly catch the confirmed Shopify-side suffix variant (`sajeepan_pmax_gcss_ceiling_rose_fitting` → stored as `..._asset`), without using a wildcard broad enough to false-positive on unrelated campaigns (checked against the 11 named campaigns only, not a generic substring like "sj" — deliberately excluded matching campaigns like `Shop_DM_PMax-25`/`Aji_Sh_PMax`/`Klarna_Sonya_kl-pmx-all` that were not in the user's confirmed list, even though they matched loose "sj/klarna/pmax" text patterns).
- Confirmed `amt()`/`ccy()` helper functions (used in the debug endpoint's new `orderTotal`/`currency` fields) are top-level functions already in scope at the point of use — no runtime error risk.

## Deployment
- `vercel --prod --yes` completed with `readyState: READY`, aliased to `https://digital-marketing-member-pages.vercel.app`.
- New Sajeepan tab HTML/JS confirmed present in the deployed `sales.html` (tab button, month tabs, cards, campaign summary table, line-item table, CSV export, footnote all mirror the Thasitha pattern with `sj`-prefixed identifiers, no naming collisions with existing tabs' globals).

# Validation Result
PASS on root-cause confirmation and code-level correctness of the campaign-match fix. **Not yet independently confirmed**: full financial totals (Gross/Net Sales, order counts) for February–July — only January was deep-audited per the user's explicit request before deployment.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# PASS / FAIL
PASS (scope: root cause + fix correctness + deployment). Multi-month financial reconciliation is an open follow-up, not a failure of this task's stated scope (user asked for January analysis specifically, then authorized the tab build).
