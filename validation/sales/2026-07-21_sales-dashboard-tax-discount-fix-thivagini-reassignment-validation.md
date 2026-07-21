---
title: Sales Dashboard — Tax/Discount Fix, Reassignment, Recovery validation
date: 2026-07-21
type: validation
---

# Title
Validation — tax/discount calculation fix, No-Journey-Data reassignment, deployment recovery, snapshot speed fix (2026-07-21, second block).

# Purpose
Confirm the corrected Gross/Net Sales calculation matches Shopify's own report, confirm the 41-order reassignment preserved a clean partition, confirm production is genuinely restored, and confirm snapshot-based tabs load fast.

# Checks Performed

## Tax/discount fix
- Root cause confirmed via raw order dump (`debugOrderRaw=LSFR1366`): order-level `currentTotalDiscountsSet=€25.56` existed but line-item `discountedTotalSet` showed no discount at all; line item's `taxLines` showed 20% FR TVA = €38.34, and the tax-inclusive/ex-tax math reconciled exactly (230.04 = 191.70 net + 38.34 tax), confirming prices are VAT-inclusive.
- Post-fix May 2026 combined (Hetheesha + Thivagini) figures compared directly against the user's own Shopify Sales report screenshot:
  - Gross Sales: dashboard €3,944.95 vs Shopify €3,928.62 (0.4% diff)
  - Discounts: dashboard €82.90 vs Shopify €81.21
  - Refunds/reversals: dashboard €17.57 vs Shopify €14.64
  - Net Sales: dashboard €3,844.48 vs Shopify €3,832.77 (0.3% diff)
  - Order Total: dashboard €5,184.69 vs Shopify €5,184.69 — **exact match** (unaffected by the bug, since it's pulled directly from `currentTotalPriceSet`, not recomputed).
- Confirmed the fix is in shared code (`buildSukirthaOrderRow`/`buildSukirthaOrderRowEmail`), not month- or tab-specific, so it applies to all months and all staff tabs going forward.

## No-Journey-Data → Thivagini reassignment
- 41 orders identified via 90-day-pre-purchase Google Ads click cross-reference (real click, not just impression) across Jan–Jul(21): 161 total No-Journey orders, 41 matched (~€3,589), 120 did not (~€7,598).
- Live-verified post-deploy for all 7 months that Hetheesha + Thivagini order counts still sum to each month's exact total, confirming the reassignment didn't break the mutually-exclusive/exhaustive partition:
  - Jan: 23+9=32 | Feb: 25+24=49 | Mar: 32+30=62 | Apr: 27+27=54 | May: 40+29=69 | Jun: 32+21=53 | Jul: 29+21=50
- Spot-checked `LSFR1158` (Jan): confirmed absent from Hetheesha's `allSukirthaOrders`/`noJourneySummary`, present in Thivagini's `allThivaginiAdsOrders` tagged `channel: "No Journey Data (Ad-Click Matched)"`.

## Deployment recovery
- `vercel inspect --logs` on the deployment that broke production showed it cloned from `github.com/digitalmarketing69140951-sys/Staff-requirements` (stale commit), with a completely different function set than our actual repo.
- Confirmed root API (`sales-sukirtha-de.js`) was entirely absent from that build (only 5 of its 11 real functions listed, all with unfamiliar names).
- Redeployed from local directory; confirmed restored via a live 200 response with correct payload structure on `staff=kamsi`.

## Snapshot / speed fix
- Confirmed zero snapshot files existed for Hetheesha/Thivagini before this fix (`ls api/data/ | grep -i hetheesha|thivagini` returned nothing).
- Generated all 6 months for both, plus regenerated Thasitha's Jan–Apr and newly generated May/June — all 12+6=18 files validated with `node -e require(...)` parse check, all `success:true` with plausible order counts.
- Post-deploy live timing check across all 3 tabs × 7 months: Jan–Jun consistently ~0.5–0.9 sec (`cacheStatus: static-snapshot`), July ~1.4–9.7 sec (`cacheStatus: miss`, expected for the live month).

## Final sweep — all non-Sajeepan tabs confirmed live and correct
Live-refetched July (current live month) for 8 tabs, all returned HTTP 200 with real order counts: Kamsi (68), Sukirtha UK (68), Mahima Organic (49), Mahima Google Ads (80), Jeffri (116), Thasitha (15), Hetheesha (29), Thivagini (21).

# Validation Result
PASS on all items above.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# PASS / FAIL
PASS
