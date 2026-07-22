---
title: Sajeepan Google Ads Tab — Campaign-Name Match Fix, Live Tab Added
date: 2026-07-22
type: evidence
---

# Title
Sales Dashboard (`reports/digital-marketing-member-pages/pages/sales.html`) — fixed Sajeepan's broken Google Ads attribution rule (was matching on `utm_term`, which real Shopify data showed misses ~96% of her orders) by switching to `utm_campaign` matching against her 11 confirmed campaign names, and added the missing live Sajeepan tab to the dashboard (Jan–Jun historical + July live), mirroring the Thasitha tab pattern.

# Purpose
User flagged on 2026-07-21/22 that the previously-added Sajeepan tab was "not finished and not correct." The API endpoint (`staff=sajeepan-ads`) existed but had no UI tab, and its matching logic was later found to be wrong.

# Business Question
Which Shopify orders actually belong to Sajeepan's Google Ads campaigns, and can staff/the user see her sales on the same live dashboard as Thasitha, Jeffri, etc.?

# Requirement Source
Live user instructions, chronological:
1. "sajeepan is not finished and not correct" — flagged the existing implementation.
2. User provided one full UTM tracking-template URL (`utm_term=GENAI&keyword=GENAI&Content=SJ`) and asked to find matching orders.
3. "do not write html now tell me... could you find in ledsone.co.uk website shopify for sajeepan orders" — requested a direct data lookup, not a code change yet.
4. User provided all 11 of Sajeepan's confirmed UTM tracking-template URLs and said: "these all are sajeepan utm... you need to analysis january month all order deeply 1st session have these utm in shopify that all belongs to sajeepan do not write in sales.html analysis january and submit here" — requested a deep January-only audit before any code changes.
5. "create sajeepan tab next to thasitha and add jan to june and july live with these utms and deploy" — authorized the fix + full tab build + deploy.
6. "save aios" — this documentation.

# Sources Checked
- Shopify Admin GraphQL API, store `ledsone.co.uk` (`ledsone.myshopify.com`), via the deployed `/api/sales-sukirtha-de?staff=sajeepan-ads` endpoint (uses the `SHOPIFY_UK_ADMIN_TOKEN` Vercel server-side env var).
- Temporary debug endpoint (`&debugAllTermsSajeepan=1`) added to the same file to dump every January order's first-session `source/medium/campaign/term/content` for manual cross-check against the user's 11 given tracking templates.

# Implementation

## Root cause found (January deep audit)
Parsed the user's 11 tracking-template URLs into campaign name + expected `utm_term`. Cross-checked all 2,400 January orders' real first-session UTM data against both fields:
- Matching by **campaign name**: found 55 real orders across 5 of the 11 campaigns (`Accessories_sj` 25, `GCSS_ALL_ROAS_400_SAJEE_PMAX` 20, `Klarna_P` 5, `SJ_TOP_20X` 3, `sajeepan_pmax_gcss_ceiling_rose_fitting_asset` 2).
- Matching by the **old `utm_term`-only rule**: only 2 of those 55 orders were caught (the `unnai_nampu` ones).
- Root cause: Google Ads is not passing the literal ValueTrack template text into `utm_term` for most of her campaigns — real values came back as `null`, `ASSET_SJ`, `MODULE`, or `Top_SELL` instead of the assumed literal strings (e.g. `"lighting_sj&keyword={keyword}"`). `utm_campaign` is stable and correctly recorded; `utm_term` is not.

## Fix — `api/sales-sukirtha-de.js`
- Replaced `SAJEEPAN_TERMS` (a `Set` of 7 literal `utm_term` strings) with `SAJEEPAN_CAMPAIGNS` (11 base campaign names) and a new `isSajeepanCampaign(campaign)` helper — case-insensitive exact match OR prefix match (to handle a confirmed Shopify-side suffix variant: `sajeepan_pmax_gcss_ceiling_rose_fitting` stored as `..._asset`).
- Rewrote the `staff === 'sajeepan-ads'` matching loop to filter on `utm.campaign` via `isSajeepanCampaign()` instead of `utm.term`.
- `row.campaign` (used for grouping/CSV export) now holds the real `utm_campaign` value instead of `utm_term`.
- Updated the API's `source.scope` description to document the corrected rule and note it supersedes the old one.
- Extended the debug endpoint to also return `orderTotal`/`currency` per order (kept as a debug-only, opt-in diagnostic; unused by any deployed tab).

## New Sajeepan tab — `pages/sales.html`
Added a full tab mirroring Thasitha's pattern exactly, with distinct `sj`-prefixed globals/functions (`SJ_DATA`, `sjLoad`, `sjSelectMonth`, `sjRenderAll`, `sjcRenderTable`, `sjGroupExportCsv`, etc.) to avoid any collision with existing tabs:
- Tab button placed immediately after Thasitha's in the top nav.
- Month tabs: January–June (historical, no refresh) + July (live, with a Refresh button) — matches `SUPPORTED_MONTHS` already returned by the API.
- Cards: Total Orders, Units Sold, Gross Sales, Refunds, Net Sales, Unique Products, Data Retrieved At.
- Campaign summary table (grouped by `utm_campaign` instead of `utm_term`, since that's now the match key) — clicking a row filters the line-item table below.
- Full line-item table with session-detail expand rows, filters (order name, product ID, campaign dropdown), and CSV export.
- Store/timezone correctly set to `ledsone.co.uk` / Europe/London throughout (currency confirmed `GBP` from the live API response, not `EUR`).
- Footnote documents the corrected campaign-match rule, all 11 campaign names, and explicitly states it supersedes the earlier `utm_term` rule.

# Files Modified
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de.js` — `SAJEEPAN_TERMS` → `SAJEEPAN_CAMPAIGNS` + `isSajeepanCampaign()`; matching loop rewritten to campaign-based; `source.scope` text updated; debug endpoint extended with `orderTotal`/`currency`.
- `reports/digital-marketing-member-pages/pages/sales.html` — new Sajeepan tab button, tab content block, and ~230-line JS module (`sjLoad`/`sjRenderAll`/etc.) added.

# Evidence Location
This file.

# Validation Result
See `validation/sales/2026-07-22_sajeepan-ads-tab-campaign-match-fix-validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production (`vercel --prod`). Live tab confirmed reachable; full month-by-month total reconciliation still pending (see Next Step).

# PASS / FAIL
PASS — root cause confirmed and fixed (campaign-name matching replaces broken term-only matching); tab deployed and wired to the corrected endpoint.

# Next Step
1. Pull financial totals (Gross Sales, Net Sales, Orders) for Feb–Jul to confirm the fix across all months, not just the January audit.
2. Confirm with user whether the unlisted-but-similar campaign `Shop_SJ_PMax-25` (1 order in January) should also be included.
3. Consider generating static snapshot files for Jan–Jun (like Thasitha/Hetheesha/Thivagini) if live Shopify fetch proves slow on repeated tab visits.
4. Git commit/push — pending explicit user permission per repo's standing rule.
