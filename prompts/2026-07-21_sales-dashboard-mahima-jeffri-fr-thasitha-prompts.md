---
title: Reusable prompts — Mahima/Jeffri/FR onboarding/Thasitha tabs, race-condition fix
date: 2026-07-21
type: prompt-log
---

# Purpose
Reusable prompt patterns from today's session, kept for future similar staff-attribution tab builds or bug diagnoses on this dashboard.

# Prompt 1 — Deep-search a staff member's real UTM identifiers before building a rule
> "please check again for jeff and his other utm search, the given data is have gap amount too high comparing in google ads please deep search every orders in shopify for jeff and others trm term and update"

**When to reuse:** whenever a new staff Google Ads attribution rule needs validating against real Shopify data before trusting it. Pattern: add a temporary `debugAllTerms<Name>=1` query flag to the shared API file that dumps every order's raw first-session `source/medium/campaign/term/content` for a given month, regardless of match — then eyeball the distinct values against the confirmed identifier list to catch missed variants. Always add `&refresh=1` when the month already has a snapshot, since the static-snapshot check happens before the debug branch.

# Prompt 2 — Cross-reference against the Postgres campaign/performance tables
> "ok in data base tell me about all total champaign sales amout of january jeffri champaigns only"

**When to reuse:** whenever a staff member's Shopify-side dashboard total needs comparing against Google Ads' own platform-reported number. Query `google_ads.campaigns` (filter `group_name`) joined to `google_ads.campaign_performance` for cost/conversions/conversion_value, restricted to the date range. Always explain the expected gap (click-date bucketing, Google's own attribution model vs. strict first-session Shopify rule, no refund adjustment) rather than trying to force the two numbers to match.

# Prompt 3 — Race-condition diagnosis phrasing
> "the june tab of mahima is not working showing july data please fix that"

**When to reuse:** this phrasing (tab X showing data from tab/month Y) is the signature symptom of a stale in-flight fetch completing after the user has already switched selection. Fix pattern: sequence-token guard (`let xLoadSeq = 0; const seq = ++xLoadSeq;` captured at function entry, checked after every `await`), not a blocking `if (loading) return`.

# Prompt 4 — New staff Google Ads tab, minimal build request
> "create a new tab for thasitha and her utm term is thasi she is working in google ads ledsone.de new tab for her and update her sales"

**When to reuse:** template for onboarding a new staff member's Google Ads tab when the rule is already simple (single exact utm_term match). Steps: add staff branch in the shared API file (utm_term Set, exact match, case-insensitive) → add snapshot filename mapping → add frontend tab (copy an existing simple tab's HTML/JS structure) → generate snapshots for closed months → deploy → verify live order counts per month.

# Prompt 5 — New store onboarding with a live token pasted in chat
> "shpat_... this is the ledsone.fr api key, hetheesa and thivajini are responsible for ledsone.fr..."

**When to reuse:** whenever a live Shopify token is pasted directly in chat. Non-negotiable handling: never write it to any file; store only as a Vercel Sensitive env var (`vercel env add ... production`, piped via stdin); verify the token with a single read-only `shop.json` call before building anything; resolve the real `.myshopify.com` handle if the given domain is a custom domain (checked via internal AIOS docs).
