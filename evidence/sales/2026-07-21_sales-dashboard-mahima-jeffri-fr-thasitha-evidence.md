---
title: Sales Dashboard — Mahima/Jeffri/Hetheesha/Thivagini/Thasitha tabs, race-condition fix, FR store onboarding
date: 2026-07-21
type: evidence
---

# Title
Sales Dashboard (`reports/digital-marketing-member-pages/pages/sales.html`) — full day's work: Mahima tab rebuild (Organic, Total, Google Ads utm_term), Jeffri tab (built, then rule corrected twice), new ledsone.fr onboarding (Hetheesha + Thivagini standalone tabs), new Thasitha tab, cross-tab month-switching race-condition fix, and speed fixes via static snapshots.

# Purpose
Continuation of the multi-day sales-attribution dashboard build for the digital marketing team. Today's session covered: correcting Mahima's Google Ads attribution rule multiple times based on real Shopify data audits, removing/re-adding/restructuring Mahima's sub-tabs per live user direction, onboarding a brand-new store (ledsone.fr) with a new Shopify Admin token, building two new staff members' Google Ads attribution tabs (Jeffri, Thasitha) using a `utm_term`-exact-match methodology validated against real order data, and fixing a page-wide race condition where switching months quickly could show stale data from a previous month.

# Business Question
Give each SEO/Ads staff member (Kamsi, Dilaksi, Sukirtha, Mahima, Jeffri, Hetheesha, Thivagini, Thasitha) an accurate, auditable view of "their" sales, broken down by the correct definition of ownership (product-scoped vs. channel-scoped vs. UTM-term-scoped), matching real campaign data rather than assumptions.

# Requirement Source
Live, iterative user instructions throughout 2026-07-21 conversation (paraphrased chronologically):
1. Remove Mahima's Ads + ID Sales sub-tabs, keep only Organic — done, then partially reverted.
2. New Google Ads tab for Mahima based on confirmed `utm_term` values (`mahi`, `bestselling`, `march_15`, `sep_25`, `{searchterm}`, `april_01`, `april_15`, `dec_30`) — deep-searched against real April order data to confirm no missed variants.
3. Fix slow month-tab loading (missing static snapshots) — repeated for every new tab built today.
4. Create standalone Jeffri tab; user found and fixed the rule twice as more real order data was reviewed (first: "jeff" substring across UTM fields; then Google-family-platform restriction; final: `utm_term` exact match on `jeff`/`Jeichitom_Maara`, with `utm_medium=SMARKETER_sale` fallback when no term is present).
5. Create a new "Total" sub-tab for Mahima (all channels, unfiltered, product-scoped) — later removed per user, its content was product-scoped total sales.
6. Remove all Mahima sub-tabs a second time except Organic, then re-add "Google Ads" (utm_term) as a second sub-tab.
7. Fix a real bug: entire Jeffri tab JS block had been accidentally deleted during an earlier bulk-removal of Mahima's sub-tabs (it was physically located between two Mahima JS blocks in the file) — rebuilt from scratch.
8. Onboard `ledsone.fr` — user supplied a live Shopify Admin API token in chat; store domain resolved via internal AIOS docs (`jedsz8-km.myshopify.com`) since `ledsone.fr` custom domain isn't the Admin API host.
9. Build Hetheesha (Organic) + Thivagini (Google Ads) tabs for ledsone.fr, initially as sub-tabs, then split into two standalone top-level tabs per user request.
10. Fix Thivagini's definition: user clarified "after organic add all to thivagini" meant Thivagini should get the *balance* (everything NOT in Hetheesha's organic groups), not just Paid Search — this left Social/Email/Affiliate/non-AI-Other orders uncounted by either tab, verified against Shopify's raw order count for January (32 total; was 4+24=28, now 8+24=32 — exact match).
11. Diagnose and fix a page-wide race condition: switching month tabs quickly (e.g. clicking June while July's initial load was still in flight) could show a previous month's data under the newly-active tab, because the code used `if (loading) return` to block re-entrant calls instead of properly cancelling and restarting — fixed with a sequence-token pattern across all 8 load functions.
12. Build a new standalone Thasitha tab, `utm_term = "thasi"`, mirroring Jeffri's final structure exactly.

# Security Handling
User pasted a live Shopify Admin API token for `ledsone.fr` (`shpat_...`) directly in chat. Per established session precedent:
- The token was **never written to any file in this repository** at any point.
- Verified the token and resolved the store's real Shopify backend domain (`jedsz8-km.myshopify.com`, found via `ledsone-aios-mcp` internal docs — `CONTEXT.md` lists `ledsone.fr` → shopify handle `jedsz8-km`) using a single read-only `shop.json` call before doing anything else.
- Stored the token only as a new Vercel **server-side, Sensitive** environment variable (`SHOPIFY_FR_ADMIN_TOKEN`) via `vercel env add ... production` (piped via stdin, never echoed back in any file or committed content).
- Confirmed shop identity (`LED Sone FR`, `ledsone.fr`, EUR, `fr` locale) before building anything further.

# PostgreSQL Sources Checked
`ledsone-aios-mcp` (`CONTEXT.md`, `google_search_console/relationships.md`, `google_analytics/relationships.md`, `listings/tables/shopify_listing_meta.md`) — used only to resolve the ledsone.fr → `jedsz8-km` Shopify handle mapping. No PostgreSQL writes; read-only lookups.

# Shopify Sources Checked
- `ledsone-de.myshopify.com` (existing token) — Mahima, Jeffri, Thasitha tabs; Sukirtha's existing tabs untouched.
- `jedsz8-km.myshopify.com` (new `SHOPIFY_FR_ADMIN_TOKEN`) — Hetheesha, Thivagini tabs.
- Multiple live diagnostic queries run directly against Shopify Admin GraphQL (via temporary `debugAllTerms`/`debugAll` opt-in query flags added to the shared API file, never used by the deployed tabs themselves) to audit real `utm_term`/`utm_medium`/`utm_source`/`utm_campaign` values before committing to a matching rule — this is what caught the "Jeff" term appearing on Shoparize traffic, the `36_pmax`/`mahi` content-field discovery, and the January Hetheesha+Thivagini gap.

# Implementation

## API (`reports/digital-marketing-member-pages/api/sales-sukirtha-de.js`)
Extended the existing merged function (kept at 11 files + `api/jefri/product-status.js` = 12, staying under the Vercel Hobby plan's 12-function cap all day) with new `staff` query values:
- `mahima-ads-term` — first-session `utm_term` exact match against 8 confirmed Mahima terms.
- `jeffri-ads` — rewritten twice; final rule: first-session `utm_term` exact match on `jeff`/`Jeichitom_Maara`, falling back to `utm_medium === 'SMARKETER_sale'` when no term is present.
- `thasitha-ads` — first-session `utm_term` exact match on `thasi`.
- `hetheesha-organic` — store-wide (not product-scoped) organic definition identical to Kamsi/Sukirtha, but against the new `STORE_DOMAIN_FR`/`TOKEN_FR`.
- `thivagini-ads` — store-wide "balance" definition: every order that is NOT one of Hetheesha's 6 organic groups (uses a shared `isHetheeshaOrganicGroup()` helper to guarantee the two tabs always sum to the store's full order total).
- `mahima-total` (built, then removed per user) and `mahima-id-ads` (built, then removed per the earlier Mahima sub-tab cleanup) — both fully reverted; their backend branches remain in the file but are unused by the current frontend.

Refactored `shopifyGraphQL()` and `fetchOrdersForMonth()` to accept optional `storeDomain`/`token` overrides (defaulting to the existing DE store/token) so the FR store could be added without a second serverless function.

## Frontend (`reports/digital-marketing-member-pages/pages/sales.html`)
- Rebuilt Mahima's tab down to Organic + "Google Ads" (utm_term) sub-tabs only, after two rounds of add/remove per live user direction.
- Rebuilt the entire Jeffri tab's JavaScript from scratch after discovering it had been accidentally deleted (collateral damage from an earlier bulk line-range removal targeting Mahima's blocks, which the deleted Jeffri block happened to sit inside).
- Added two new standalone top-level tabs: Hetheesha · FR, Thivagini · FR (with a channel-breakdown table on Thivagini's tab for transparency into what "balance" contains).
- Added a new standalone Thasitha tab.
- **Race-condition fix**: added a sequence-token (`let xLoadSeq = 0; const seq = ++xLoadSeq;`) to all 8 month-tab load functions (Kamsi, Dilaksi, Sukirtha UK, Sukirtha DE Organic, Sukirtha DE Email, Mahima Organic, Mahima Google Ads, Jeffri, Thasitha, Hetheesha, Thivagini — applied broadly since the bug was systemic, not tab-specific), replacing the old `if (loading) return` blocking guard. Each load now captures its target month locally and discards its own result if a newer call has started in the meantime, so a stale in-flight fetch can never overwrite a newer selection.
- Added per-month client-side result caching (separate from the fix above) so repeat visits to an already-loaded month/tab don't re-fetch at all unless the user clicks Refresh.

## Static snapshots (`reports/digital-marketing-member-pages/api/data/*.json`)
Generated/regenerated for speed after every rule change that touched historical months: `mahima-de-ads-term-sales-2026-0{1-6}.json`, `jeffri-de-ads-sales-2026-0{1-6}.json` (regenerated twice as the rule changed), `thasitha-de-ads-sales-2026-0{1-4}.json` (Jan–Apr done; May/Jun interrupted by user redirect, not yet generated). Hetheesha/Thivagini (FR) have no snapshots yet — first load of each closed month will still hit Shopify live until generated.

# Files Modified
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de.js`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `reports/digital-marketing-member-pages/api/data/mahima-de-ads-term-sales-2026-0{1-6}.json` (new)
- `reports/digital-marketing-member-pages/api/data/jeffri-de-ads-sales-2026-0{1-6}.json` (regenerated)
- `reports/digital-marketing-member-pages/api/data/thasitha-de-ads-sales-2026-0{1-4}.json` (new, partial — 05/06 pending)
- Vercel production environment: added `SHOPIFY_FR_ADMIN_TOKEN` (Sensitive, Production only)

# Evidence Location
This file.

# Validation Result
See `validation/sales/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha-validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
All changes deployed to Vercel production and verified live via curl at each step (per-tab order counts and gross sales spot-checked against expected numbers, including the Hetheesha+Thivagini=store-total cross-check for January). **Not committed to git** — pending explicit user permission per this repo's standing workflow rule.

# PASS / FAIL
PASS — all endpoints verified returning correct `success:true` data live in production at time of writing. Two known follow-ups open (see Next Step).

# Next Step
1. Generate remaining Thasitha snapshots (`2026-05`, `2026-06`) — was mid-fetch when interrupted by this documentation request.
2. Generate Hetheesha/Thivagini (FR) snapshot files for Jan–Jun (currently un-cached, will be slow on first load each month).
3. User to confirm whether git commit/push is authorized for today's changes.
4. Two backend branches (`mahima-total`, `mahima-id-ads`) are now dead code in the API file (frontend UI was removed) — flagged for cleanup if/when convenient, not urgent.
