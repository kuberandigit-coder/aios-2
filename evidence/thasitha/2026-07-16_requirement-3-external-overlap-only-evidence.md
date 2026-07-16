# Evidence — Thasitha Requirement 3: Show only SKUs with a currently-running external overlap

**Date:** 2026-07-16
**File:** `reports/digital-marketing-member-pages/pages/thasitha.html`
**Purpose:** User requested R3 show only SKUs where the product is currently running in Thasitha's campaign(s) AND at least one other (non-Thasitha) currently-ENABLED campaign — if a SKU only runs in Thasitha's own campaigns, it should not appear at all.

## Bug found
Checked the live embedded `R3_DATA` (327 SKUs) with a Node script:
- 96 of 327 SKUs had **no external (non-Thasi) campaign** in their `camps` array at all — they only appeared in Thasitha's own MT/THT campaigns, which is not a real cross-owner overlap.
- 0 SKUs had any non-ENABLED campaign (confirmed live against `google_ads.campaigns` for all 9 distinct campaign IDs referenced — all still ENABLED as of 2026-07-16, no drift since the 2026-07-15 build).

## Fix
Added a filter at the top of `renderR3()`'s `R3_DATA.filter()`: `o.camps.some(c => !c.isThasi)` — rows without at least one external ENABLED campaign are excluded entirely, before any other filter/search logic runs.

## Result
231 of 327 SKUs remain (96 removed). All 231 still resolve a product title/image (100%). Status-note text and hardcoded counts (327→231, "328 overlapping SKUs"→"231") updated to match. KPI card (`r3kpiTotal`) already computed dynamically from `rows.length`, no separate fix needed there.

## Commit / Deploy
`d8150a5` — pushed to `github.com/kuberandigit-coder/aios-2` (main).
`vercel --prod` — production deployment `digital-marketing-member-pages-naa4m092n.vercel.app`, READY.
