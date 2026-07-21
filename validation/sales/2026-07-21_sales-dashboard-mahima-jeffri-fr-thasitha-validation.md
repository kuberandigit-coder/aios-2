---
title: Sales Dashboard — Mahima/Jeffri/Hetheesha/Thivagini/Thasitha validation
date: 2026-07-21
type: validation
---

# Title
Validation — new/corrected sales-attribution tabs and race-condition fix, 2026-07-21.

# Purpose
Confirm every new or corrected staff attribution rule deployed today matches real Shopify order data, and confirm the month-switching race-condition fix works as intended.

# Checks Performed

## Structural
- `node -c` / ESM parse check on `api/sales-sukirtha-de.js` after every edit — passed each time.
- Full `<script>` block from `sales.html` run through `new Function(...)` after every edit — passed each time, no syntax errors introduced.
- `<div>`/`</div>` balance count checked after every HTML restructure — stayed at the same known baseline offset (-1, a pre-existing false positive from a template-literal string, not a real imbalance) throughout the day.
- Serverless function count (`find api -name "*.js"`) checked before every deploy — held at 11 (+ `api/jefri/product-status.js` = 12) all day, confirming no Hobby-plan cap breach.

## Mahima — Google Ads (utm_term)
- Deep-searched April 2026 first-session `utm_term` values (`debugAllTerms` diagnostic) against the 8 confirmed terms: all 8 found with orders (68 `april_15`, 67 `mahi`, 19 `sep_25`, 17 `bestselling`, 11 `march_15`, 2 `april_01`, 2 `dec_30`, 1 `{searchterm}`) — sum (187) matched `combinedSummary.ordersCount` exactly.
- User pasted a real list of 197 Shopify order names for April; cross-checked against the dashboard's 187 matched orders — all 10 differences explained (Direct/No-Journey-Data first-touch, Jeffri's term, `content`-only "mahi" match, or non-Mahima-product orders) — no unexplained gaps.
- Live-verified all 7 months (Jan 233 / Feb 186 / Mar 198 / Apr 187 / May 159 / Jun 94 / Jul-live 80 orders) after month-tab support was added.

## Jeffri (final rule: utm_term = jeff/Jeichitom_Maara, fallback utm_medium=SMARKETER_sale)
- Live-verified all 7 months post-fix: Jan 297 / Feb 486 / Mar 500 / Apr 408 / May 261 / Jun 170 / Jul-live 113 orders (gross €8,699–€15,544 range).
- July breakdown confirmed both term values present: 108 orders `Jeff`, 5 orders `Jeichitom_Maara`.

## Thasitha (utm_term = thasi)
- Jan–Apr snapshots generated and confirmed `success:true` with plausible order counts (April = 4 orders, consistent with the earlier deep-search finding of "thasi" appearing 4 times in April).

## Hetheesha / Thivagini (ledsone.fr)
- Token connectivity verified directly (`shop.json` call, HTTP 200) before any tab was built.
- June 2026 live-verified: Hetheesha 36 orders / €3,073.29 gross; Thivagini (pre-fix, Paid-Search-only) 17 orders / €1,029.17.
- **January cross-check (the critical validation for this pair):** raw Shopify order count for January = 32 (`orders/count.json`). Pre-fix: Hetheesha 24 + Thivagini 4 = 28 (4 orders unaccounted for). Post-fix (Thivagini = balance of non-organic channels): Hetheesha 24 + Thivagini 8 = **32 — exact match**. Thivagini's new channel breakdown showed the 4 newly-included orders as 3 "Other" + 1 "Email", confirming the fix targeted the right gap.

## Race-condition fix
- Root cause confirmed by code inspection: `if (xLoading) return;` blocked re-entrant month-switch calls instead of cancelling them, so a stale in-flight fetch for a previously-selected month could complete and overwrite `X_DATA` after the user had already switched to a different month/tab.
- Fix applied identically to all 8 (later 11, as new tabs were added) load functions using a captured-month + sequence-number pattern; verified via code review that every fetch/cache-hit path checks `if (seq !== xLoadSeq) return;` before touching shared state, and that the old blocking guards were fully removed (`grep` confirmed zero remaining `if (xLoading) return` occurrences after the fix).

# Validation Result
PASS on all items above. No discrepancies found that weren't already explained and resolved during the session.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# PASS / FAIL
PASS
