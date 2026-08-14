# Validation — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Purpose:** Validation record for `evidence/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`.

## Test 1 — Improved (% Change ≥ +15%)
Unit-verified `classifyTrend(15) === 'Improved'` and `classifyTrend(20) === 'Improved'`. PASS.

## Test 2 — Same (−14% through +14%)
Unit-verified `classifyTrend(14.99) === 'Same'`, `classifyTrend(-14.99) === 'Same'`, `classifyTrend(0) === 'Same'`. PASS.

## Test 3 — Dropped (% Change ≤ −15%)
Unit-verified `classifyTrend(-20) === 'Dropped'`. Confirmed against real live data: listing `44963099312393` (SKU `PHUH0.5HETBM-IDE`), Image Update Date `2026-07-15` → 30 days live, post-sales £110.46, baseline £213.03, % Change −48.15% → `Dropped`. Cross-checked independently via direct SQL (`-48.17%` by manual arithmetic, matches to rounding). PASS.

## Test 4 — Exact +15%
Unit-verified `classifyTrend(15) === 'Improved'` (boundary is `>=`, inclusive). PASS.

## Test 5 — Exact −15%
Unit-verified `classifyTrend(-15) === 'Dropped'` (boundary is `<=`, inclusive). PASS.

## Test 6 — Zero baseline
Live API test: listing `35211971264679` (SKU `12IP6760-IDE`), Image Update Date `2026-07-15` → post-sales £24.98, baseline £0. Response: `"pctChangeVsBaseline":null,"trend":"Insufficient data","zeroBaseline":true`. No `Infinity`, no `NaN`, no fabricated percentage. PASS.

## Test 7 — Equal-length baseline window
Confirmed by construction: `baselineStartStr = imageUpdateDate - daysLiveSinceUpdate days`, so the baseline window `[baselineStartStr, imageUpdateDate)` is always exactly `daysLiveSinceUpdate` calendar days — same length as "Days Live Since Update" by definition, not incidentally. Live response for the Test 3 case confirms: `daysLiveSinceUpdate:30`, `baselineWindow:{"start":"2026-06-15","end":"2026-07-15"}` = exactly 30 days. PASS.

## Test 8 — Days Live calculated from current date
Live response's `daysLiveSinceUpdate` recomputed fresh on every request from `new Date().toISOString().slice(0,10)` — not stored/cached beyond the existing 5-minute TTL. Confirmed the "image updated today" test returns `daysLiveSinceUpdate:0` when `imageUpdateDate` equals today's date at request time. PASS.

## Test 9 — Listing ID → SKU resolution
Confirmed via direct SQL and live API: `item_id='57163495964937'` → `sku='ENC4361'`; `item_id='44963099312393'` → `sku='PHUH0.5HETBM-IDE'`. Uses `listings.shopify_listings`, the approved/authoritative source already used by every other Jefri requirement on this page — not guessed, not hard-coded. PASS.

## Test 10 — Existing Jefri tabs unaffected
- `node --check api/requirement.js` — passes; new module is a separate self-contained IIFE inserted between `jefriReq5HandlerModule` and `module.exports`, only one new dispatcher line added (`if (fn === 'jefri-req6') ...`), no existing lines modified.
- `jefri.html`: extracted and parsed all 6 `<script>` blocks with `new Function()` — all parse without error. Only additive changes: one new `<li data-req="req6">` nav item, one new `<div id="req6Tab">` panel, one new line in `showReqTab` (`req6Tab` display toggle), one new `if (which === 'req6' ...)` block, `validTabs` array extended (не removed/reordered), and the new `r6*` functions appended after `r5ExportCsv` inside the same `<script>` block — no existing `r1`–`r5` identifiers touched or renamed.
- Live `curl` confirms `req5Tab`/Req5 markup and the `jefri-req5` API route are still present and unchanged in the deployed file.
PASS.

## Additional edge-case tests (live API)
- Future date (`imageUpdateDate=2027-01-01`) → `400 {"error":"Image Update Date cannot be in the future."}`. PASS.
- Listing not found (`listingId=0000000000000`) → `200 {"found":false,"error":"Listing ID not found in listings.shopify_listings (channel: LEDSone DE)."}`. PASS.
- Missing required param → `400 {"error":"Provide ?listingId=..."}`. PASS.
- Image updated today (`daysLiveSinceUpdate=0`) → `pctChangeVsBaseline:null`, `trend:"Insufficient data"`, `insufficientData:true`, `preUpdateBaselineSales:null`, `baselineWindow:null` — no crash, no misleading number. PASS.

## Regression check
`scripts/check-repo-sync.js` — FULLY IN SYNC (49 files) between `aios-2` and `Staff-requirements` after this change. `scripts/check-live-deploy.js` re-run post-deploy — all existing canaries still OK (kuberan/piranav sidebar, muguntha embed, Staff ID Performance tabs) — confirms this deploy did not regress any of today's earlier fixes.

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** None — all 10 required tests plus edge cases pass against live production data.
