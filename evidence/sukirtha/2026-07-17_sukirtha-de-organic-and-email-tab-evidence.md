# Sukirtha — DE Organic (6-Group) + DE Email Tab — Evidence

**Date:** 2026-07-17
**Purpose:** Wire up the DE (ledsone.de) sub-tab on Sukirtha's shared sales dashboard (`reports/digital-marketing-member-pages/pages/sales.html`), previously a "Coming soon" placeholder (see `evidence/sukirtha/2026-07-17_sukirtha-uk-email-sales-tab-evidence.md`). This task builds two DE sections: **DE Organic** (6-group, mirrors Kamsi's full organic-sales definition) and **DE Email** (2-group, mirrors the UK Email pattern already built for Sukirtha).

## Correction applied mid-build
An earlier pass of this task implemented DE Organic with only 2 groups (Fully Organic / First-Session Organic). A correction was issued requiring the FULL 6-group definition matching Kamsi's dashboard (`api/sales-kamsi.js`). Verified in this session that the correction is fully applied everywhere:
- **Endpoint** (`api/sales-sukirtha-de-organic.js`): builds `fullyOrganicRows`, `firstSessionOrganicRows`, `directRows`, `referralRows`, `noJourneyRows`, `aiRows` — six independent buckets, unioned into `combinedSummary` and `allSukirthaOrders`, each row tagged with its `group`.
- **Snapshots** (`api/data/sukirtha-de-organic-sales-2026-0[1-6].json`): each file contains `directSummary`, `referralSummary`, `noJourneySummary`, `aiSummary` alongside `summary` (Fully Organic) and `firstSessionOrganicSummary` — confirmed via direct JSON inspection.
- **sales.html**: `SDO_GROUP_ORDER = ['Fully Organic', 'First-Session Organic', 'Direct', 'Referral', 'No Journey Data', 'AI Tools']` (line 1413), group-breakdown table renders all 6 rows, explanatory sub-text (line 402) lists all 6 groups and the AI Tools source list explicitly.

## Definitions

### DE Organic (6 groups) — mirrors Kamsi's `sales-kamsi.js` exactly, minus product matching
Store-wide (no product-allocation CSV), all 6 groups combined into `combinedSummary`:
1. **Fully Organic** — every touchpoint in `customerJourneySummary` classifies as Organic Search.
2. **First-Session Organic** — first visit classifies as Organic Search, journey not fully organic.
3. **Direct** — channel = Direct.
4. **Referral** — channel = Referral.
5. **No Journey Data** — channel = No Journey Data / Unknown / Attribution Pending.
6. **AI Tools** — first visit's source matches an AI tool (ChatGPT, Perplexity, Gemini, Copilot, Claude, Bing Chat, Meta AI, Grok), extracted from the "Other" channel bucket.

Excludes: Google Ads/Paid Search, Social, Email (Email is the separate DE Email section), Affiliate, non-AI Other.

### DE Email (2 groups) — mirrors Sukirtha UK Email pattern exactly
- **Fully Email** — every touchpoint classifies as Email (`sourceType=NEWSLETTER`, `medium=email`, or source/description containing "email").
- **First-Session Email** — first visit classifies as Email, journey not fully email.

Orders qualifying for neither group are excluded entirely from DE Email totals.

## What was built / verified this session
1. **`reports/digital-marketing-member-pages/api/sales-sukirtha-de-organic.js`** — confirmed complete: 6-group logic, `SUPPORTED_MONTHS = ['2026-01'..'2026-07']`, `CURRENT_LIVE_MONTHS = ['2026-07']` (July month-to-date live-refresh pattern, same as Kamsi's 2026-07-17 addition), static-snapshot caching.
2. **`reports/digital-marketing-member-pages/api/sales-sukirtha-de-email.js`** — confirmed complete: 2-group logic, same `SUPPORTED_MONTHS`/`CURRENT_LIVE_MONTHS` July-live pattern.
3. **12 static snapshots** already present and confirmed correct: `api/data/sukirtha-de-organic-sales-2026-0[1-6].json` (6-group fields present in each), `api/data/sukirtha-de-email-sales-2026-0[1-6].json`. No July snapshot files exist for either (correct — July is served live, not from a snapshot).
4. **`sales.html` DE sub-tab**: both DE Organic and DE Email sections fully wired — no "Coming soon" text remains anywhere in the file (`grep -c "Coming soon"` → 0). Month tabs Jan–Jul 2026 (July marked live with a Refresh button), KPI cards, Export CSV button (`.exportbar` / `class="primary"`), group-breakdown tables (6 rows for Organic, 2 rows for Email, both clickable to filter), line-item order table with search + session-detail expandable rows, footnote sections explaining both definitions. `SDO_`/`SDE_`-prefixed globals/functions used throughout DE-specific code — grepped for collisions against `K_`/`D_`/`S_` prefixes used by Kamsi/Dilaksi/Sukirtha-UK blocks: none found.

## Verification performed (production)
- Deployed to Vercel production: `vercel --prod --yes` → `https://digital-marketing-member-pages.vercel.app` (deployment `dpl_GYgDL8YYdS7KA3PckePvfJYDpSES`).
- Curled production `pages/sales.html`: `grep -c "Coming soon"` → **0**.
- Curled `/api/sales-sukirtha-de-organic?month=2026-06` (historical) → `success:true`, `combinedSummary.ordersCount: 135`, gross €5,731.18, net €5,500.83, all 6 `*Summary` fields present (`firstSessionOrganicSummary`, `directSummary`, `referralSummary`, `noJourneySummary`, `aiSummary` alongside the base Fully-Organic `summary`).
- Curled `/api/sales-sukirtha-de-organic?month=2026-07` (live month-to-date) → `success:true`, `isLive:true`, no errors.
- Curled `/api/sales-sukirtha-de-email?month=2026-06` → `success:true`, `combinedSummary` present.
- Curled `/api/sales-sukirtha-de-email?month=2026-07` → `success:true`, `isLive:true`.

## Results — DE Organic (6 groups combined), ledsone.de, store-wide

| Month | Orders | Gross | Net | Fully Organic | First-Session Organic |
|---|---|---|---|---|---|
| 2026-01 | 250 | €7,642.58 | €7,430.03 | 27 | 25 |
| 2026-02 | 213 | €8,171.83 | €8,059.65 | 13 | 21 |
| 2026-03 | 256 | €10,741.42 | €10,693.22 | 28 | 13 |
| 2026-04 | 205 | €8,314.36 | €8,139.79 | 18 | 15 |
| 2026-05 | 162 | €6,051.80 | €5,902.51 | 14 | 18 |
| 2026-06 | 135 | €5,731.18 | €5,500.83 | 7 | 10 |
| 2026-07 (MTD, live) | 80 | €3,933.94 | €3,928.15 | 7 | 2 |

(Direct / Referral / No Journey Data / AI Tools counts are included in the combined totals above; broken out per-group in each snapshot's `directSummary`/`referralSummary`/`noJourneySummary`/`aiSummary`.)

## Results — DE Email (2 groups combined), ledsone.de, store-wide

| Month | Orders | Gross | Net |
|---|---|---|---|
| 2026-01 | 1 | €17.23 | €17.23 |
| 2026-02 | 2 | €103.85 | €103.85 |
| 2026-03 | 1 | €41.36 | €41.36 |
| 2026-04 | 2 | €57.29 | €57.29 |
| 2026-05 | 2 | €79.18 | €79.18 |
| 2026-06 | 1 | €4.68 | €4.68 |
| 2026-07 (MTD, live) | 1 | €43.77 | €43.77 |

## Credentials
Existing `SHOPIFY_ADMIN_TOKEN` env var (already in Vercel production), store domain `ledsone-de.myshopify.com`, API version `2024-10` hardcoded (matches `api/sukirtha-req2-duplicate-check.js` pattern). No new env vars created.

## Files modified/created
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de-organic.js`
- `reports/digital-marketing-member-pages/api/sales-sukirtha-de-email.js`
- `reports/digital-marketing-member-pages/api/data/sukirtha-de-organic-sales-2026-01.json` through `-06.json`
- `reports/digital-marketing-member-pages/api/data/sukirtha-de-email-sales-2026-01.json` through `-06.json`
- `reports/digital-marketing-member-pages/pages/sales.html` (DE sub-tab wiring, `SDO_`/`SDE_`-prefixed JS blocks)
- `evidence/Sukirtha/2026-07-17_sukirtha-de-organic-and-email-tab-evidence.md` (this file)

## Status: PASS
- DE Organic 6-group correction confirmed live in production (not the old 2-group version) — endpoint, all 6 snapshots, and `sales.html` all implement the full 6-group definition.
- Both DE sections render correctly in production — no "Coming soon" placeholder remains.
- July month-to-date live-refresh works for both DE Organic and DE Email with no errors.
- Vercel production deploy verified via direct curl of the live endpoints and HTML.

**Reviewer:** self-verified via live production curl checks (see Verification section).
**Next step:** none — DE sub-tab build is complete for both Organic and Email sections.
